package com.treehouse.module.bottle;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BottleRepository extends JpaRepository<Bottle, Long> {
    boolean existsByBottleNo(String bottleNo);
    Optional<Bottle> findByBottleNo(String bottleNo);

    /** 信息流（按时间倒序） */
    Page<Bottle> findByAuditStatusOrderByCreateTimeDesc(String auditStatus, Pageable pageable);

    /** 信息流（按热度） */
    Page<Bottle> findByAuditStatusOrderByWarmCountDescCreateTimeDesc(String auditStatus, Pageable pageable);

    /** 按标签筛（简化版：JSON 包含） */
    Page<Bottle> findByAuditStatusAndTagsJsonContainingOrderByCreateTimeDesc(
            String auditStatus, String tag, Pageable pageable);

    @Query("SELECT COUNT(b) FROM Bottle b WHERE b.createTime BETWEEN :start AND :end")
    long countByCreateTimeBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /**
     * 原子累加 warm_count（并发安全）
     * 使用 JPQL UPDATE，避免读-改-写的 TOCTOU 竞争。
     */
    @Modifying
    @Query("UPDATE Bottle b SET b.warmCount = b.warmCount + 1 WHERE b.id = :id")
    int incrWarmCount(@Param("id") Long id);
}
