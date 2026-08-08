package com.treehouse.repository;

import com.treehouse.entity.CoinTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * 月光币流水仓库
 */
@Repository
public interface CoinTransactionRepository extends JpaRepository<CoinTransaction, Long> {

    /** 用户流水分页（按时间倒序） */
    Page<CoinTransaction> findByUserIdOrderByCreateTimeDesc(Long userId, Pageable pageable);

    /** 统计用户某时间段内的入账总额（用于"今日已赚"） */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM CoinTransaction t "
            + "WHERE t.userId = :userId AND t.amount > 0 AND t.createTime BETWEEN :start AND :end")
    int sumIncomeBetween(@Param("userId") Long userId,
                         @Param("start") LocalDateTime start,
                         @Param("end") LocalDateTime end);
}
