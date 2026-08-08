package com.treehouse.module.chat;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.common.SensitiveWordService;
import com.treehouse.entity.User;
import com.treehouse.module.chat.dto.ChatMessageVO;
import com.treehouse.module.chat.dto.ChatSessionVO;
import com.treehouse.module.chat.dto.SendMessageRequest;
import com.treehouse.module.chat.entity.ChatMessage;
import com.treehouse.module.chat.entity.ChatSession;
import com.treehouse.module.chat.repository.ChatFriendRepository;
import com.treehouse.module.chat.repository.ChatMessageRepository;
import com.treehouse.module.chat.repository.ChatSessionRepository;
import com.treehouse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 聊天核心服务（v1.5）
 *
 * <p>设计原则：</p>
 * <ul>
 *   <li>合规章节：发消息前必过「实名 + 对方 chat_enabled + 好友关系」三道闸</li>
 *   <li>内容安全：本地敏感词 + 微信 msgSecCheck 双重审核（顺序：本地先，远程后）</li>
 *   <li>线程安全：所有写操作走 DB 唯一约束 + 原子累加（沿用 7/31 硬规则）</li>
 *   <li>隐私：消息存原文（合规可追溯），不展示真名/头像</li>
 *   <li>实时性：发消息同步落库 + 通过 WebSocket 推送对方（push 由 ChatWebSocketHandler 调本服务）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final UserRepository userRepository;
    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatFriendRepository friendRepository;
    private final SensitiveWordService sensitiveWordService;
    private final WxMsgSecCheckService wxMsgSecCheckService;

    /** 每天最大消息数（防灌水） */
    @Value("${treehouse.chat.max-per-day:200}")
    private int maxPerDay;

    /** 单条最大字符 */
    @Value("${treehouse.chat.max-content-length:500}")
    private int maxContentLength;

    // ============== 发送消息 ==============

    /**
     * 发送消息（合规+审核+落库）
     *
     * <p>流程：</p>
     * <ol>
     *   <li>校验长度</li>
     *   <li>校验自己：real_name_verified=1 + isMember</li>
     *   <li>校验对方：user 存在 + chat_enabled=1</li>
     *   <li>校验关系：双向好友 或 付费会员（v1.5 简化：先要求双向好友）</li>
     *   <li>本地敏感词扫描（命中 = 直接 REJECTED）</li>
     *   <li>微信 msgSecCheck（命中 = REJECTED）</li>
     *   <li>写消息 + 更新会话 + 未读数 +1（原子）</li>
     *   <li>返回 vo（webSocket 推送在 controller 层做）</li>
     * </ol>
     */
    @Transactional(rollbackFor = Exception.class)
    public ChatMessageVO send(Long fromUserId, SendMessageRequest req) {
        // 1) 参数校验
        if (req.getContent() == null || req.getContent().isEmpty()) {
            throw new BizException(40000, "消息内容不能为空");
        }
        if (req.getContent().length() > maxContentLength) {
            throw new BizException(40000, "消息最长 " + maxContentLength + " 字");
        }
        if (req.getToUserId() == null) {
            throw new BizException(40000, "toUserId 必填");
        }
        if (fromUserId.equals(req.getToUserId())) {
            throw new BizException(40000, "不能给自己发消息");
        }

        // 2) 校验发件人
        User from = userRepository.findById(fromUserId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        if (from.getRealNameVerified() == null || from.getRealNameVerified() != 1) {
            throw new BizException(40301, "完成微信实名后才能发消息");
        }
        if (from.getMemberExpireAt() == null || from.getMemberExpireAt().isBefore(LocalDateTime.now())) {
            throw new BizException(40301, "开通会员后才能聊天");
        }

        // 3) 校验收件人
        User to = userRepository.findById(req.getToUserId())
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND, "对方不存在"));
        if (to.getChatEnabled() == null || to.getChatEnabled() != 1) {
            throw new BizException(40301, "对方未开放聊天");
        }

        // 4) 校验好友关系（双向 ACCEPTED）
        if (!isMutualFriend(fromUserId, req.getToUserId())) {
            throw new BizException(40301, "请先加对方为好友");
        }

        // 5) 每日限流
        long todayCount = countTodayMessages(fromUserId);
        if (todayCount >= maxPerDay) {
            throw new BizException(42901, "今日消息已达上限 (" + maxPerDay + " 条)");
        }

        // 6) 本地敏感词（命中立即拒绝，不写库）
        String hitWord = sensitiveWordService.findFirst(req.getContent());
        if (hitWord != null) {
            log.warn("[chat] 本地敏感词命中 fromUserId={}, word={}", fromUserId, hitWord);
            throw new BizException(40301, "消息含违规词「" + hitWord + "」");
        }

        // 7) 微信 msgSecCheck
        // 开发期：openid 以 test_ 开头 → 跳过微信接口（test 环境下 openid 是假）
        // 生产期：真实 openid 走完整微信审核
        String secResult;
        if (from.getOpenid() != null && from.getOpenid().startsWith("test_")) {
            secResult = "PASS";
            log.debug("[chat] dev 模式跳过微信审核 openid={}", from.getOpenid());
        } else {
            secResult = wxMsgSecCheckService.check(req.getContent());
        }
        if ("REJECT".equals(secResult)) {
            log.warn("[chat] 微信审核拒绝 fromUserId={}", fromUserId);
            throw new BizException(40301, "消息未通过内容审核");
        }

        // 8) 计算过期时间
        LocalDateTime expiredAt = computeExpiredAt(to);

        // 9) 落库消息
        ChatMessage msg = new ChatMessage();
        msg.setFromUserId(fromUserId);
        msg.setToUserId(req.getToUserId());
        msg.setContent(req.getContent());
        msg.setMsgType(req.getMsgType() == null ? "TEXT" : req.getMsgType());
        msg.setAudited(1);
        msg.setAuditResult("PASS");
        msg.setCreateTime(LocalDateTime.now());
        msg.setExpiredAt(expiredAt);
        msg = messageRepository.saveAndFlush(msg);

        // 10) 更新/创建会话 + 未读数 +1（沿用 UNIQUE 兜底）
        ChatSession session = ensureSession(fromUserId, req.getToUserId());
        String preview = req.getContent().length() > 30
                ? req.getContent().substring(0, 30) + "..."
                : req.getContent();
        session.setLastMsgId(msg.getId());
        session.setLastMsgPreview(preview);
        session.setLastMsgAt(msg.getCreateTime());
        // 给对方未读 +1
        if (req.getToUserId().equals(session.getUserAId())) {
            sessionRepository.bumpAUnread(session.getId());
        } else {
            sessionRepository.bumpBUnread(session.getId());
        }
        session.setUpdateTime(LocalDateTime.now());
        sessionRepository.save(session);

        log.info("[chat] 消息已发送 from={} to={} id={}", fromUserId, req.getToUserId(), msg.getId());
        return ChatMessageVO.from(msg);
    }

    private LocalDateTime computeExpiredAt(User receiver) {
        Integer days = receiver.getChatHistoryKeepDays();
        if (days == null || days == -1) return null; // 永久
        return LocalDateTime.now().plusDays(days);
    }

    /**
     * 找/创建会话（user_a < user_b 约定）
     */
    private ChatSession ensureSession(Long userId1, Long userId2) {
        Long a = Math.min(userId1, userId2);
        Long b = Math.max(userId1, userId2);
        return sessionRepository.findByPair(a, b).orElseGet(() -> {
            ChatSession s = new ChatSession();
            s.setUserAId(a);
            s.setUserBId(b);
            s.setCreateTime(LocalDateTime.now());
            s.setUpdateTime(LocalDateTime.now());
            try {
                return sessionRepository.saveAndFlush(s);
            } catch (DataIntegrityViolationException e) {
                // 并发双创
                return sessionRepository.findByPair(a, b).orElseThrow(() -> new BizException(ResultCode.INTERNAL_ERROR));
            }
        });
    }

    private long countTodayMessages(Long userId) {
        // 简化：实际项目可以加 t_chat_message 的 idx_from_create 优化
        // 这里用本地估算（精确日限可改 SQL）
        LocalDate today = LocalDate.now();
        return messageRepository.findAll().stream()
                .filter(m -> m.getFromUserId().equals(userId))
                .filter(m -> m.getCreateTime().toLocalDate().equals(today))
                .count();
    }

    private boolean isMutualFriend(Long u1, Long u2) {
        // 双向 ACCEPTED：A 在 B 的好友列表 + B 在 A 的好友列表
        boolean aToB = friendRepository.findByUserIdAndFriendId(u1, u2)
                .map(f -> "ACCEPTED".equals(f.getStatus())).orElse(false);
        boolean bToA = friendRepository.findByUserIdAndFriendId(u2, u1)
                .map(f -> "ACCEPTED".equals(f.getStatus())).orElse(false);
        return aToB && bToA;
    }

    // ============== 拉历史 ==============

    /**
     * 拉我和某人的历史消息（倒序，分页）
     * @param page 0-based
     * @param size 默认 30，最大 100
     */
    @Transactional(readOnly = true)
    public List<ChatMessageVO> history(Long myUserId, Long peerUserId, int page, int size) {
        int safeSize = Math.max(1, Math.min(100, size));
        int safePage = Math.max(0, page);
        List<ChatMessage> rows = messageRepository.findHistoryDesc(
                myUserId, peerUserId, LocalDateTime.now(), PageRequest.of(safePage, safeSize));
        // 翻转成正序返回
        java.util.Collections.reverse(rows);
        return rows.stream().map(ChatMessageVO::from).collect(Collectors.toList());
    }

    // ============== 我的会话列表 ==============

    @Transactional(readOnly = true)
    public List<ChatSessionVO> mySessions(Long myUserId) {
        List<ChatSession> all = sessionRepository.findAllMine(myUserId, PageRequest.of(0, 100));
        return all.stream()
                .filter(s -> !s.isDeletedBy(myUserId))
                .map(s -> ChatSessionVO.from(s, myUserId))
                .collect(Collectors.toList());
    }

    // ============== 标记已读 ==============

    /**
     * 进入聊天页时调用 - 把"对方发给我的"全部标已读
     */
    @Transactional
    public int markRead(Long myUserId) {
        return messageRepository.markRead(myUserId, LocalDateTime.now());
    }

    /**
     * 标记某个会话已读
     */
    @Transactional
    public void markSessionRead(Long myUserId, Long peerUserId) {
        Long a = Math.min(myUserId, peerUserId);
        Long b = Math.max(myUserId, peerUserId);
        ChatSession s = sessionRepository.findByPair(a, b).orElse(null);
        if (s == null) return;
        if (myUserId.equals(s.getUserAId())) {
            sessionRepository.clearAUnread(s.getId());
        } else {
            sessionRepository.clearBUnread(s.getId());
        }
    }

    // ============== 好友 ==============

    @Transactional
    public void addFriend(Long fromUserId, Long toUserId) {
        if (fromUserId.equals(toUserId)) {
            throw new BizException(40000, "不能加自己");
        }
        User to = userRepository.findById(toUserId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        if (to.getFriendEnabled() == null || to.getFriendEnabled() != 1) {
            throw new BizException(40301, "对方未开放加好友");
        }

        // 看对方是否已加我（互加直接 ACCEPTED）
        java.util.Optional<com.treehouse.module.chat.entity.ChatFriend> reverse =
                friendRepository.findByUserIdAndFriendId(toUserId, fromUserId);
        boolean reverseAccepted = reverse.isPresent() && "ACCEPTED".equals(reverse.get().getStatus());

        // 写 from -> to
        com.treehouse.module.chat.entity.ChatFriend f = friendRepository
                .findByUserIdAndFriendId(fromUserId, toUserId).orElseGet(() -> {
                    com.treehouse.module.chat.entity.ChatFriend nf = new com.treehouse.module.chat.entity.ChatFriend();
                    nf.setUserId(fromUserId);
                    nf.setFriendId(toUserId);
                    nf.setCreateTime(LocalDateTime.now());
                    return nf;
                });
        f.setStatus(reverseAccepted ? "ACCEPTED" : "PENDING");
        f.setUpdateTime(LocalDateTime.now());
        friendRepository.save(f);

        // 写 to -> from（如不存在）
        if (!reverse.isPresent()) {
            com.treehouse.module.chat.entity.ChatFriend back = new com.treehouse.module.chat.entity.ChatFriend();
            back.setUserId(toUserId);
            back.setFriendId(fromUserId);
            back.setStatus("PENDING");
            back.setCreateTime(LocalDateTime.now());
            back.setUpdateTime(LocalDateTime.now());
            try {
                friendRepository.save(back);
            } catch (DataIntegrityViolationException ignored) {}
        }
    }

    @Transactional
    public void acceptFriend(Long myUserId, Long fromUserId) {
        // 我接受 fromUserId 的好友请求
        com.treehouse.module.chat.entity.ChatFriend mine = friendRepository
                .findByUserIdAndFriendId(myUserId, fromUserId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND, "好友请求不存在"));
        mine.setStatus("ACCEPTED");
        mine.setUpdateTime(LocalDateTime.now());
        friendRepository.save(mine);

        // 对方那一条也要 ACCEPTED
        friendRepository.findByUserIdAndFriendId(fromUserId, myUserId).ifPresent(peer -> {
            peer.setStatus("ACCEPTED");
            peer.setUpdateTime(LocalDateTime.now());
            friendRepository.save(peer);
        });
    }

    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> myFriends(Long myUserId) {
        List<com.treehouse.module.chat.entity.ChatFriend> list = friendRepository.findAccepted(myUserId);
        if (list == null) list = java.util.Collections.emptyList();
        return list.stream().map(f -> {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("friendId", f.getFriendId());
            m.put("remark", f.getRemark());
            m.put("since", f.getCreateTime());
            return m;
        }).collect(Collectors.toList());
    }

}
