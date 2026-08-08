package com.treehouse.module.tarot.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.treehouse.module.tarot.TarotReading;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 塔罗历史列表项（GET /tarot/history 列表元素）
 *
 * <p>只暴露列表需要的字段（readingId / spreadType / 牌名 / 短解读 / 时间 / 心情），
 * 不返回 fullInterpretation / advice 这些长字段——列表不需要，体积小。</p>
 */
@Slf4j
@Data
public class TarotHistoryItemVO {

    private String readingId;
    private String spreadType;          // DAILY / THREE_CARDS
    private String shortInterpretation;
    private Boolean unlocked;
    private String cardName;            // 单张 → 第一张；3 张 → "愚者 / 命运之轮 / 太阳"
    private String cardEmoji;           // 单张 → 第一张 emoji
    private String question;            // 三牌阵问题 / 每日一抽心情
    private String drawDate;            // yyyy-MM-dd
    private String createTime;          // yyyy-MM-dd HH:mm:ss

    public static TarotHistoryItemVO from(TarotReading r) {
        TarotHistoryItemVO vo = new TarotHistoryItemVO();
        vo.setReadingId(r.getReadingNo());
        vo.setSpreadType(r.getSpreadType());
        vo.setShortInterpretation(r.getShortInterp());
        vo.setUnlocked(r.getUnlocked() != null && r.getUnlocked() == 1);
        vo.setQuestion(r.getQuestion());
        vo.setDrawDate(r.getDrawDate() == null ? null : r.getDrawDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
        vo.setCreateTime(r.getCreateTime() == null ? null
                : r.getCreateTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        // 解析 cardsJson 拿首张牌名 / emoji
        try {
            if (r.getCardsJson() != null && !r.getCardsJson().isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, Object>> cards = mapper.readValue(
                        r.getCardsJson(), new TypeReference<List<Map<String, Object>>>() {});
                if (!cards.isEmpty()) {
                    Map<String, Object> first = cards.get(0);
                    vo.setCardEmoji((String) first.get("emoji"));
                    if (cards.size() == 1) {
                        vo.setCardName((String) first.get("name"));
                    } else {
                        // 多张 → 拼接名字
                        StringBuilder sb = new StringBuilder();
                        for (Map<String, Object> c : cards) {
                            if (sb.length() > 0) sb.append(" · ");
                            sb.append(c.get("name"));
                        }
                        vo.setCardName(sb.toString());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("history 列表解析 cards_json 失败：{}", e.getMessage());
        }
        return vo;
    }
}
