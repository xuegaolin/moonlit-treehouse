package com.treehouse.module.wish;

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
 * 许愿（t_wish）
 *
 * <p>状态机：OPEN → ACHIEVED/CLOSED/EXPIRED。
 * tapCount 累计木鱼敲击功德（来自 t_mokugyo_log 同步）。</p>
 */
@Data
@Entity
@Table(name = "t_wish", indexes = {
        @Index(name = "idx_user_status", columnList = "user_id, status"),
        @Index(name = "idx_user_create", columnList = "user_id, create_time")
})
@SQLDelete(sql = "UPDATE t_wish SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class Wish {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 许愿人 */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 愿望编号 W-yyyyMMdd-NNNN */
    @Column(name = "wish_no", length = 32, unique = true, nullable = false)
    private String wishNo;

    /** 分类：study/career/love/health/other */
    @Column(name = "category", length = 20, nullable = false)
    private String category;

    /** 愿望内容 */
    @Column(name = "content", length = 500, nullable = false)
    private String content;

    /** 期望实现时间 */
    @Column(name = "expect_at")
    private LocalDateTime expectAt;

    /** 公开到漂流墙 */
    @Column(name = "public_to_wall", nullable = false)
    private Integer publicToWall = 0;

    /** 状态：OPEN / ACHIEVED / CLOSED / EXPIRED */
    @Column(name = "status", length = 20, nullable = false)
    private String status = "OPEN";

    /** 是否实现（结愿时填） */
    @Column(name = "achieved")
    private Integer achieved;

    /** 结愿时的月光祝福 */
    @Column(name = "blessing", columnDefinition = "TEXT")
    private String blessing;

    /** 累计木鱼敲击（功德 +N） */
    @Column(name = "tap_count", nullable = false)
    private Integer tapCount = 0;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time", nullable = false)
    private LocalDateTime updateTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
        this.updateTime = this.createTime;
    }

    @PreUpdate
    public void preUpdate() {
        this.updateTime = LocalDateTime.now();
    }
}
