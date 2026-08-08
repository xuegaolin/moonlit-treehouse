package com.treehouse.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import java.time.LocalDateTime;

/**
 * 月光币钱包（t_coin_wallet）
 *
 * <p>一个用户一条记录，balance 为当前余额；变动明细见 {@link CoinTransaction}。</p>
 */
@Data
@Entity
@Table(name = "t_coin_wallet", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id", unique = true)
})
public class CoinAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** 当前余额 */
    @Column(name = "balance", nullable = false)
    private Integer balance = 0;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
        this.updateTime = this.createTime;
    }

    @PreUpdate
    public void preUpdate() {
        this.updateTime = LocalDateTime.now();
    }
}
