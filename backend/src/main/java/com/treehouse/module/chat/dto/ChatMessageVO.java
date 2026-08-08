package com.treehouse.module.chat.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.treehouse.module.chat.entity.ChatMessage;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChatMessageVO {
    private Long id;
    private Long fromUserId;
    private Long toUserId;
    private String content;
    private String msgType;
    private Boolean audited;
    private String auditResult;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime readAt;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    public static ChatMessageVO from(ChatMessage m) {
        ChatMessageVO vo = new ChatMessageVO();
        vo.setId(m.getId());
        vo.setFromUserId(m.getFromUserId());
        vo.setToUserId(m.getToUserId());
        vo.setContent(m.getContent());
        vo.setMsgType(m.getMsgType());
        vo.setAudited(m.getAudited() != null && m.getAudited() == 1);
        vo.setAuditResult(m.getAuditResult());
        vo.setReadAt(m.getReadAt());
        vo.setCreateTime(m.getCreateTime());
        return vo;
    }
}
