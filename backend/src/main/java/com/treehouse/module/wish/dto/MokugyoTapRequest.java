package com.treehouse.module.wish.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 木鱼敲击请求（POST /wish/mokugyo/tap）
 *
 * <p>批量上报：count = 客户端一段时间内累计的敲击次数（防高频请求）。</p>
 */
@Data
public class MokugyoTapRequest {

    /** 本次上报次数（1-50） */
    @NotNull
    private Integer count = 1;
}
