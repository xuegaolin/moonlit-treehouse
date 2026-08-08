package com.treehouse.module.letter.dto;

import com.treehouse.module.letter.Letter;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 信件列表项视图（GET /letter/mine）
 *
 * <p>列表不返回正文与回信，只返回摘要，详情请调 GET /letter/detail。</p>
 */
@Data
public class LetterVO {

    private String letterId;
    private String status;
    private String receiverType;
    /** 信件投递时间（毫秒） */
    private Long deliverAt;
    private Boolean hasReply;
    private String envelopeCode;
    /** 摘要（最多 60 字，列表预览用） */
    private String summary;
    /** 创建时间（毫秒） */
    private Long createdAt;

    public static LetterVO from(Letter entity, String summary) {
        LetterVO vo = new LetterVO();
        vo.setLetterId(entity.getLetterNo());
        vo.setStatus(entity.getStatus());
        vo.setReceiverType(entity.getReceiverType());
        vo.setDeliverAt(toMillis(entity.getDeliverAt()));
        vo.setHasReply(entity.getAiReply() != null && !entity.getAiReply().isEmpty());
        vo.setEnvelopeCode(entity.getEnvelopeCode());
        vo.setSummary(summary);
        vo.setCreatedAt(toMillis(entity.getCreateTime()));
        return vo;
    }

    private static Long toMillis(java.time.LocalDateTime t) {
        if (t == null) return null;
        return t.atZone(java.time.ZoneId.of("Asia/Shanghai"))
                .toInstant()
                .toEpochMilli();
    }
}
