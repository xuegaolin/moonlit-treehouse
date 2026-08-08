package com.treehouse.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import java.time.LocalDateTime;

/**
 * 月光币流水（t_coin_log）
 *
 * <p>delta 正为入账、负为消费；reason 如 SIGN_IN / BAILAN_LICENSE / GIFT_SEND 等。</p>
 */
@Data
@Entity
@Table(name = "t_coin_log", indexes = {
        @Index(name = "idx_user_create", columnList = "user_id, create_time")
})
public class CoinTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 变动数量：正-入账，负-支出 */
    @Column(name = "amount", nullable = false)
    private Integer amount;

    /** 变动原因（业务码） */
    @Column(name = "type", length = 20, nullable = false)
    private String type;

    /** 关联业务 ID（如许可证编号），可空 */
    @Column(name = "ref_id", length = 64)
    private String refId;

    /** 变动后的余额 */
    @Column(name = "balance_after", nullable = false)
    private Integer balanceAfter;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
