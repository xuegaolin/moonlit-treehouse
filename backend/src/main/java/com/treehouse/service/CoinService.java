package com.treehouse.service;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.CoinAccount;
import com.treehouse.entity.CoinTransaction;
import com.treehouse.repository.CoinAccountRepository;
import com.treehouse.repository.CoinTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 月光币服务
 *
 * <p>跨模块积分：钱包余额、入账/消费、每日获取上限控制。
 * 所有变动同时写流水（t_coin_log），余额与流水一一对应。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CoinService {

    private final CoinAccountRepository accountRepository;
    private final CoinTransactionRepository transactionRepository;

    /** 每日获取上限（与 API 规范 todayLimit 对齐） */
    @Value("${treehouse.coin.daily-earn-limit:100}")
    private int dailyEarnLimit;

    /**
     * 初始化钱包（新用户注册时调用）
     */
    @Transactional(rollbackFor = Exception.class)
    public void initWallet(Long userId) {
        accountRepository.findByUserId(userId).orElseGet(() -> {
            CoinAccount account = new CoinAccount();
            account.setUserId(userId);
            account.setBalance(0);
            return accountRepository.save(account);
        });
    }

    /**
     * 查询钱包（不存在则兜底初始化）
     */
    public CoinAccount getWallet(Long userId) {
        return accountRepository.findByUserId(userId).orElseGet(() -> {
            CoinAccount account = new CoinAccount();
            account.setUserId(userId);
            account.setBalance(0);
            return accountRepository.save(account);
        });
    }

    /**
     * 变动月光币（正入负出），同时写流水
     *
     * @param userId 用户 ID
     * @param delta  变动数量：正-入账，负-消费
     * @param reason 变动原因（业务码，如 SIGN_IN / BAILAN_LICENSE）
     * @param bizId  关联业务 ID（可空）
     * @return 变动后的余额
     * @throws BizException 余额不足或超过每日获取上限时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public int change(Long userId, int delta, String reason, String bizId) {
        CoinAccount account = getWallet(userId);

        if (delta > 0) {
            // 入账：校验每日获取上限
            int earnedToday = todayEarned(userId);
            if (earnedToday + delta > dailyEarnLimit) {
                throw new BizException(ResultCode.TOO_FREQUENT.getCode(), "今日月光币获取已达上限");
            }
        } else {
            // 消费：校验余额
            if (account.getBalance() + delta < 0) {
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "月光币余额不足");
            }
        }

        account.setBalance(account.getBalance() + delta);
        accountRepository.save(account);

        CoinTransaction tx = new CoinTransaction();
        tx.setUserId(userId);
        tx.setAmount(delta);
        tx.setType(reason);
        tx.setRefId(bizId);
        tx.setBalanceAfter(account.getBalance());
        transactionRepository.save(tx);

        log.info("月光币变动：userId={}, delta={}, reason={}, balance={}", userId, delta, reason, account.getBalance());
        return account.getBalance();
    }

    /**
     * 今日已获取的月光币总额
     */
    public int todayEarned(Long userId) {
        LocalDateTime dayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime dayEnd = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
        return transactionRepository.sumIncomeBetween(userId, dayStart, dayEnd);
    }

    /**
     * 钱包视图：余额 + 今日已赚 + 每日上限（对齐 GET /coin/wallet 响应结构）
     */
    public Map<String, Object> walletView(Long userId) {
        CoinAccount account = getWallet(userId);
        Map<String, Object> view = new HashMap<>();
        view.put("balance", account.getBalance());
        view.put("todayEarned", todayEarned(userId));
        view.put("todayLimit", dailyEarnLimit);
        return view;
    }

    /**
     * 流水分页
     */
    public Page<CoinTransaction> logs(Long userId, int page, int size) {
        return transactionRepository.findByUserIdOrderByCreateTimeDesc(userId, PageRequest.of(page, size));
    }
}
