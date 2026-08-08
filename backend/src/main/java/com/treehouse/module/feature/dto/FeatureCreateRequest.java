package com.treehouse.module.feature.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class FeatureCreateRequest {

    @NotBlank(message = "标题不能为空")
    @Size(max = 80, message = "标题不超过 80 字")
    private String title;

    @NotBlank(message = "描述不能为空")
    @Size(max = 500, message = "描述不超过 500 字")
    private String description;
}
