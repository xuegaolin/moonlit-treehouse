package com.treehouse.module.letter.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

/**
 * 创建信件请求
 *
 * <p>对齐 API 规范 POST /letter/create 请求体。</p>
 */
@Data
public class CreateLetterRequest {

    /** 收信人类型：self_future / self_now / missed_one / stranger */
    @NotBlank(message = "请选择收信人")
    private String receiverType;

    /** 投递时间（毫秒时间戳） */
    @NotNull(message = "请选择送达时间")
    private Long deliverAt;

    /** 信件正文（1-1000 字） */
    @NotBlank(message = "信不能是空的")
    @Size(min = 1, max = 1000, message = "正文长度需在 1-1000 字之间")
    private String content;

    /** 信封样式：default / kraft / sakura，默认 default */
    private String envelopeCode = "default";

    /** 是否启用 AI 回信 */
    private Boolean aiEnabled = false;

    /** AI 人设：SISTER / BESTIE / PROF / BUDDHA / STAR */
    private String aiPersona;

    /** 是否公开到漂流墙 */
    private Boolean publicToWall = false;
}
