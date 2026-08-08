package com.treehouse.service;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.User;
import com.treehouse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 用户服务
 *
 * <p>负责用户的静默注册、资料维护。新用户注册时自动初始化月光币钱包。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CoinService coinService;

    /**
     * 按 openid 获取用户；不存在则静默创建并初始化月光币钱包
     *
     * @param openid  微信 openid
     * @param unionid 微信 unionid（可空）
     * @return 二元信息：用户实体 + 是否新用户（通过返回值数组传递，避免额外 DTO）
     */
    @Transactional(rollbackFor = Exception.class)
    public LoginResult getOrCreateByOpenid(String openid, String unionid) {
        User user = userRepository.findByOpenid(openid).orElse(null);
        boolean newUser = false;

        if (user == null) {
            newUser = true;
            user = new User();
            user.setOpenid(openid);
            user.setUnionid(unionid);
            user.setNickname("树屋夜行者");
            user.setLastLoginTime(LocalDateTime.now());
            user = userRepository.save(user);

            // 新用户初始化月光币钱包
            coinService.initWallet(user.getId());
            log.info("新用户注册：userId={}, openid={}", user.getId(), openid);
        } else {
            user.setLastLoginTime(LocalDateTime.now());
            if (unionid != null && user.getUnionid() == null) {
                user.setUnionid(unionid);
            }
            user = userRepository.save(user);
        }

        return new LoginResult(user, newUser);
    }

    /**
     * 按 openid 查用户，不存在则抛 40401
     */
    public User getByOpenid(String openid) {
        return userRepository.findByOpenid(openid)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND.getCode(), "用户不存在"));
    }

    /**
     * 保存用户（通用方法）
     */
    public User save(User user) {
        return userRepository.save(user);
    }

    /**
     * 更新用户资料（昵称 / 头像）
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateProfile(String openid, String nickname, String avatar) {
        User user = getByOpenid(openid);
        if (nickname != null && !nickname.trim().isEmpty()) {
            user.setNickname(nickname.trim());
        }
        if (avatar != null && !avatar.trim().isEmpty()) {
            user.setAvatar(avatar.trim());
        }
        userRepository.save(user);
    }

    /**
     * 登录结果：用户实体 + 是否新注册
     */
    public static class LoginResult {
        private final User user;
        private final boolean newUser;

        public LoginResult(User user, boolean newUser) {
            this.user = user;
            this.newUser = newUser;
        }

        public User getUser() {
            return user;
        }

        public boolean isNewUser() {
            return newUser;
        }
    }
}
