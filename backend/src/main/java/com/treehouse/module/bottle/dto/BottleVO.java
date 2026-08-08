package com.treehouse.module.bottle.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.treehouse.module.bottle.Bottle;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 瓶子视图（GET /bottle/feed / POST /bottle/publish 响应）
 */
@Slf4j
@Data
public class BottleVO {
    private String bottleId;
    private String content;
    private List<String> tags;
    private String anonymousId;
    private Integer warmCount;
    private String auditStatus;
    /** 创建时间（毫秒） */
    private Long createdAt;
    /** 距离现在的友好时间 */
    private String timeHint;
    /** 是否本人发布（前端据此禁用"温暖"按钮，避免点了才被拒） */
    private Boolean isMine;
    /** 当前用户是否已温暖过（前端据此显示"已温暖"态） */
    private Boolean warmed;

    /**
     * 带当前用户上下文的转换：填充 isMine / warmed，
     * 让前端在渲染时就知道哪些瓶子不可温暖。
     */
    public static BottleVO from(Bottle b, Long currentUserId, boolean warmed) {
        BottleVO vo = from(b);
        vo.setIsMine(currentUserId != null && currentUserId.equals(b.getUserId()));
        vo.setWarmed(warmed);
        return vo;
    }

    public static BottleVO from(Bottle b) {
        BottleVO vo = new BottleVO();
        vo.setBottleId(b.getBottleNo());
        vo.setContent(b.getContent());
        vo.setAnonymousId(b.getAnonymousId());
        vo.setWarmCount(b.getWarmCount() == null ? 0 : b.getWarmCount());
        vo.setAuditStatus(b.getAuditStatus());
        if (b.getCreateTime() != null) {
            vo.setCreatedAt(b.getCreateTime()
                    .atZone(java.time.ZoneId.of("Asia/Shanghai"))
                    .toInstant().toEpochMilli());
            vo.setTimeHint(buildTimeHint(b.getCreateTime()));
        }
        if (b.getTagsJson() != null && !b.getTagsJson().isEmpty()) {
            try {
                ObjectMapper m = new ObjectMapper();
                vo.setTags(m.readValue(b.getTagsJson(), new TypeReference<List<String>>() {}));
            } catch (Exception e) {
                vo.setTags(new ArrayList<>());
            }
        } else {
            vo.setTags(new ArrayList<>());
        }
        vo.setIsMine(Boolean.FALSE);
        vo.setWarmed(Boolean.FALSE);
        return vo;
    }

    private static String buildTimeHint(java.time.LocalDateTime t) {
        long mins = java.time.Duration.between(t, java.time.LocalDateTime.now()).toMinutes();
        if (mins < 1) return "刚刚";
        if (mins < 60) return mins + " 分钟前";
        long hours = mins / 60;
        if (hours < 24) return hours + " 小时前";
        long days = hours / 24;
        if (days < 30) return days + " 天前";
        return (days / 30) + " 个月前";
    }
}
