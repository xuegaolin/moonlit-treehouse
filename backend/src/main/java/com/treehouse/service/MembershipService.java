package com.treehouse.service;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.User;
import com.treehouse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 会员服务
 *
 * <p>价格档对齐 PRD：月卡 19 元 / 年卡 128 元 / 终身 388 元。
 * MVP 阶段微信支付未接入，subscribe 返回占位订单，TODO 待接微信支付回调。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipService {

    private final WechatPayService wechatPayService;
    private final UserRepository userRepository;

    /**
     * 会员套餐列表（静态配置，后续可迁移到数据库或配置中心）
     *
     * @return 套餐列表（对齐 GET /membership/plans 响应结构）
     */
    public List<Map<String, Object>> plans() {
        List<Map<String, Object>> plans = new ArrayList<>();

        Map<String, Object> month = new HashMap<>();
        month.put("code", "MONTH");
        month.put("price", new BigDecimal("19"));
        month.put("days", 30);
        month.put("benefits", defaultBenefits());
        plans.add(month);

        Map<String, Object> year = new HashMap<>();
        year.put("code", "YEAR");
        year.put("price", new BigDecimal("128"));
        year.put("days", 365);
        year.put("recommend", true);
        year.put("benefits", defaultBenefits());
        plans.add(year);

        Map<String, Object> life = new HashMap<>();
        life.put("code", "LIFE");
        life.put("price", new BigDecimal("388"));
        life.put("days", 999999);
        life.put("benefits", defaultBenefits());
        plans.add(life);

        return plans;
    }

    /**
     * 开通会员（生成待支付订单）
     *
     * <p>MVP：具体下单交给 {@link WechatPayService}，mock 模式下返回占位 wxPayParams。
     * 生产环境切换 wechatpay.mock-mode=false 即可打通真实支付链路。</p>
     *
     * @param userId   用户 ID
     * @param planCode 套餐码 MONTH/YEAR/LIFE
     * @return 包含订单号与 wxPayParams（可能为 null，小程序需判断 mockMode）
     */
    public Map<String, Object> subscribe(Long userId, String planCode) {
        Map<String, Object> plan = plans().stream()
                .filter(p -> planCode.equals(p.get("code")))
                .findFirst()
                .orElseThrow(() -> new BizException(ResultCode.BAD_REQUEST.getCode(), "未知套餐：" + planCode));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND.getCode(), "用户不存在"));

        BigDecimal price = (BigDecimal) plan.get("price");
        int days = (int) plan.get("days");

        log.info("会员下单：userId={}, plan={}, price={}", userId, planCode, price);
        return wechatPayService.createOrder(userId, user.getOpenid(), planCode, price, days);
    }

    /** 会员权益文案 */
    private List<String> defaultBenefits() {
        List<String> benefits = new ArrayList<>();
        benefits.add("不限量 AI 回信");
        benefits.add("高级摆烂证书模板");
        benefits.add("塔罗单张免费解读");
        benefits.add("专属会员徽章");
        return benefits;
    }
}
