package com.treehouse.config;

import com.treehouse.common.JwtUtil;
import com.treehouse.common.ResultCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 登录拦截器
 *
 * <p>校验 Authorization: Bearer {JWT}，通过后把 openid 写入 request attribute，
 * 供 Controller 经 {@code BaseController} 取用。</p>
 *
 * <p>白名单：微信登录、微信支付回调、错误转发页。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;

    /** 免登录路径（用 contains 匹配，覆盖 context-path 前缀场景） */
    private static final String[] WHITE_LIST = {
            "/wechat/login",
            "/wechat/test-login",
            "/order/notify",
            "/uploads/",
            "/error",
            // Internal: scheduled task / dev admin
            "/letter/scan-due",
            "/letter/admin/"
    };

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String uri = request.getRequestURI();
        for (String white : WHITE_LIST) {
            if (uri.contains(white)) {
                return true;
            }
        }

        String token = request.getHeader("Authorization");
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }

        if (token == null || !jwtUtil.validateToken(token)) {
            log.warn("Token 无效或已过期：{}", uri);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"code\":" + ResultCode.UNAUTHORIZED.getCode()
                            + ",\"message\":\"" + ResultCode.UNAUTHORIZED.getMessage() + "\"}");
            return false;
        }

        // 写入 openid，供后续 Controller 使用
        request.setAttribute("openid", jwtUtil.getOpenidFromToken(token));
        return true;
    }
}
