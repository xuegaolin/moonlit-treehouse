package com.treehouse.module.feature.entity;

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
 * 功能需求/留言（t_feature_request）
 *
 * <p>列名与 DDL 对齐：create_time / update_time（v1.5 改 created_at→create_time）</p>
 */
@Data
@Entity
@Table(name = "t_feature_request", indexes = {
        @Index(name = "idx_status_vote", columnList = "status, vote_count"),
        @Index(name = "idx_user_create", columnList = "user_id, create_time")
})
@SQLDelete(sql = "UPDATE t_feature_request SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class FeatureRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "title", length = 80, nullable = false)
    private String title;

    @Column(name = "description", length = 500, nullable = false)
    private String description;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "OPEN";

    @Column(name = "vote_count", nullable = false)
    private Integer voteCount = 0;

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
