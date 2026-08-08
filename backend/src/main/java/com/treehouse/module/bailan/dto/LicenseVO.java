package com.treehouse.module.bailan.dto;

import com.treehouse.module.bailan.BailanLicense;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 摆烂许可证视图对象
 *
 * <p>对齐 API 规范 POST /bailan/generate 响应结构。</p>
 */
@Data
public class LicenseVO {

    private String licenseId;
    private String licenseNo;
    private String licenseType;
    private String templateCode;
    private String imageUrl;
    private String reasonText;
    /** 本次领取奖励的月光币（非首次领取为 0） */
    private int coinReward;
    private LocalDateTime createdAt;

    /**
     * 实体转视图
     *
     * @param entity     许可证实体
     * @param coinReward 本次奖励月光币
     */
    public static LicenseVO from(BailanLicense entity, int coinReward) {
        LicenseVO vo = new LicenseVO();
        vo.setLicenseId("B" + DateTimeFormatter.ofPattern("yyyyMMdd").format(entity.getCreateTime())
                + String.format("%05d", entity.getId()));
        vo.setLicenseNo(entity.getLicenseNo());
        vo.setLicenseType(entity.getLicenseType());
        vo.setTemplateCode(entity.getTemplateCode());
        vo.setImageUrl(entity.getImageUrl());
        vo.setReasonText(entity.getReasonText());
        vo.setCoinReward(coinReward);
        vo.setCreatedAt(entity.getCreateTime());
        return vo;
    }
}
