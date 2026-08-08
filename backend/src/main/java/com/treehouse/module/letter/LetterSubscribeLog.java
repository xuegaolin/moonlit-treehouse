package com.treehouse.module.letter;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * 深夜信箱订阅消息推送日志（t_letter_subscribe_log）
 *
 * <p>对应 8/6 新增的 V5 DDL。一封信一条 log，状态机：</p>
 * <pre>
 *   PENDING (已授权未投递)
 *      ├──> PUSHED  (deliverDueLetters 成功调 sendSubscribeMessage)
 *      ├──> EXPIRED (deliverDueLetters 时发现 push_token 已过 30 天)
 *      └──> FAILED  (推送被微信拒绝，记录 errcode/errmsg)
 * </pre>
 *
 * <p>硬约束：</p>
 * <ul>
 *   <li>letter_id UK：同一封信只能入库一次（前端重试 / 网络重发都被 DB 拦住）</li>
 *   <li>push_token 30 天过期，expire_at 必填</li>
 *   <li>dev 环境下 openid / template_id / push_token 都可为空，状态保持 PENDING</li>
 * </ul>
 */
@Data
@Entity
@Table(name = "t_letter_subscribe_log")
public class LetterSubscribeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 信件编号 L-yyyyMMdd-xxxx（与 t_letter.letter_no 对齐） */
    @Column(name = "letter_id", length = 32, nullable = false, unique = true)
    private String letterId;

    /** 用户 openid（dev 模拟时为空） */
    @Column(name = "openid", length = 64)
    private String openid;

    /** 微信订阅消息 template_id */
    @Column(name = "template_id", length = 64)
    private String templateId;

    /** wx.requestSubscribeMessage 返回的 push_token（30 天有效） */
    @Column(name = "push_token", length = 128)
    private String pushToken;

    /** PENDING / PUSHED / EXPIRED / FAILED */
    @Column(name = "status", length = 16, nullable = false)
    private String status = "PENDING";

    /** push_token 过期时间 = create_time + 30 day */
    @Column(name = "expire_at")
    private LocalDateTime expireAt;

    /** 实际推送时间 */
    @Column(name = "pushed_at")
    private LocalDateTime pushedAt;

    /** 微信 errcode（仅 FAILED 时有值） */
    @Column(name = "error_code", length = 32)
    private String errorCode;

    /** 微信 errmsg（仅 FAILED 时有值） */
    @Column(name = "error_msg", length = 255)
    private String errorMsg;

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
