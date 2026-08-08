package com.treehouse.module.privacy.dto;

import lombok.Data;

/**
 * 隐私设置响应（GET /user/privacy）
 *
 * <p>返回用户当前的隐私状态、社交开关、聊天记录保存期。
 * 前端据此渲染设置页。</p>
 */
@Data
public class PrivacyVO {

    /** 是否已实名 */
    private Boolean realNameVerified;
    /** 实名认证时间（null=未实名） */
    private String realNameVerifiedAt;

    /** 是否开放聊天 */
    private Boolean chatEnabled;
    /** 是否开放加好友 */
    private Boolean friendEnabled;
    /** 聊天记录保存天数：7 / 30 / 90 / -1=永久 */
    private Integer chatHistoryKeepDays;

    /** 是否付费会员（chatEnabled/friendEnabled 仅会员可开） */
    private Boolean isMember;
    /** 会员到期时间 */
    private String memberExpireAt;
}
