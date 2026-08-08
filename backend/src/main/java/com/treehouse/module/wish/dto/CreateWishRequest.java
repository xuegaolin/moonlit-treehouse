package com.treehouse.module.wish.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * 许愿请求（POST /wish/create）
 */
@Data
public class CreateWishRequest {

    /** 分类：study/career/love/health/other */
    @NotBlank(message = "请选择分类")
    private String category;

    /** 愿望内容（1-500 字） */
    @NotBlank(message = "愿望不能是空的")
    @Size(min = 1, max = 500, message = "内容长度 1-500 字")
    private String content;

    /** 期望实现时间（毫秒） */
    private Long expectAt;

    /** 是否公开到漂流墙 */
    private Boolean publicToWall = false;
}
