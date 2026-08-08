package com.treehouse.module.privacy.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;

/**
 * 隐私设置更新请求（PUT /user/privacy）
 *
 * <p>所有字段都可选——只传要改的。前端打开设置项时只发变更的字段。</p>
 */
@Data
public class PrivacyUpdateRequest {

    /** 是否开放聊天：true=开，false=关 */
    private Boolean chatEnabled;

    /** 是否开放加好友 */
    private Boolean friendEnabled;

    /** 聊天记录保存天数：7 / 30 / 90 / -1（永久） */
    @Min(value = -1, message = "keepDays 必须 >= -1")
    @Max(value = 3650, message = "keepDays 不应超过 3650 天")
    private Integer chatHistoryKeepDays;
}
