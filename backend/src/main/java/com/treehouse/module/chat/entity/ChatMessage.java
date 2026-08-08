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
import java.time.LocalDateTime;

/**
 * 聊天消息（t_chat_message，v1.5）
 *
 * <p>设计要点：</p>
 * <ul>
 *   <li>{@code content} 存原文（合规要求——可被审查）</li>
 *   <li>{@code audited} + {@code auditResult} 记录审核结果</li>
 *   <li>{@code expiredAt} 按用户隐私设置计算（7/30/90/永久）</li>
 *   <li>删除走软删除（@SQLDelete），保留可追溯性</li>
 * </ul>
 */
@Data
@Entity
@Table(name = "t_chat_message", indexes = {
        @Index(name = "idx_from_create", columnList = "from_user_id, create_time"),
        @Index(name = "idx_to_create", columnList = "to_user_id, create_time"),
        @Index(name = "idx_expire", columnList = "expired_at")
})
@SQLDelete(sql = "UPDATE t_chat_message SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_user_id", nullable = false)
    private Long fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private Long toUserId;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /** TEXT / IMAGE / SYSTEM */
    @Column(name = "msg_type", length = 20, nullable = false)
    private String msgType = "TEXT";

    /** 0=未审 1=通过 */
    @Column(name = "audited", nullable = false)
    private Integer audited = 0;

    /** PASS / REJECT / REVIEW */
    @Column(name = "audit_result", length = 20)
    private String auditResult;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "expired_at")
    private LocalDateTime expiredAt;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;
}
