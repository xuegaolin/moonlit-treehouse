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
import javax.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 木鱼敲击记录（t_mokugyo_log）
 *
 * <p>每日上限 100 次（DB 层不加约束，由 Service 校验）。
 * 用户累计功德（totalMerit）落库时算。</p>
 */
@Data
@Entity
@Table(name = "t_mokugyo_log", indexes = {
        @Index(name = "idx_user_day", columnList = "user_id, day"),
        @Index(name = "idx_user_create", columnList = "user_id, create_time")
})
@SQLDelete(sql = "UPDATE t_mokugyo_log SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class MokugyoLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 本次上报敲击次数（批量） */
    @Column(name = "count", nullable = false)
    private Integer count;

    /** 用户累计功德（落库时算） */
    @Column(name = "total_merit", nullable = false)
    private Long totalMerit;

    /** 敲击日期（按天统计每日上限） */
    @Column(name = "day", nullable = false)
    private LocalDate day;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
        if (this.day == null) {
            this.day = this.createTime.toLocalDate();
        }
    }
}
