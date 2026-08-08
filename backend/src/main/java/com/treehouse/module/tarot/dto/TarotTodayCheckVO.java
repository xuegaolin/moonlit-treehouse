package com.treehouse.module.tarot.dto;

import lombok.Data;

/**
 * 塔罗今日一抽状态查询响应（GET /tarot/today-check）
 *
 * <p>为什么需要这个接口：原来的 POST /tarot/daily 一调就抽。
 * 前端需要「仅查询今日是否已抽」的能力，以便决定显示「未抽 UI」还是「已抽结果」。
 * 这里只返回布尔标志 + readingId，不返回牌面——前端拿到 true 后会再调 /tarot/daily 拿完整数据。</p>
 */
@Data
public class TarotTodayCheckVO {

    /** true = 今日已抽过，false = 未抽 */
    private Boolean hasRead;
    /** 今日 reading 的编号（hasRead=false 时为 null） */
    private String readingId;
}
