package com.treehouse.module.bottle;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

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
 * 温暖记录（t_bottle_warm）
 *
 * <p>UNIQUE(bottle_id, user_id) 保证同一人对同一瓶子只温暖一次。</p>
 */
@Data
@Entity
@Table(name = "t_bottle_warm", indexes = {
        @Index(name = "idx_user_create", columnList = "user_id, create_time")
})
@SQLDelete(sql = "UPDATE t_bottle_warm SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class BottleWarm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bottle_id", nullable = false)
    private Long bottleId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 礼物类型：hug / candy / candle */
    @Column(name = "gift_type", length = 20, nullable = false)
    private String giftType;

    /** 花费月光币 */
    @Column(name = "coin_cost", nullable = false)
    private Integer coinCost = 0;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
