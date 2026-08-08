package com.treehouse.module.privacy;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.User;
import com.treehouse.module.privacy.dto.PrivacyUpdateRequest;
import com.treehouse.module.privacy.dto.PrivacyVO;
import com.treehouse.repository.UserRepository;
import com.treehouse.service.CoinService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 隐私与社交开关服务
 *
 * <p>v1.5 合规设计：</p>
 * <ul>
 *   <li>未实名用户：不能开 chatEnabled / friendEnabled（返回 40301）</li>
 *   <li>免费用户：可读写自己隐私，但不能开社交开关（40301）</li>
 *   <li>会员用户：可开关社交</li>
 *   <li>聊天记录保存期：会员可任意设；免费用户限 7 天</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrivacyService {

    private final UserRepository userRepository;
    private final CoinService coinService;

    /** 聊天记录保存期档位：{ 档位 -> 收费月光币 } */
    private static final Map<Integer, Integer> KEEP_DAYS_PRICE = new HashMap<>();
    static {
        KEEP_DAYS_PRICE.put(7, 0);       // 免费
        KEEP_DAYS_PRICE.put(30, 5);      // 5 币
        KEEP_DAYS_PRICE.put(90, 15);     // 15 币
        KEEP_DAYS_PRICE.put(-1, 50);     // 永久 50 币/月（v1.5 占位）
    }

    @Transactional(readOnly = true)
    public PrivacyVO getPrivacy(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        PrivacyVO vo = new PrivacyVO();
        vo.setRealNameVerified(user.getRealNameVerified() != null && user.getRealNameVerified() == 1);
        vo.setRealNameVerifiedAt(null); // TODO(v1.6): 加字段
        vo.setChatEnabled(user.getChatEnabled() != null && user.getChatEnabled() == 1);
        vo.setFriendEnabled(user.getFriendEnabled() != null && user.getFriendEnabled() == 1);
        vo.setChatHistoryKeepDays(user.getChatHistoryKeepDays());
        boolean isMember = user.getMemberExpireAt() != null
                && user.getMemberExpireAt().isAfter(LocalDateTime.now());
        vo.setIsMember(isMember);
        vo.setMemberExpireAt(user.getMemberExpireAt() == null ? null
                : user.getMemberExpireAt().toString());
        return vo;
    }

    /**
     * 更新隐私设置
     *
     * <p>规则：</p>
     * <ol>
     *   <li>会员校验：开 chatEnabled / friendEnabled 必须先开会员</li>
     *   <li>实名校验：开 chatEnabled / friendEnabled 必须已实名</li>
     *   <li>免费用户改 keepDays：只能改成 7（其他档扣月光币）</li>
     * </ol>
     */
    @Transactional(rollbackFor = Exception.class)
    public PrivacyVO updatePrivacy(Long userId, PrivacyUpdateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        boolean isMember = user.getMemberExpireAt() != null
                && user.getMemberExpireAt().isAfter(LocalDateTime.now());
        boolean realNameOk = user.getRealNameVerified() != null && user.getRealNameVerified() == 1;

        // 1) 聊天开关
        if (req.getChatEnabled() != null) {
            if (req.getChatEnabled()) {
                if (!isMember) {
                    throw new BizException(40301, "开通会员后才能开聊天功能");
                }
                if (!realNameOk) {
                    throw new BizException(40301, "完成实名认证后才能开聊天");
                }
            }
            user.setChatEnabled(req.getChatEnabled() ? 1 : 0);
        }

        // 2) 好友开关
        if (req.getFriendEnabled() != null) {
            if (req.getFriendEnabled()) {
                if (!isMember) {
                    throw new BizException(40301, "开通会员后才能开加好友功能");
                }
                if (!realNameOk) {
                    throw new BizException(40301, "完成实名认证后才能开加好友");
                }
            }
            user.setFriendEnabled(req.getFriendEnabled() ? 1 : 0);
        }

        // 3) 聊天记录保存期
        if (req.getChatHistoryKeepDays() != null) {
            int keep = req.getChatHistoryKeepDays();
            if (!KEEP_DAYS_PRICE.containsKey(keep)) {
                throw new BizException(40000, "keepDays 必须是 7 / 30 / 90 / -1 之一");
            }
            // 免费用户：超过 7 天 = 收费，先收币再改
            if (!isMember && keep != 7) {
                throw new BizException(40301, "免费用户聊天记录只能保存 7 天，开通会员解锁更多档位");
            }
            // 会员：改档收费（v1.5 占位，v1.6 真实计费）
            if (isMember) {
                int cost = KEEP_DAYS_PRICE.get(keep);
                if (cost > 0) {
                    // 收费：调用 CoinService 扣币；v1.5 占位不真扣，先记录
                    log.info("[privacy] 改 keepDays 收费：userId={}, days={}, cost={}", userId, keep, cost);
                    // v1.6 接入：coinService.change(userId, -cost, "CHAT_KEEP_DAYS", String.valueOf(keep));
                }
            }
            user.setChatHistoryKeepDays(keep);
        }

        userRepository.save(user);
        log.info("隐私设置更新：userId={}, chatEnabled={}, friendEnabled={}, keepDays={}",
                userId, user.getChatEnabled(), user.getFriendEnabled(), user.getChatHistoryKeepDays());
        return getPrivacy(userId);
    }

    /**
     * 设置实名认证状态
     */
    @Transactional(rollbackFor = Exception.class)
    public void setRealNameVerified(Long userId, boolean verified) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        user.setRealNameVerified(verified ? 1 : 0);
        userRepository.save(user);
        log.info("[实名] 用户ID: {}, 状态: {}", userId, verified);
    }
}
