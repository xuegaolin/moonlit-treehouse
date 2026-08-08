package com.treehouse.module.wish.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 结愿请求（POST /wish/close）
 */
@Data
public class CloseWishRequest {

    /** 愿望编号 */
    @NotBlank
    private String wishId;

    /** 是否实现：true-愿望成真 / false-主动关闭（不再追求） */
    @NotNull
    private Boolean achieved;

    /** 是否让 AI 写一段祝福（v1.x 接 LLM，MVP 静态模板） */
    private Boolean aiBlessing = true;
}
