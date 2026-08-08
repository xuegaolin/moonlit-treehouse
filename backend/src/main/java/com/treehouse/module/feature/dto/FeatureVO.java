package com.treehouse.module.feature.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.treehouse.module.feature.entity.FeatureRequest;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FeatureVO {

    private Long id;
    private String title;
    private String description;
    private String status;
    private Integer voteCount;
    private Boolean voted;          // 当前用户是否投过这票
    private Boolean mine;           // 是否我提的
    private String createTime;

    public static FeatureVO from(FeatureRequest r, boolean voted, boolean mine) {
        FeatureVO vo = new FeatureVO();
        vo.setId(r.getId());
        vo.setTitle(r.getTitle());
        vo.setDescription(r.getDescription());
        vo.setStatus(r.getStatus());
        vo.setVoteCount(r.getVoteCount());
        vo.setVoted(voted);
        vo.setMine(mine);
        vo.setCreateTime(r.getCreateTime() == null ? null
                : r.getCreateTime().toString());
        return vo;
    }
}
