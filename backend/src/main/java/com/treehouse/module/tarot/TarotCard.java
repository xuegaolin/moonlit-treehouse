package com.treehouse.module.tarot;

import lombok.Data;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import java.time.LocalDateTime;

/**
 * 塔罗牌（t_tarot_card）
 *
 * <p>78 张牌基础数据，DB seed 已落（见 docs/06-content/db-schema.sql）。
 * MVP 抽牌时随机选择；v1.x 可扩展逆位概率、用户偏好权重等。</p>
 */
@Data
@Entity
@Table(name = "t_tarot_card")
@SQLDelete(sql = "UPDATE t_tarot_card SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class TarotCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 大/小阿卡纳：MAJOR / MINOR */
    @Column(name = "arcana", length = 10, nullable = false)
    private String arcana;

    /** 小阿卡纳花色：WANDS / CUPS / SWORDS / PENTACLES（MAJOR 时为 NULL） */
    @Column(name = "suit", length = 10)
    private String suit;

    /** 牌序号（0-21 大，1-14 小） */
    @Column(name = "number", nullable = false)
    private Integer number;

    /** 中文名 */
    @Column(name = "name_cn", length = 50, nullable = false)
    private String nameCn;

    /** 英文名 */
    @Column(name = "name_en", length = 50, nullable = false)
    private String nameEn;

    /** 正位关键词（逗号分隔） */
    @Column(name = "upright_kw", length = 200, nullable = false)
    private String uprightKw;

    /** 逆位关键词 */
    @Column(name = "reversed_kw", length = 200, nullable = false)
    private String reversedKw;

    /** 牌面图（可选） */
    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
