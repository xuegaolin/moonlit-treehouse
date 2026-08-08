package com.treehouse.module.retention;

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
 * 勋章获得记录（t_medal）。
 *
 * <p>并发保障：UNIQUE KEY uk_user_medal(user_id, medal_code) 保证同一勋章只发一次。
 * 并发重复颁发由 DB 拒绝，Service catch 后静默跳过。</p>
 */
@Data
@Entity
@Table(name = "t_medal")
@SQLDelete(sql = "UPDATE t_medal SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class Medal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 勋章编码，见 MedalCatalog */
    @Column(name = "medal_code", length = 40, nullable = false)
    private String medalCode;

    /** 勋章名称快照（后续改名不影响历史记录） */
    @Column(name = "medal_name", length = 60, nullable = false)
    private String medalName;

    @Column(name = "achieved_at", nullable = false)
    private LocalDateTime achievedAt;

    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @PrePersist
    public void prePersist() {
        if (achievedAt == null) {
            achievedAt = LocalDateTime.now();
        }
    }
}
