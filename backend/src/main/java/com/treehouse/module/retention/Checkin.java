package com.treehouse.module.retention;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 每日签到记录（t_checkin）。
 *
 * <p>并发保障：DB 层 UNIQUE KEY uk_user_date(user_id, checkin_date)。
 * 重复签到由数据库拒绝，Service 捕获 DataIntegrityViolationException 判定为"今日已签"，
 * 不依赖应用层 exists 预检（那是 TOCTOU 竞态）。</p>
 */
@Data
@Entity
@Table(name = "t_checkin")
@SQLDelete(sql = "UPDATE t_checkin SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class Checkin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 签到自然日 */
    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    /** 本次签到后的连续天数（快照，便于回溯） */
    @Column(name = "streak_days", nullable = false)
    private Integer streakDays = 1;

    /** 本次获得月光币 */
    @Column(name = "coin_reward", nullable = false)
    private Integer coinReward = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @PrePersist
    public void prePersist() {
        if (createTime == null) {
            createTime = LocalDateTime.now();
        }
    }
}
