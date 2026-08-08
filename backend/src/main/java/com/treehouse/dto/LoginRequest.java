package com.treehouse.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 微信登录请求
 */
@Data
public class LoginRequest {

    /** wx.login 返回的临时登录凭证 */
    @NotBlank(message = "code 不能为空")
    private String code;
}
