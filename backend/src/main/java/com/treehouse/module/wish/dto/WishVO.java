package com.treehouse.module.wish.dto;

import com.treehouse.module.wish.Wish;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

/**
 * 愿望视图（GET /wish/mine 列表 / POST /wish/create 响应）
 */
@Data
public class WishVO {
    private String wishId;
    private String category;
    private String content;
    private String status;
    /** 期望实现时间（毫秒） */
    private Long expectAt;
    /** 创建时间（毫秒） */
    private Long createdAt;
    private Integer tapCount;
    /** 结愿祝福（仅 CLOSED/ACHIEVED 状态） */
    private String blessing;
    /** 距离期望时间友好文案 */
    private String expectHint;
    private boolean canClose;

    public static WishVO from(Wish w) {
        WishVO vo = new WishVO();
        vo.setWishId(w.getWishNo());
        vo.setCategory(w.getCategory());
        vo.setContent(w.getContent());
        vo.setStatus(w.getStatus());
        vo.setTapCount(w.getTapCount() == null ? 0 : w.getTapCount());
        vo.setBlessing(w.getBlessing());
        vo.setCanClose("OPEN".equals(w.getStatus()));
        if (w.getExpectAt() != null) {
            vo.setExpectAt(toMillis(w.getExpectAt()));
            vo.setExpectHint(buildExpectHint(w.getExpectAt()));
        }
        if (w.getCreateTime() != null) {
            vo.setCreatedAt(toMillis(w.getCreateTime()));
        }
        return vo;
    }

    private static Long toMillis(java.time.LocalDateTime t) {
        if (t == null) return null;
        return t.atZone(java.time.ZoneId.of("Asia/Shanghai"))
                .toInstant().toEpochMilli();
    }

    private static String buildExpectHint(java.time.LocalDateTime target) {
        if (target == null) return null;
        long days = java.time.Duration.between(java.time.LocalDateTime.now(), target).toDays();
        if (days < 0) return "已过期";
        if (days == 0) return "今天";
        if (days < 30) return "还有 " + days + " 天";
        if (days < 365) return "还有 " + (days / 30) + " 个月";
        return "还有 " + (days / 365) + " 年";
    }
}
