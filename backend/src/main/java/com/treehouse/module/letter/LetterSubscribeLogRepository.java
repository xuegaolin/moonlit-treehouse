package com.treehouse.module.letter;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 订阅消息推送日志仓库
 */
@Repository
public interface LetterSubscribeLogRepository extends JpaRepository<LetterSubscribeLog, Long> {

    /** 按信件编号查（letter_id 是 UK，最多一条） */
    Optional<LetterSubscribeLog> findByLetterId(String letterId);

    /** 同一封信已存在则不再插入（前置判重，撞 UK 时 catch 兜底） */
    boolean existsByLetterId(String letterId);

    /**
     * 原子更新推送结果。
     *
     * <p>UPDATE + WHERE 条件限定 status='PENDING'，避免并发投递时多次重写记录。</p>
     */
    @Modifying
    @Query("UPDATE LetterSubscribeLog l SET l.status = :status, l.pushedAt = :pushedAt, " +
            "l.errorCode = :errorCode, l.errorMsg = :errorMsg, l.updateTime = :now " +
            "WHERE l.letterId = :letterId AND l.status = 'PENDING'")
    int markPushResult(@Param("letterId") String letterId,
                       @Param("status") String status,
                       @Param("pushedAt") LocalDateTime pushedAt,
                       @Param("errorCode") String errorCode,
                       @Param("errorMsg") String errorMsg,
                       @Param("now") LocalDateTime now);
}
