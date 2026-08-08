package com.treehouse.module.bailan.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * 领取摆烂许可证请求
 *
 * <p>对齐 API 规范 POST /bailan/generate 请求体。</p>
 */
@Data
public class GenerateLicenseRequest {

    /** 摆烂类型：monday-周一续命 period-姨妈假 breakup-失恋疗养 no_reason-无理由 ai_custom-AI 定制 */
    @NotBlank(message = "type 不能为空")
    private String type;

    /** 模板编码：gov/handwrite/palace/cyber/dunhuang/film，默认 gov */
    private String template = "gov";

    /** 持证人昵称（前端传入，证书上展示） */
    @Size(max = 100, message = "昵称最长 100 字符")
    private String nickname;

    /** 持证人头像（预留，MVP 证书不合成头像） */
    private String avatar;

    /** 自定义理由（type=ai_custom 时使用） */
    @Size(max = 200, message = "自定义理由最长 200 字符")
    private String customReason;
}
