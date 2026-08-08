package com.treehouse.module.chat.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.treehouse.module.chat.entity.ChatSession;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChatSessionVO {
    private Long id;
    /** 对方 userId（前端用来显示匿名 ID + 拉用户资料） */
    private Long peerUserId;
    private String lastMsgPreview;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastMsgAt;
    private Integer unread;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updateTime;

    public static ChatSessionVO from(ChatSession s, Long myUserId) {
        ChatSessionVO vo = new ChatSessionVO();
        vo.setId(s.getId());
        vo.setPeerUserId(s.peerId(myUserId));
        vo.setLastMsgPreview(s.getLastMsgPreview());
        vo.setLastMsgAt(s.getLastMsgAt());
        vo.setUnread(s.myUnread(myUserId));
        vo.setUpdateTime(s.getUpdateTime());
        return vo;
    }
}
