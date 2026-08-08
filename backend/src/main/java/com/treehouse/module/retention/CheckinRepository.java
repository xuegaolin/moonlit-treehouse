package com.treehouse.module.retention;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CheckinRepository extends JpaRepository<Checkin, Long> {

    Optional<Checkin> findByUserIdAndCheckinDate(Long userId, LocalDate date);

    /** 最近 N 条签到记录（倒序），用于前端画签到日历 */
    List<Checkin> findTop31ByUserIdOrderByCheckinDateDesc(Long userId);

    /** 指定日期区间的签到日期列表 */
    @Query("SELECT c.checkinDate FROM Checkin c WHERE c.userId = :userId "
            + "AND c.checkinDate >= :from AND c.checkinDate <= :to ORDER BY c.checkinDate")
    List<LocalDate> findDatesBetween(@Param("userId") Long userId,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);

    long countByUserId(Long userId);
}
