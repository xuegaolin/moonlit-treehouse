package com.treehouse.module.bottle.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.util.List;

/**
 * 发布瓶子请求（POST /bottle/publish）
 */
@Data
public class PublishBottleRequest {
    /** 心事正文（1-500 字） */
    @NotBlank
    @Size(min = 1, max = 500, message = "内容长度 1-500 字")
    private String content;

    /** 情绪标签（可选） */
    private List<String> tags;
}
