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
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 会员订单（t_membership）
 *
 * <p>对应技术架构文档 t_membership：level 取 MONTH/YEAR/LIFE，
 * 价格档对齐 PRD：19 元/月，128 元/年。</p>
 */
@Data
@Entity
@Table(name = "t_membership", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id")
})
public class MemberOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 会员档位：MONTH-月卡 YEAR-年卡 LIFE-终身 */
    @Column(name = "level", length = 20, nullable = false)
    private String level;

    /** 实付金额（元） */
    @Column(name = "price", precision = 10, scale = 2, nullable = false)
    private BigDecimal price;

    /** 会员生效时间 */
    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    /** 会员到期时间 */
    @Column(name = "expire_at", nullable = false)
    private LocalDateTime expireAt;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
