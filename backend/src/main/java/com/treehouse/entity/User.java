package com.treehouse.entity;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import java.time.LocalDateTime;

/**
 * 用户实体（t_user）
 *
 * <p>对应技术架构文档 t_user：openid 为唯一登录标识；
 * memberExpireAt 非空且未过期即为会员。</p>
 */
@Data
@Entity
@Table(name = "t_user", indexes = {
        @Index(name = "idx_openid", columnList = "openid"),
        @Index(name = "idx_unionid", columnList = "unionid")
})
@SQLDelete(sql = "UPDATE t_user SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 微信 openid（唯一登录标识） */
    @Column(name = "openid", length = 64, unique = true, nullable = false)
    private String openid;

    /** 微信 unionid（同一开放平台下唯一，可为空） */
    @Column(name = "unionid", length = 64)
    private String unionid;

    /** 昵称 */
    @Column(name = "nickname", length = 100)
    private String nickname;

    /** 头像 URL */
    @Column(name = "avatar", length = 500)
    private String avatar;

    /** 会员到期时间；null 表示从未开通过会员 */
    @Column(name = "member_expire_at")
    private LocalDateTime memberExpireAt;

    /** 最后登录时间 */
    @Column(name = "last_login_time")
    private LocalDateTime lastLoginTime;

    /** 状态：0-正常 1-禁用 */
    @Column(name = "status", nullable = false)
    private Integer status = 0;

    /** 是否已实名认证（微信一键实名 / 后台人工实名）
     * <p>v1.5 合规：未实名用户不能发布内容（漂流瓶 / 信件 / 留言 / 聊天）</p> */
    @Column(name = "real_name_verified", nullable = false)
    private Integer realNameVerified = 0;

    /** 是否开放聊天（默认 0 / 付费用户可开启）
     * <p>v1.5 付费社交：免费用户走树洞匿名路线，付费用户可开聊</p> */
    @Column(name = "chat_enabled", nullable = false)
    private Integer chatEnabled = 0;

    /** 是否开放加好友（默认 0 / 付费用户可开启） */
    @Column(name = "friend_enabled", nullable = false)
    private Integer friendEnabled = 0;

    /** 聊天记录保存天数：7 / 30 / 90 / -1（永久）
     * <p>v1.5 用户自选：7 免费、30 收费 5 币、90 收费 15 币、永久 收费 50 币/月</p> */
    @Column(name = "chat_history_keep_days", nullable = false)
    private Integer chatHistoryKeepDays = 7;

    /** 软删除标记：0-正常 1-已删除 */
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

    @PreUpdate
    public void preUpdate() {
        this.updateTime = LocalDateTime.now();
        // v1.5 合规铁律：取消实名 = 自动关闭社交开关
        // 防止用户「先开聊 → 取消实名 → 仍能收消息」的安全隐患
        if (this.realNameVerified == null || this.realNameVerified != 1) {
            this.chatEnabled = 0;
            this.friendEnabled = 0;
        }
    }
}
