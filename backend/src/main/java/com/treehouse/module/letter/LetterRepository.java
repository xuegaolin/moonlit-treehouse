package com.treehouse.module.letter;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 深夜信箱仓库
 */
@Repository
public interface LetterRepository extends JpaRepository<Letter, Long> {

    /** 用户信件分页（可选状态过滤） */
    Page<Letter> findByUserIdAndStatusOrderByCreateTimeDesc(Long userId, String status, Pageable pageable);

    Page<Letter> findByUserIdOrderByCreateTimeDesc(Long userId, Pageable pageable);

    /** 单封详情（校验归属） */
    Letter findByIdAndUserId(Long id, Long userId);

    /** 按编号 + 用户查（避免 findOwned 全表扫的兜底） */
    Letter findByLetterNoAndUserId(String letterNo, Long userId);

    /** 编号查重（生成信件编号用） */
    boolean existsByLetterNo(String letterNo);

    /** 当日全站信件数量（生成编号序号用） */
    @Query("SELECT COUNT(l) FROM Letter l WHERE l.createTime BETWEEN :start AND :end")
    long countByCreateTimeBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** 扫描到期的待送信件（定时任务用） */
    @Query("SELECT l FROM Letter l WHERE l.status = 'PENDING' AND l.deliverAt <= :now ORDER BY l.deliverAt ASC")
    List<Letter> findDueLetters(@Param("now") LocalDateTime now);
}
