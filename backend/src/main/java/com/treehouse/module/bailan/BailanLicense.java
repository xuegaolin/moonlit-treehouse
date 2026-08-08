package com.treehouse.module.bailan;

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
 * 摆烂许可证（t_bailan_license）
 *
 * <p>对应技术架构文档 t_bailan_license。
 * 证书图片由前端 Canvas 合成，imageUrl 预留（后续如需服务端出图再回填）。</p>
 */
@Data
@Entity
@Table(name = "t_bailan_license", indexes = {
        @Index(name = "idx_user_create", columnList = "user_id, create_time"),
        @Index(name = "idx_license_no", columnList = "license_no", unique = true)
})
@SQLDelete(sql = "UPDATE t_bailan_license SET deleted = 1 WHERE id = ?")
@Where(clause = "deleted = 0")
public class BailanLicense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户 ID */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 许可证编号，如 ML-20260726-0001 */
    @Column(name = "license_no", length = 32, unique = true, nullable = false)
    private String licenseNo;

    /** 摆烂类型：monday/period/breakup/no_reason/ai_custom */
    @Column(name = "license_type", length = 20, nullable = false)
    private String licenseType;

    /** 模板编码：gov/handwrite/palace/cyber/dunhuang/film */
    @Column(name = "template_code", length = 20, nullable = false)
    private String templateCode;

    /** 摆烂理由文案 */
    @Column(name = "reason_text", length = 500, nullable = false)
    private String reasonText;

    /** 证书图片 URL（MVP 由前端 Canvas 生成，字段预留） */
    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** 软删除标记 */
    @Column(name = "deleted", nullable = false)
    private Integer deleted = 0;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    public void prePersist() {
        this.createTime = LocalDateTime.now();
    }
}
