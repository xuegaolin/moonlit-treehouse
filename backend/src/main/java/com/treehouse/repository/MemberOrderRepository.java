package com.treehouse.repository;

import com.treehouse.entity.MemberOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 会员订单仓库
 */
@Repository
public interface MemberOrderRepository extends JpaRepository<MemberOrder, Long> {

    /** 用户的会员订单（按生效时间倒序） */
    List<MemberOrder> findByUserIdOrderByStartAtDesc(Long userId);
}
