package com.treehouse.config;

import com.treehouse.common.JwtUtil;
import com.treehouse.config.ws.ChatWebSocketHandler;
import com.treehouse.config.ws.JwtHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket 配置（v1.5 聊天）
 *
 * <p>路径：/ws/chat（小程序的 wx.connectSocket）</p>
 *
 * <p>握手阶段：</p>
 * <ol>
 *   <li>前端在 url 带 ?token=xxx（因为浏览器 WebSocket API 不能加 header）</li>
 *   <li>JwtHandshakeInterceptor 校验 token，失败直接 401 拒绝连接</li>
 *   <li>成功后从 token 解析出 openid → userId → 写入 session attributes</li>
 *   <li>ChatWebSocketHandler 负责实际的消息收发</li>
 * </ol>
 *
 * <p>实时性策略：</p>
 * <ul>
 *   <li>Spring 原生 WebSocket（基于 Tomcat）——单实例支持 5000+ 并发</li>
 *   <li>后续水平扩展时换 STOMP + Redis Pub/Sub（v1.6+）</li>
 * </ul>
 */
@Slf4j
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatHandler;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final JwtUtil jwtUtil;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler, "/ws/chat")
                .addInterceptors(jwtHandshakeInterceptor)
                // 允许跨域：开发期间 CORS 关闭，线上同源
                .setAllowedOriginPatterns("*");
        log.info("[ws] 注册 /ws/chat 端点");
    }
}
