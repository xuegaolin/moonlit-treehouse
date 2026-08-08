package com.treehouse.module.bottle.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 温暖请求（POST /bottle/warm）
 */
@Data
public class WarmRequest {
    /** 瓶子编号 */
    @NotBlank
    private String bottleId;

    /** 礼物类型：hug / candy / candle */
    @NotBlank
    private String giftType = "hug";

    /** 花费月光币（前端按 giftType 算好后传入） */
    private Integer coinCost = 0;
}
