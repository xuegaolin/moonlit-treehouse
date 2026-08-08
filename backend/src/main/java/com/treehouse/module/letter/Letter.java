package com.treehouse.module.letter;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * 深夜信箱（t_letter）
 *
 * <p>写信 / 定时送达 / AI 回信。content 以 AES 密文存储，
 * 解密密钥来自 wechat.letter.aes-key。status 状态机：</p>
 * <pre>
 *   PENDING → DELIVERED → (可选) REPLIED
 *      │           │
 *      └─→ CANCELED (未到时撤回)
 * </pre>
 */
@Data
@Entity
@Table(name = "t_letter", indexes = {
        @Index(name = "idx_user_status", columnList = "user_id, status"),
        @Index(name = "idx_deliver_at", columnList = "deliver_at"),
        @Index(name = "idx_letter_no", columnList = "letter_no", unique = true)
})
@SQLDelete(sql = "UPDATE t_letter SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class Letter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 信件编号：L-yyyyMMdd-0001 */
    @Column(name = "letter_no", length = 32, unique = true, nullable = false)
    private String letterNo;

    /** 收信人类型：self_future / self_now / missed_one / stranger */
    @Column(name = "receiver_type", length = 20, nullable = false)
    private String receiverType;

    /** 信件正文（AES 密文） */
    @Column(name = "content", length = 4000, nullable = false)
    private String content;

    /** 信封样式编码：default / kraft / sakura */
    @Column(name = "envelope_code", length = 20, nullable = false)
    private String envelopeCode = "default";

    /** 是否启用 AI 回信 */
    @Column(name = "ai_enabled", nullable = false)
    private Integer aiEnabled = 0;

    /** AI 人设：SISTER / BESTIE / PROF / BUDDHA / STAR */
    @Column(name = "ai_persona", length = 20)
    private String aiPersona;

    /** AI 回信内容（明文） */
    @Column(name = "ai_reply", length = 2000)
    private String aiReply;

    /** 公开到漂流墙：0-否 1-是 */
    @Column(name = "public_to_wall", nullable = false)
    private Integer publicToWall = 0;

    /** 投递时间 */
    @Column(name = "deliver_at", nullable = false)
    private LocalDateTime deliverAt;

    /** 实际送达时间 */
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    /** 状态：PENDING / DELIVERED / REPLIED / CANCELED */
    @Column(name = "status", length = 20, nullable = false)
    private String status = "PENDING";

    /** 软删除标记 */
    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
        this.updateTime = this.createTime;
    }
}
