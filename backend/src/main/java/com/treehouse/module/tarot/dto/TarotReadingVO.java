package com.treehouse.module.tarot.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.treehouse.module.tarot.TarotReading;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 塔罗占卜视图（对齐 API 规范 POST /tarot/daily /three-cards 响应）
 */
@Slf4j
@Data
public class TarotReadingVO {

    private String readingId;
    private String spreadType;
    /** 抽中的牌列表 */
    private List<Map<String, Object>> cards;
    /** 30 字短解读 */
    private String shortInterpretation;
    /** 解锁价格（分） */
    private int unlockPrice;
    /** 是否已解锁 */
    private boolean unlocked;
    /** 完整解读（已解锁才返回） */
    private String fullInterpretation;
    /** 建议（已解锁才返回） */
    private List<String> advice;
    /** 幸运色 */
    private String luckyColor;
    /** 幸运数字 */
    private Integer luckyNumber;
    /** 推荐歌曲（占位） */
    private String songUrl;

    public static TarotReadingVO from(TarotReading r) {
        TarotReadingVO vo = new TarotReadingVO();
        vo.setReadingId(r.getReadingNo());
        vo.setSpreadType(r.getSpreadType());
        vo.setUnlockPrice(r.getUnlockPrice());
        vo.setUnlocked(r.getUnlocked() != null && r.getUnlocked() == 1);
        vo.setShortInterpretation(r.getShortInterp());
        vo.setFullInterpretation(r.getFullInterp());
        vo.setLuckyColor(r.getLuckyColor());
        vo.setLuckyNumber(r.getLuckyNumber());
        vo.setSongUrl(r.getSongUrl());

        // 解析 cardsJson
        try {
            ObjectMapper mapper = new ObjectMapper();
            vo.setCards(mapper.readValue(r.getCardsJson(), new TypeReference<List<Map<String, Object>>>() {}));
        } catch (Exception e) {
            log.warn("cards_json 解析失败：{}", e.getMessage());
            vo.setCards(new ArrayList<>());
        }

        // 解析 adviceJson
        if (r.getAdviceJson() != null && !r.getAdviceJson().isEmpty()) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                vo.setAdvice(mapper.readValue(r.getAdviceJson(), new TypeReference<List<String>>() {}));
            } catch (Exception e) {
                vo.setAdvice(Arrays.asList(r.getAdviceJson().split("\\|")));
            }
        }
        return vo;
    }
}
