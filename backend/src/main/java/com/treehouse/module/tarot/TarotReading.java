package com.treehouse.module.tarot;

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
import javax.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * 塔罗占卜记录（t_tarot_reading）
 *
 * <p>一次抽牌 = 一条记录。spread_type：
 * <ul>
 *   <li>DAILY        每日一抽（限次：UNIQUE(user_id, draw_date)）</li>
 *   <li>THREE_CARDS  三牌阵（过去/现在/未来）</li>
 * </ul>
 * cardsJson 形如：[{"cardId":19,"name":"太阳","position":"upright","keywords":["希望","热情"]},...]</p>
 */
@Data
@Entity
@Table(name = "t_tarot_reading",
        uniqueConstraints = {
                // 每日一抽限定：UNIQUE(user_id, spread_type='DAILY', draw_date) → 防双开双抽
                // 用三列复合 UK，THREE_CARDS 不受影响（spread_type 不同）
                @UniqueConstraint(name = "uk_user_spread_day",
                                  columnNames = {"user_id", "spread_type", "draw_date"})
        },
        indexes = {
                @Index(name = "idx_user_drawdate", columnList = "user_id, draw_date"),
                @Index(name = "idx_user_create", columnList = "user_id, create_time")
        })
@SQLDelete(sql = "UPDATE t_tarot_reading SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class TarotReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 占卜编号：T-yyyyMMdd-NNNN */
    @Column(name = "reading_no", length = 32, unique = true, nullable = false)
    private String readingNo;

    /** 牌阵：DAILY / THREE_CARDS */
    @Column(name = "spread_type", length = 20, nullable = false)
    private String spreadType;

    /** 用户问题（仅三牌阵） */
    @Column(name = "question", length = 500)
    private String question;

    /** 抽中牌 JSON 数组 */
    @Column(name = "cards_json", length = 1000, nullable = false)
    private String cardsJson;

    /** 30 字短解读 */
    @Column(name = "short_interp", length = 500, nullable = false)
    private String shortInterp;

    /** 200 字完整解读（解锁后填） */
    @Column(name = "full_interp", columnDefinition = "TEXT")
    private String fullInterp;

    /** 建议 JSON 数组 */
    @Column(name = "advice_json", length = 500)
    private String adviceJson;

    /** 幸运色 */
    @Column(name = "lucky_color", length = 20)
    private String luckyColor;

    /** 幸运数字 */
    @Column(name = "lucky_number")
    private Integer luckyNumber;

    /** 推荐歌曲（占位） */
    @Column(name = "song_url", length = 500)
    private String songUrl;

    /** 解锁价格（分），默认 990 = 9.9 元 */
    @Column(name = "unlock_price", nullable = false)
    private Integer unlockPrice = 990;

    /** 是否已解锁 */
    @Column(name = "unlocked", nullable = false)
    private Integer unlocked = 0;

    /** 解锁订单号 */
    @Column(name = "order_id", length = 32)
    private String orderId;

    /** 抽签日期（每日一抽限定） */
    @Column(name = "draw_date", nullable = false)
    private java.time.LocalDate drawDate;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
        if (this.drawDate == null) {
            this.drawDate = this.createTime.toLocalDate();
        }
    }
}
