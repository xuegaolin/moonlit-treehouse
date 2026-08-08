package com.treehouse.module.bailan;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 摆烂许可证仓库
 */
@Repository
public interface BailanLicenseRepository extends JpaRepository<BailanLicense, Long> {

    /** 用户某时间段的许可证（查"今天是否已领"） */
    List<BailanLicense> findByUserIdAndCreateTimeBetween(Long userId, LocalDateTime start, LocalDateTime end);

    /** 用户许可证分页（按时间倒序） */
    Page<BailanLicense> findByUserIdOrderByCreateTimeDesc(Long userId, Pageable pageable);

    /** 用户全部许可证（算连续打卡天数用，MVP 数据量小直接全量） */
    List<BailanLicense> findByUserIdOrderByCreateTimeDesc(Long userId);

    /** 今日全站发放数量（生成当日序号用） */
    long countByCreateTimeBetween(LocalDateTime start, LocalDateTime end);

    /** 判断编号是否已存在（并发编号重试用） */
    boolean existsByLicenseNo(String licenseNo);
}
