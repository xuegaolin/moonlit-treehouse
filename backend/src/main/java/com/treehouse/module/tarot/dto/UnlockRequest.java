package com.treehouse.module.tarot.dto;

import lombok.Data;

/**
 * 塔罗解锁请求
 */
@Data
public class UnlockRequest {
    /** 占卜编号 */
    private String readingId;
    /** 订单号（v1.x 接支付后必填） */
    private String orderId;
}
