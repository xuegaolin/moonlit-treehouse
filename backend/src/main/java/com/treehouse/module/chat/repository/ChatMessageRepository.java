package com.treehouse.module.chat.repository;

import com.treehouse.module.chat.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * 拉两个用户之间的历史消息（双向，按时间正序）
     */
    @Query("SELECT m FROM ChatMessage m WHERE " +
            "((m.fromUserId = :a AND m.toUserId = :b) OR (m.fromUserId = :b AND m.toUserId = :a)) " +
            "AND (m.expiredAt IS NULL OR m.expiredAt > :now) " +
            "ORDER BY m.createTime ASC, m.id ASC")
    List<ChatMessage> findHistory(@Param("a") Long a, @Param("b") Long b, @Param("now") LocalDateTime now, Pageable pageable);

    /**
     * 拉两个用户之间的历史消息 - 倒序（取最近 N 条翻页用）
     */
    @Query("SELECT m FROM ChatMessage m WHERE " +
            "((m.fromUserId = :a AND m.toUserId = :b) OR (m.fromUserId = :b AND m.toUserId = :a)) " +
            "AND (m.expiredAt IS NULL OR m.expiredAt > :now) " +
            "ORDER BY m.createTime DESC, m.id DESC")
    List<ChatMessage> findHistoryDesc(@Param("a") Long a, @Param("b") Long b, @Param("now") LocalDateTime now, Pageable pageable);

    /**
     * 未读数 = 我作为收件人 + 未读时间之前 的消息数
     */
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.toUserId = :me AND m.readAt IS NULL AND (m.expiredAt IS NULL OR m.expiredAt > :now)")
    long countUnread(@Param("me") Long me, @Param("now") LocalDateTime now);

    /**
     * 标记我接收的消息为已读
     */
    @Modifying
    @Query("UPDATE ChatMessage m SET m.readAt = :now WHERE m.toUserId = :me AND m.readAt IS NULL")
    int markRead(@Param("me") Long me, @Param("now") LocalDateTime now);
}
