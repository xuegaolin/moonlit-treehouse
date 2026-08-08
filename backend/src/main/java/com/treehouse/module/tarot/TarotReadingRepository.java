package com.treehouse.module.tarot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 塔罗占卜仓库
 */
@Repository
public interface TarotReadingRepository extends JpaRepository<TarotReading, Long> {

    /** 编号查重 */
    boolean existsByReadingNo(String readingNo);

    /** 今日是否已抽（每日一抽限次） */
    Optional<TarotReading> findByUserIdAndSpreadTypeAndDrawDate(Long userId, String spreadType, LocalDate drawDate);

    /** 用户历史占卜（按时间倒序） */
    List<TarotReading> findByUserIdOrderByCreateTimeDesc(Long userId);

    /** 编号查单条 */
    Optional<TarotReading> findByReadingNoAndUserId(String readingNo, Long userId);

    /** 当日全站占卜数（生成编号序号用） */
    long countByDrawDate(LocalDate drawDate);
}
