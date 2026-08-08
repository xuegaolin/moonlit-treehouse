package com.treehouse.module.chat.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class SendMessageRequest {

    @NotNull(message = "toUserId 必填")
    private Long toUserId;

    @NotBlank(message = "消息内容不能为空")
    @Size(max = 500, message = "消息最长 500 字")
    private String content;

    /** TEXT / IMAGE / SYSTEM */
    private String msgType = "TEXT";
}
