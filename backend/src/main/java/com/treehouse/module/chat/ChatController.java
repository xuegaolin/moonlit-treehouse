package com.treehouse.module.chat;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.chat.dto.ChatMessageVO;
import com.treehouse.module.chat.dto.ChatSessionVO;
import com.treehouse.module.chat.dto.SendMessageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

/**
 * 聊天 REST API（v1.5）
 *
 * <p>实时消息走 WebSocket（/ws/chat），HTTP 端点负责：</p>
 * <ul>
 *   <li>会话列表</li>
 *   <li>历史消息（首次进入聊天页拉）</li>
 *   <li>发消息（也可走 WS，但 HTTP 更简单 + 可重试）</li>
 *   <li>标已读 / 删除会话</li>
 *   <li>好友：加好友 / 接受 / 列表</li>
 * </ul>
 */
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController extends BaseController {

    private final ChatService chatService;

    /** 我的会话列表 */
    @GetMapping("/sessions")
    public R<List<ChatSessionVO>> mySessions(HttpServletRequest request) {
        return R.ok(chatService.mySessions(currentUserId(request)));
    }

    /** 拉与某人的历史消息 */
    @GetMapping("/history")
    public R<List<ChatMessageVO>> history(HttpServletRequest request,
                                          @RequestParam Long peerUserId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "30") int size) {
        return R.ok(chatService.history(currentUserId(request), peerUserId, page, size));
    }

    /** 发送消息（HTTP 版，前端可用 wx.request 调） */
    @PostMapping("/send")
    public R<ChatMessageVO> send(HttpServletRequest request,
                                 @RequestBody @Validated SendMessageRequest req) {
        return R.ok(chatService.send(currentUserId(request), req));
    }

    /** 标记与某人的会话已读 */
    @PutMapping("/read/{peerUserId}")
    public R<Void> markRead(HttpServletRequest request,
                            @PathVariable Long peerUserId) {
        chatService.markSessionRead(currentUserId(request), peerUserId);
        return R.ok();
    }

    /** 我的好友列表 */
    @GetMapping("/friends")
    public R<List<Map<String, Object>>> friends(HttpServletRequest request) {
        return R.ok(chatService.myFriends(currentUserId(request)));
    }

    /** 加好友 */
    @PostMapping("/friend/add")
    public R<Void> addFriend(HttpServletRequest request, @RequestParam Long toUserId) {
        chatService.addFriend(currentUserId(request), toUserId);
        return R.ok();
    }

    /** 接受好友 */
    @PostMapping("/friend/accept")
    public R<Void> acceptFriend(HttpServletRequest request, @RequestParam Long fromUserId) {
        chatService.acceptFriend(currentUserId(request), fromUserId);
        return R.ok();
    }
}
