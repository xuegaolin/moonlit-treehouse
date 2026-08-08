package com.treehouse.module.chat.entity;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * 聊天会话（t_chat_session，v1.5）
 *
 * <p>2 人 1 会话，user_a_id < user_b_id（约定俗成避免重复）。</p>
 * <p>关键字段：</p>
 * <ul>
 *   <li>last_msg_* — 会话列表展示用，避免 N+1</li>
 *   <li>user_a/b_unread — 未读数（每次发消息 +1，读消息清零）</li>
 *   <li>user_a/b_deleted — 双删除，A 删了 A 看不到但 B 仍可见</li>
 * </ul>
 */
@Data
@Entity
@Table(name = "t_chat_session",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_session_pair", columnNames = {"user_a_id", "user_b_id"})
        },
        indexes = {
                @Index(name = "idx_user_a", columnList = "user_a_id, last_msg_at"),
                @Index(name = "idx_user_b", columnList = "user_b_id, last_msg_at")
        })
@SQLDelete(sql = "UPDATE t_chat_session SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class ChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_a_id", nullable = false)
    private Long userAId;

    @Column(name = "user_b_id", nullable = false)
    private Long userBId;

    @Column(name = "last_msg_id")
    private Long lastMsgId;

    @Column(name = "last_msg_preview", length = 100)
    private String lastMsgPreview;

    @Column(name = "last_msg_at")
    private LocalDateTime lastMsgAt;

    @Column(name = "user_a_unread", nullable = false)
    private Integer userAUnread = 0;

    @Column(name = "user_b_unread", nullable = false)
    private Integer userBUnread = 0;

    @Column(name = "user_a_deleted", nullable = false)
    private Integer userADeleted = 0;

    @Column(name = "user_b_deleted", nullable = false)
    private Integer userBDeleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time", nullable = false)
    private LocalDateTime updateTime;

    /** 找"我"在 session 里是哪一边（返回 'a' 或 'b'） */
    public String side(Long myUserId) {
        return myUserId.equals(userAId) ? "a" : "b";
    }

    public Long peerId(Long myUserId) {
        return myUserId.equals(userAId) ? userBId : userAId;
    }

    public boolean isDeletedBy(Long myUserId) {
        return myUserId.equals(userAId) ? userADeleted == 1 : userBDeleted == 1;
    }

    public Integer myUnread(Long myUserId) {
        return myUserId.equals(userAId) ? userAUnread : userBUnread;
    }
}
