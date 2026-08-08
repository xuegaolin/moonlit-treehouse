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
 * 好友关系（t_chat_friend，v1.5）
 *
 * <p>状态机：</p>
 * <ul>
 *   <li>PENDING — A 加 B，待 B 确认</li>
 *   <li>ACCEPTED — 双方好友</li>
 *   <li>BLOCKED — A 拉黑 B（单向，A 看不到 B 的消息）</li>
 * </ul>
 *
 * <p>注意：每条记录是单向的（A→B 一条、B→A 一条），加好友时插两条记录（A 加 B 时插 user_id=A,friend_id=B；B 接受时插 user_id=B,friend_id=A）。
 * 这样读"我的好友"只要查 user_id=? AND status=ACCEPTED 即可。</p>
 */
@Data
@Entity
@Table(name = "t_chat_friend",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_friend_pair", columnNames = {"user_id", "friend_id"})
        },
        indexes = {
                @Index(name = "idx_user_status", columnList = "user_id, status")
        })
@SQLDelete(sql = "UPDATE t_chat_friend SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class ChatFriend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "friend_id", nullable = false)
    private Long friendId;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "PENDING";

    @Column(name = "remark", length = 50)
    private String remark;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time", nullable = false)
    private LocalDateTime updateTime;
}
