package com.treehouse.module.wish;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MokugyoLogRepository extends JpaRepository<MokugyoLog, Long> {
    /**
     * 今日敲击总次数（每日上限校验用）
     * 用 PESSIMISTIC_WRITE 行锁，事务内防止并发插入超过上限
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT COALESCE(SUM(m.count), 0) FROM MokugyoLog m WHERE m.userId = :userId AND m.day = :day")
    long sumCountByUserIdAndDayForUpdate(@Param("userId") Long userId,
                                          @Param("day") LocalDate day);

    /** 默认非加锁版本（仅用于查询/统计） */
    @Query("SELECT COALESCE(SUM(m.count), 0) FROM MokugyoLog m WHERE m.userId = :userId AND m.day = :day")
    long sumCountByUserIdAndDay(@Param("userId") Long userId,
                                @Param("day") LocalDate day);

    /** 用户全部木鱼记录（算累计功德） */
    List<MokugyoLog> findByUserIdOrderByCreateTimeDesc(Long userId);
}
