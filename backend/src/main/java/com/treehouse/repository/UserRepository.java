package com.treehouse.repository;

import com.treehouse.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 用户仓库
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** 按 openid 查用户（软删除记录已被 @Where 过滤） */
    Optional<User> findByOpenid(String openid);
}
