package com.treehouse.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 会员订阅请求
 */
@Data
public class SubscribeRequest {

    /** 套餐码：MONTH / YEAR / LIFE */
    @NotBlank(message = "planCode 不能为空")
    private String planCode;
}
