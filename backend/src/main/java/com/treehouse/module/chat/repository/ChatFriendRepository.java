package com.treehouse.module.chat.repository;

import com.treehouse.module.chat.entity.ChatFriend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatFriendRepository extends JpaRepository<ChatFriend, Long> {

    Optional<ChatFriend> findByUserIdAndFriendId(Long userId, Long friendId);

    /** 我所有已接受的好友 */
    @Query("SELECT f FROM ChatFriend f WHERE f.userId = :me AND f.status = 'ACCEPTED' ORDER BY f.createTime DESC")
    List<ChatFriend> findAccepted(@Param("me") Long me);

    /** 我发出的待处理请求 */
    @Query("SELECT f FROM ChatFriend f WHERE f.userId = :me AND f.status = 'PENDING'")
    List<ChatFriend> findPendingFromMe(@Param("me") Long me);

    /** 我收到的待处理请求（别人加我） */
    @Query("SELECT f FROM ChatFriend f WHERE f.friendId = :me AND f.status = 'PENDING'")
    List<ChatFriend> findPendingToMe(@Param("me") Long me);

    @Modifying
    @Query("UPDATE ChatFriend f SET f.status = :status WHERE f.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") String status);
}
