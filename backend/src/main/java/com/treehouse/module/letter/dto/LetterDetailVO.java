package com.treehouse.module.letter.dto;

import com.treehouse.module.letter.Letter;
import lombok.Data;

/**
 * 信件详情视图（GET /letter/detail）
 *
 * <p>对齐 API 规范：正文已解密、AI 回信完整呈现。</p>
 */
@Data
public class LetterDetailVO {

    private String letterId;
    private String status;
    private String receiverType;
    private String content;
    private String envelopeCode;
    private String aiPersona;
    private String aiReply;
    /** 投递时间（毫秒） */
    private Long deliverAt;
    /** 实际送达时间（毫秒） */
    private Long deliveredAt;
    /** 是否可分享到公开墙（只有已送达 + 公开标识） */
    private Boolean canShare;
    /** 投递时间友好文案：'2 天后送达' / '今天 22:00' / '已送达' */
    private String deliverHint;

    public static LetterDetailVO from(Letter entity, String plainContent) {
        LetterDetailVO vo = new LetterDetailVO();
        vo.setLetterId(entity.getLetterNo());
        vo.setStatus(entity.getStatus());
        vo.setReceiverType(entity.getReceiverType());
        vo.setContent(plainContent);
        vo.setEnvelopeCode(entity.getEnvelopeCode());
        vo.setAiPersona(entity.getAiPersona());
        vo.setAiReply(entity.getAiReply());
        vo.setDeliverAt(toMillis(entity.getDeliverAt()));
        vo.setDeliveredAt(toMillis(entity.getDeliveredAt()));
        vo.setCanShare("DELIVERED".equals(entity.getStatus()) && entity.getPublicToWall() == 1);
        vo.setDeliverHint(buildDeliverHint(entity));
        return vo;
    }

    private static Long toMillis(java.time.LocalDateTime t) {
        if (t == null) return null;
        return t.atZone(java.time.ZoneId.of("Asia/Shanghai"))
                .toInstant()
                .toEpochMilli();
    }

    private static String buildDeliverHint(Letter entity) {
        if ("DELIVERED".equals(entity.getStatus()) || "REPLIED".equals(entity.getStatus())) {
            return "已送达";
        }
        if ("CANCELED".equals(entity.getStatus())) {
            return "已撤回";
        }
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (entity.getDeliverAt().isBefore(now)) {
            return "等待派送";
        }
        long days = java.time.Duration.between(now, entity.getDeliverAt()).toDays();
        if (days == 0) return "今天送达";
        if (days == 1) return "明天送达";
        if (days < 7) return days + " 天后送达";
        if (days < 30) return (days / 7) + " 周后送达";
        return (days / 30) + " 个月后送达";
    }
}
