package com.treehouse.dto;

import lombok.Data;

import javax.validation.constraints.Size;

/**
 * 更新用户资料请求
 */
@Data
public class UpdateProfileRequest {

    /** 昵称（可空，空则不更新） */
    @Size(max = 100, message = "昵称最长 100 字符")
    private String nickname;

    /** 头像 URL（可空，空则不更新） */
    @Size(max = 500, message = "头像地址最长 500 字符")
    private String avatar;
}
