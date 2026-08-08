package com.treehouse.controller;

import cn.hutool.json.JSONObject;
import com.treehouse.common.JwtUtil;
import com.treehouse.common.R;
import com.treehouse.common.ResultCode;
import com.treehouse.dto.LoginRequest;
import com.treehouse.entity.User;
import com.treehouse.service.UserService;
import com.treehouse.service.WechatMaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 微信登录控制器
 *
 * <p>流程对齐技术架构 6.1：wx.login code → jscode2session → openid → 签发 JWT（7 天）。</p>
 */
@Slf4j
@RestController
@RequestMapping("/wechat")
@RequiredArgsConstructor
public class WechatAuthController {

    private final WechatMaService wechatMaService;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    /**
     * 静默登录
     *
     * <p>POST /api/v1/wechat/login</p>
     *
     * @param req { code }
     * @return { token, openid, isNewUser, member }
     */
    @PostMapping("/login")
    public R<Map<String, Object>> login(@RequestBody @Validated LoginRequest req) {
        log.info("微信小程序登录，code={}", req.getCode());

        // 1. code 换 openid
        JSONObject session = wechatMaService.code2Session(req.getCode());
        String openid = session.getStr("openid");
        String unionid = session.getStr("unionid");

        // 2. 获取或静默创建用户
        UserService.LoginResult result = userService.getOrCreateByOpenid(openid, unionid);
        User user = result.getUser();

        // 3. 签发 JWT
        String token = jwtUtil.generateToken(openid);

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("openid", openid);
        data.put("isNewUser", result.isNewUser());
        data.put("member", user.getMemberExpireAt());
        return R.ok(data);
    }

    /**
     * 【仅开发环境】测试登录：免微信 code 直接签发 token
     *
     * <p>仅在 spring.profiles.active=dev 时可用，生产环境返回 403。</p>
     */
    @PostMapping("/test-login")
    public R<?> testLogin(
            @Value("${spring.profiles.active:prod}") String activeProfile,
            @RequestBody(required = false) Map<String, Object> body) {
        if (!"dev".equals(activeProfile)) {
            return R.error(ResultCode.FORBIDDEN.getCode(), "生产环境禁止测试登录");
        }

        // 默认固定测试账号；允许传 openid 指定（自动化验证需要干净账号，
        // 否则“每日限领一次”类接口无法重复测试）。仅 dev profile 可达，生产已在上方拦住。
        String testOpenid = "test_openid_treehouse_001";
        if (body != null) {
            Object v = body.get("openid");
            if (v != null && !v.toString().trim().isEmpty()) {
                testOpenid = v.toString().trim();
            }
        }
        UserService.LoginResult result = userService.getOrCreateByOpenid(testOpenid, null);

        Map<String, Object> data = new HashMap<>();
        data.put("token", jwtUtil.generateToken(testOpenid));
        data.put("openid", testOpenid);
        data.put("isNewUser", result.isNewUser());
        data.put("member", null);
        return R.ok(data);
    }
}
