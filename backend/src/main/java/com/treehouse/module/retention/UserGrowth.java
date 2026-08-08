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
 * 用户成长档（t_user_growth）：连续天数、累计天数、最长纪录。
 *
 * <p>并发保障：UNIQUE KEY uk_user(user_id) 保证单用户单行；
 * 计数更新走 Repository 里的原子 SQL（UPDATE ... SET x = x + 1），不做读-改-写。</p>
 */
@Data
@Entity
@Table(name = "t_user_growth")
@SQLDelete(sql = "UPDATE t_user_growth SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class UserGrowth {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** 当前连续签到天数 */
    @Column(name = "current_streak", nullable = false)
    private Integer currentStreak = 0;

    /** 历史最长连续天数 */
    @Column(name = "max_streak", nullable = false)
    private Integer maxStreak = 0;

    /** 累计签到天数 */
    @Column(name = "total_checkin_days", nullable = false)
    private Integer totalCheckinDays = 0;

    @Column(name = "last_checkin_date")
    private LocalDate lastCheckinDate;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createTime == null) {
            createTime = now;
        }
        updateTime = now;
    }
}
