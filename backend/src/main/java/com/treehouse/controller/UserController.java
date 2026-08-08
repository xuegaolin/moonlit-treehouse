package com.treehouse.controller;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.dto.UpdateProfileRequest;
import com.treehouse.entity.User;
import com.treehouse.service.CoinService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * 用户控制器
 */
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController extends BaseController {

    private final CoinService coinService;

    /**
     * 查询用户信息
     *
     * <p>GET /api/v1/user/profile → { openid, nickname, avatar, coinBalance, memberExpireAt }</p>
     */
    @GetMapping("/profile")
    public R<Map<String, Object>> profile(HttpServletRequest request) {
        User user = currentUser(request);

        Map<String, Object> data = new HashMap<>();
        data.put("openid", user.getOpenid());
        data.put("nickname", user.getNickname());
        data.put("avatar", user.getAvatar());
        data.put("coinBalance", coinService.getWallet(user.getId()).getBalance());
        data.put("memberExpireAt", user.getMemberExpireAt());
        return R.ok(data);
    }

    /**
     * 更新用户资料（昵称 / 头像）
     *
     * <p>POST /api/v1/user/update-profile → { ok: true }</p>
     */
    @PostMapping("/update-profile")
    public R<Map<String, Object>> updateProfile(HttpServletRequest request,
                                                @RequestBody @Validated UpdateProfileRequest req) {
        String openid = String.valueOf(request.getAttribute("openid"));
        userService.updateProfile(openid, req.getNickname(), req.getAvatar());

        Map<String, Object> data = new HashMap<>();
        data.put("ok", true);
        return R.ok(data);
    }
}
