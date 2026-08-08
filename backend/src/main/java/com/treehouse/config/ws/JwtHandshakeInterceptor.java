package com.treehouse.config.ws;

import com.treehouse.common.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * WebSocket JWT 握手拦截器
 *
 * <p>小程序 wx.connectSocket 不支持自定义 header（WebSocket API 限制），
 * 所以 token 走 URL 参数 ?token=xxx。本拦截器在握手阶段校验 token，失败直接 401。</p>
 *
 * <p>前端写法：</p>
 * <pre>
 * const socket = wx.connectSocket({
 *   url: 'ws://host/ws/chat?token=eyJhbG...',
 *   success: () => {}
 * })
 * </pre>
 *
 * <p>v1.5 安全考虑：</p>
 * <ul>
 *   <li>URL 里的 token 会被中间代理记录——必须 HTTPS 上线（wss://）</li>
 *   <li>token 7 天过期 + 短连接：断线重连 = 重新握手拿新 token</li>
 *   <li>握手时把 userId 写进 session attributes，后续消息路由用</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        // 1) 取 token：优先 header（兼容 PC 测试），否则从 query string 取
        String token = null;
        String auth = request.getHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            token = auth.substring(7);
        }
        if (token == null && request instanceof ServletServerHttpRequest) {
            HttpServletRequest servlet = ((ServletServerHttpRequest) request).getServletRequest();
            token = servlet.getParameter("token");
        }

        if (token == null || token.isEmpty() || !jwtUtil.validateToken(token)) {
            log.warn("[ws] 握手失败：token 无效");
            response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
            return false;
        }

        // 2) 解析出 openid（userId 由 ChatWebSocketHandler 解析时再查 DB，避免 token 里塞太多）
        String openid = jwtUtil.getOpenidFromToken(token);
        attributes.put("token", token);
        attributes.put("openid", openid);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 暂无后处理
    }
}
