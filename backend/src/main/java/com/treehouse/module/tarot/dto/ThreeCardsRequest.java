package com.treehouse.module.tarot.dto;

import lombok.Data;

/**
 * 塔罗三牌阵请求
 */
@Data
public class ThreeCardsRequest {
    /** 用户问题（可选） */
    private String question;
}
