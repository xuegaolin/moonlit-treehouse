package com.treehouse.module.retention;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface UserGrowthRepository extends JpaRepository<UserGrowth, Long> {

    Optional<UserGrowth> findByUserId(Long userId);

    /**
     * 原子推进连续天数（避免读-改-写 TOCTOU）。
     *
     * <p>逻辑全部在 SQL 内完成：
     * <ul>
     *   <li>连续：last_checkin_date = 昨天 → current_streak + 1</li>
     *   <li>断签：其他情况 → current_streak 重置为 1</li>
     *   <li>max_streak 取 GREATEST，累计天数 +1</li>
     * </ul>
     * 仅当 last_checkin_date 不等于今天时才更新，天然幂等：
     * 并发重复调用只有第一条生效，返回受影响行数 0 即表示今天已处理过。</p>
     *
     * @return 受影响行数（1=本次推进成功，0=今日已处理）
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE t_user_growth SET "
            + "current_streak = CASE WHEN last_checkin_date = DATE_SUB(:today, INTERVAL 1 DAY) "
            + "                      THEN current_streak + 1 ELSE 1 END, "
            + "max_streak = GREATEST(max_streak, "
            + "                      CASE WHEN last_checkin_date = DATE_SUB(:today, INTERVAL 1 DAY) "
            + "                           THEN current_streak + 1 ELSE 1 END), "
            + "total_checkin_days = total_checkin_days + 1, "
            + "last_checkin_date = :today, "
            + "update_time = NOW() "
            + "WHERE user_id = :userId AND deleted = 0 "
            + "AND (last_checkin_date IS NULL OR last_checkin_date <> :today)",
            nativeQuery = true)
    int advanceStreak(@Param("userId") Long userId, @Param("today") LocalDate today);
}
