package com.treehouse.module.feature.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * 功能投票记录（t_feature_vote）
 *
 * <p>UNIQUE(user_id, feature_id) 保证每用户每 feature 1 票。
 * 投过票要改票 = DELETE 再 INSERT，事务保证一致。</p>
 */
@Data
@Entity
@Table(name = "t_feature_vote",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_feature", columnNames = {"user_id", "feature_id"})
        },
        indexes = {
                @Index(name = "idx_feature", columnList = "feature_id")
        })
public class FeatureVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "feature_id", nullable = false)
    private Long featureId;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
