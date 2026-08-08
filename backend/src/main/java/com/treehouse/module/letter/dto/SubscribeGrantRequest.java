package com.treehouse.module.letter.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 前端拿到 wx.requestSubscribeMessage 授权后回调入参。
 *
 * <p>openid 可空：dev / 真机调试时后端无感，从 token 解析更稳。</p>
 */
@Data
public class SubscribeGrantRequest {

    /** 信件编号 L-yyyyMMdd-xxxx */
    @NotBlank(message = "letterId 必填")
    private String letterId;

    /** wx.requestSubscribeMessage 返回的 push_token（30 天有效） */
    @NotBlank(message = "pushToken 必填")
    private String pushToken;

    /** 可选：用户 openid（dev 时后端拿不到，从请求头 token 解析） */
    private String openid;
}
