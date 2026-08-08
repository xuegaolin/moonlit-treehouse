package com.treehouse.repository;

import com.treehouse.entity.CoinAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 月光币钱包仓库
 */
@Repository
public interface CoinAccountRepository extends JpaRepository<CoinAccount, Long> {

    /** 按用户 ID 查钱包 */
    Optional<CoinAccount> findByUserId(Long userId);
}
