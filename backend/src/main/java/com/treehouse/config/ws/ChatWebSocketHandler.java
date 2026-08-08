package com.treehouse.config.ws;

import cn.hutool.json.JSONUtil;
import com.treehouse.entity.User;
import com.treehouse.module.chat.ChatService;
import com.treehouse.module.chat.dto.ChatMessageVO;
import com.treehouse.module.chat.dto.SendMessageRequest;
import com.treehouse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 聊天 WebSocket Handler（v1.5 实时性核心）
 *
 * <p>连接管理：</p>
 * <ul>
 *   <li>用 {@code userId -> Set<WebSocketSession>} 维护"一个用户多端登录"</li>
 *   <li>支持 PC + 手机同时在线，消息推给所有端</li>
 *   <li>连接关闭时自动清理</li>
 * </ul>
 *
 * <p>消息协议：</p>
 * <pre>
 * 客户端发：{"type":"SEND","toUserId":123,"content":"hi","msgType":"TEXT"}
 * 客户端发：{"type":"PING"}  // 心跳
 * 客户端发：{"type":"READ","peerUserId":123}
 * 服务端推：{"type":"MSG","message":{...ChatMessageVO}}
 * 服务端推：{"type":"ACK","messageId":xxx,"ts":123}
 * 服务端推：{"type":"READ","peerUserId":xxx,"at":"..."}
 * 服务端推：{"type":"PONG"}
 * 服务端推：{"type":"ERROR","code":40301,"message":"..."}
 * </pre>
 *
 * <p>v1.5 实时性策略：</p>
 * <ul>
 *   <li>单实例推送（内存 Map）——开发期够用</li>
 *   <li>水平扩展时换 Redis Pub/Sub（v1.6）</li>
 *   <li>心跳 30s 一次，超时 60s 断开（前端要做心跳）</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final UserRepository userRepository;
    private final ChatService chatService;

    /** userId -> 该用户的所有活跃连接（支持多端） */
    private static final ConcurrentHashMap<Long, Set<WebSocketSession>> SESSIONS = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = resolveUserId(session);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("userId 解析失败"));
            return;
        }
        SESSIONS.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("[ws] 连接建立 userId={} sessionId={} 在线用户数={}",
                userId, session.getId(), SESSIONS.size());
        send(session, json("WELCOME", "连接成功"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Long userId = resolveUserId(session);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        Map<String, Object> req;
        try {
            req = JSONUtil.toBean(message.getPayload(), Map.class);
        } catch (Exception e) {
            send(session, error(40000, "消息格式错误"));
            return;
        }
        String type = String.valueOf(req.get("type"));
        try {
            switch (type) {
                case "PING": {
                    send(session, json("PONG", "pong"));
                    break;
                }
                case "SEND": {
                    Long toUserId = ((Number) req.get("toUserId")).longValue();
                    String content = (String) req.get("content");
                    String msgType = (String) req.getOrDefault("msgType", "TEXT");
                    SendMessageRequest smr = new SendMessageRequest();
                    smr.setToUserId(toUserId);
                    smr.setContent(content);
                    smr.setMsgType(msgType);
                    ChatMessageVO vo = chatService.send(userId, smr);
                    // 推回发送方
                    send(session, mapOf("type", "ACK", "message", vo));
                    // 推给接收方（多端）
                    pushToUser(toUserId, mapOf("type", "MSG", "message", vo));
                    break;
                }
                case "READ": {
                    Long peerUserId = ((Number) req.get("peerUserId")).longValue();
                    chatService.markSessionRead(userId, peerUserId);
                    // 通知对方"我已读"
                    pushToUser(peerUserId, mapOf("type", "READ", "peerUserId", userId, "at", java.time.LocalDateTime.now().toString()));
                    break;
                }
                default:
                    send(session, error(40000, "未知 type: " + type));
            }
        } catch (com.treehouse.common.BizException e) {
            send(session, error(e.getCode(), e.getMessage()));
        } catch (Exception e) {
            log.error("[ws] 处理消息异常", e);
            send(session, error(50001, "服务器错误"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = resolveUserId(session);
        if (userId == null) return;
        Set<WebSocketSession> set = SESSIONS.get(userId);
        if (set != null) {
            set.remove(session);
            if (set.isEmpty()) {
                SESSIONS.remove(userId);
            }
        }
        log.info("[ws] 连接关闭 userId={} status={} 在线用户数={}", userId, status, SESSIONS.size());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.warn("[ws] 传输异常 sessionId={}: {}", session.getId(), exception.getMessage());
        // 关闭连接触发 afterConnectionClosed
        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (Exception ignored) {}
    }

    // ============== 工具 ==============

    private Long resolveUserId(WebSocketSession session) {
        Object openid = session.getAttributes().get("openid");
        if (openid == null) return null;
        try {
            User u = userRepository.findByOpenid((String) openid).orElse(null);
            return u == null ? null : u.getId();
        } catch (Exception e) {
            log.error("[ws] 解析 userId 失败", e);
            return null;
        }
    }

    private void send(WebSocketSession session, Object payload) {
        try {
            if (!session.isOpen()) return;
            String text = (payload instanceof String) ? (String) payload : JSONUtil.toJsonStr(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(text));
            }
        } catch (Exception e) {
            log.warn("[ws] 发送失败 sessionId={}: {}", session.getId(), e.getMessage());
        }
    }

    private String json(String type, String message) {
        return JSONUtil.toJsonStr(mapOf("type", type, "message", message));
    }

    private Map<String, Object> error(int code, String message) {
        return mapOf("type", "ERROR", "code", code, "message", message);
    }

    private Map<String, Object> mapOf(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }

    /**
     * 推送给某用户的所有活跃连接
     */
    public static void pushToUser(Long userId, Object payload) {
        Set<WebSocketSession> set = SESSIONS.get(userId);
        if (set == null || set.isEmpty()) {
            // 离线：用「订阅消息」兜底（v1.6 接）
            return;
        }
        for (WebSocketSession s : set) {
            try {
                if (s.isOpen()) {
                    String text = JSONUtil.toJsonStr(payload);
                    synchronized (s) {
                        s.sendMessage(new TextMessage(text));
                    }
                }
            } catch (Exception e) {
                log.warn("[ws] 推送失败 userId={}: {}", userId, e.getMessage());
            }
        }
    }
}
