package com.treehouse.module.chat.repository;

import com.treehouse.module.chat.entity.ChatSession;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {

    /**
     * 找两个用户之间的会话（不区分 A/B）
     */
    @Query("SELECT s FROM ChatSession s WHERE " +
            "(s.userAId = :a AND s.userBId = :b) OR (s.userAId = :b AND s.userBId = :a)")
    Optional<ChatSession> findByPair(@Param("a") Long a, @Param("b") Long b);

    /**
     * 我作为 A 的所有会话（按最后消息时间倒序）
     */
    @Query("SELECT s FROM ChatSession s WHERE s.userAId = :me AND s.userADeleted = 0 ORDER BY s.lastMsgAt DESC NULLS LAST, s.id DESC")
    List<ChatSession> findAsA(@Param("me") Long me, Pageable pageable);

    /**
     * 我作为 B 的所有会话
     */
    @Query("SELECT s FROM ChatSession s WHERE s.userBId = :me AND s.userBDeleted = 0 ORDER BY s.lastMsgAt DESC NULLS LAST, s.id DESC")
    List<ChatSession> findAsB(@Param("me") Long me, Pageable pageable);

    /**
     * 我所有未删除会话（Union of A/B，按时间倒序，代码里 merge）
     */
    @Query("SELECT s FROM ChatSession s WHERE s.userAId = :me OR s.userBId = :me ORDER BY s.lastMsgAt DESC NULLS LAST, s.id DESC")
    List<ChatSession> findAllMine(@Param("me") Long me, Pageable pageable);

    /**
     * 未读数自增
     */
    @Modifying
    @Query("UPDATE ChatSession s SET s.userAUnread = s.userAUnread + 1 WHERE s.id = :id")
    int bumpAUnread(@Param("id") Long id);

    @Modifying
    @Query("UPDATE ChatSession s SET s.userBUnread = s.userBUnread + 1 WHERE s.id = :id")
    int bumpBUnread(@Param("id") Long id);

    @Modifying
    @Query("UPDATE ChatSession s SET s.userAUnread = 0 WHERE s.id = :id")
    int clearAUnread(@Param("id") Long id);

    @Modifying
    @Query("UPDATE ChatSession s SET s.userBUnread = 0 WHERE s.id = :id")
    int clearBUnread(@Param("id") Long id);
}
