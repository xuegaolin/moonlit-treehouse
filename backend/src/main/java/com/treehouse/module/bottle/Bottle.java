package com.treehouse.module.bottle;

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
import javax.persistence.Table;
import java.time.LocalDateTime;

/**
 * 漂流墙瓶子（t_bottle）
 *
 * <p>audit_status 三态：内容安全审核中/通过/拒绝。
 * anonymous_id 落库即生成（路人-A7B3），永不暴露 user_id。
 * warm_count 冗余列，用于热度流排序避免实时 count。</p>
 */
@Data
@Entity
@Table(name = "t_bottle", indexes = {
        @Index(name = "idx_audit_create", columnList = "audit_status, create_time"),
        @Index(name = "idx_warm", columnList = "warm_count, create_time")
})
@SQLDelete(sql = "UPDATE t_bottle SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class Bottle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 投递人（匿名池里屏蔽展示） */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 瓶子编号：B-yyyyMMdd-NNNN */
    @Column(name = "bottle_no", length = 32, unique = true, nullable = false)
    private String bottleNo;

    /** 心事正文（已脱敏） */
    @Column(name = "content", length = 500, nullable = false)
    private String content;

    /** 情绪标签 JSON 数组 */
    @Column(name = "tags_json", length = 200)
    private String tagsJson;

    /** 匿名 ID：路人-A7B3 */
    @Column(name = "anonymous_id", length = 32, nullable = false)
    private String anonymousId;

    /** 被温暖次数 */
    @Column(name = "warm_count", nullable = false)
    private Integer warmCount = 0;

    /** 审核状态：PENDING/PASSED/REJECTED */
    @Column(name = "audit_status", length = 20, nullable = false)
    private String auditStatus = "PENDING";

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
