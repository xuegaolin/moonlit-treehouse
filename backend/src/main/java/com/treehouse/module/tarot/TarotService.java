package com.treehouse.module.tarot;

import cn.hutool.core.util.RandomUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.module.tarot.dto.TarotHistoryItemVO;
import com.treehouse.module.tarot.dto.TarotReadingVO;
import com.treehouse.module.tarot.dto.TarotTodayCheckVO;
import com.treehouse.module.tarot.dto.ThreeCardsRequest;
import com.treehouse.module.tarot.dto.UnlockRequest;
import com.treehouse.service.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.Collectors;

/**
 * 塔罗服务（模块 C）
 *
 * <p>核心规则：
 * <ul>
 *   <li>每日一抽：每人每天 1 次（DB 唯一约束兜底 + Service 校验）</li>
 *   <li>三牌阵：过去/现在/未来，扣 9.9 元解锁完整解读（v1.x 接支付）</li>
 *   <li>30 字短解读：抽完即看（v1.x 静态文案）</li>
 *   <li>200 字完整解读：解锁后看（v1.x 静态模板）</li>
 * </ul>
 *
 * <p>TODO(v1.x)：完整解读接 LLM（AiService.tarotInterpret）</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TarotService {

    private final TarotCardRepository cardRepository;
    private final TarotReadingRepository readingRepository;
    private final AiService aiService;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Random RANDOM = new Random();

    /** 短解读模板（按主关键字） */
    private static final Map<String, String> SHORT_TEMPLATES = new HashMap<>();
    /** 完整解读模板（按主关键字） */
    private static final Map<String, String[]> FULL_TEMPLATES = new HashMap<>();
    /**
     * 塔罗深度解读的 system prompt。
     *
     * <p>定位：这是付费内容（19.9 元），质量必须明显高于免费短解读。
     * 关键约束是不算命、不预言——我们卖的是情绪陪伴与自我觉察，
     * 不是玄学预测，既避免合规风险，也更贴合深夜用户的真实需求。</p>
     */
    private static final String AI_TAROT_SYSTEM =
            "你是「今夜树屋」的塔罗解读师，为深夜独处的年轻人做温柔的自我觉察引导。"
                    + "要求：1) 不算命、不预言未来、不给确定性断言，只做情绪照见与自我觉察；"
                    + "2) 语气像深夜里懂你的朋友，温柔具体，不空泛励志；"
                    + "3) 必须结合给到的牌面关键词展开，不要泛泛而谈；"
                    + "4) 分三段，每段一个自然段，段间空一行，总共 300-420 字；"
                    + "5) 第一段照见当下状态，第二段指出容易被忽略的一面，第三段给一个今晚能做的小事；"
                    + "6) 不要用 markdown、不要标题、不要列表、不要引号；"
                    + "7) 禁止提及心理治疗、抗抑郁、诊断等医疗词汇。";
    /** 建议库 */
    private static final String[] ADVICE_POOL = {
            "深呼吸 3 次，给情绪一个落点",
            "今晚早点睡，明天再想",
            "写下来，文字会让想法更清晰",
            "找个朋友聊聊天，不必是 TA",
            "允许自己暂时不知道答案",
            "走出去晒 10 分钟太阳",
            "做一件很小的好事，给自己",
            "别刷手机了，关掉它 30 分钟"
    };

    static {
        // 短解读（30 字左右）
        SHORT_TEMPLATES.put("希望", "今天的太阳照进你心里：希望就在前方。");
        SHORT_TEMPLATES.put("新开始", "放下旧的，全新的剧本刚刚翻开第一页。");
        SHORT_TEMPLATES.put("勇气", "你比自己想象的更勇敢，敢不敢再往前一步？");
        SHORT_TEMPLATES.put("内省", "今天的功课不在外面，在心里。");
        SHORT_TEMPLATES.put("转折", "转角就在不远处，准备好接住它。");
        SHORT_TEMPLATES.put("真相", "雾在散，真相慢慢浮出水面。");
        SHORT_TEMPLATES.put("平衡", "节奏慢一点，给生活一个呼吸的间隙。");
        SHORT_TEMPLATES.put("束缚", "是什么困住了你？今天试着松一松。");
        SHORT_TEMPLATES.put("冲突", "有冲突是好事——说明你在意。");
        SHORT_TEMPLATES.put("丰盛", "你拥有的，比你以为的多得多。");
        SHORT_TEMPLATES.put("直觉", "闭上眼，听听心里那个小小的声音。");
        SHORT_TEMPLATES.put("爱", "你值得被好好对待，包括被你自己的心。");
        SHORT_TEMPLATES.put("圆满", "今天是一个收束的好日子，给努力一个拥抱。");
        SHORT_TEMPLATES.put("结束", "结束不是句号，是逗号——下一句更精彩。");
        SHORT_TEMPLATES.put("疗愈", "今天允许自己脆弱，脆弱是治愈的起点。");

        // 完整解读（200 字模板）
        FULL_TEMPLATES.put("希望", new String[]{
                "今天的牌指向『希望』，意味着你心里那个隐隐的光，正在变成具体的形状。",
                "过去：你已经走过了很长的路，回头看会发现那些辛苦不是白费的。",
                "现在：你正处在一个转折的边缘，外部环境开始变得对你有利。",
                "未来：接下来 7 天会有让你欣慰的小事发生，可能是来自一个老朋友、一封邮件、或某个陌生人的善意。",
                "建议：把注意力放在你『想要』的事上，而不是你『担心』的事上。"
        });
        FULL_TEMPLATES.put("新开始", new String[]{
                "『新开始』是你今天的关键词。",
                "过去：某些人、某些事已经翻篇了，承认它就好。",
                "现在：空白不是可怕，是礼物——你可以重新选择要怎么填。",
                "未来：未来 30 天会有一次新的相遇，可能是人，可能是机会。",
                "建议：先做一件很小的、不需要别人同意的事。"
        });
        FULL_TEMPLATES.put("勇气", new String[]{
                "今天的牌呼唤你的勇气。",
                "过去：你已经躲了很久，躲避其实比面对更累。",
                "现在：有件事你一直知道该做，但还没动。",
                "未来：迈出那一步之后，你会发现根本没自己想的那么可怕。",
                "建议：把目标从『做完』改成『开始』。"
        });
        FULL_TEMPLATES.put("疗愈", new String[]{
                "今天的主题是『疗愈』。",
                "过去：你身上有些伤还没好全，假装看不见并不能让它消失。",
                "现在：身体在告诉你它需要休息，听听它。",
                "未来：接下来一周会有某个人或某件事触发你的柔软，别抗拒。",
                "建议：今晚泡个热水澡，或者给自己煮一碗热汤。"
        });
        FULL_TEMPLATES.put("真相", new String[]{
                "『真相』是今天给你的礼物。",
                "过去：你已经隐约知道答案了，只是不敢认。",
                "现在：承认它不会毁掉什么，反而让你轻一点。",
                "未来：真相会以一种让你惊讶的方式浮出来，但你会感谢它。",
                "建议：把『我是不是想多了』换成『我其实早就知道了』。"
        });
    }

    // ==================== 公共方法 ====================

    /**
     * 仅查今日是否已抽（GET /tarot/today-check）
     *
     * <p>为什么不复用 /tarot/daily：daily() 在「今日未抽」时会
     * 触发抽牌（写入 DB），只查会污染数据。拆分接口让前端能
     * 明确表达意图。</p>
     */
    @Transactional(readOnly = true)
    public TarotTodayCheckVO todayCheck(Long userId) {
        LocalDate today = LocalDate.now();
        Optional<TarotReading> existing =
                readingRepository.findByUserIdAndSpreadTypeAndDrawDate(userId, "DAILY", today);
        TarotTodayCheckVO vo = new TarotTodayCheckVO();
        if (existing.isPresent()) {
            vo.setHasRead(true);
            vo.setReadingId(existing.get().getReadingNo());
        } else {
            vo.setHasRead(false);
            vo.setReadingId(null);
        }
        return vo;
    }

    /**
     * 历史记录（GET /tarot/history?page=0&size=20）
     *
     * <p>返回扁平 List，不分 spreadType。DAILY + THREE_CARDS 一起按时间倒序。
     * 默认 20 条/页，上限 50。</p>
     */
    @Transactional(readOnly = true)
    public List<TarotHistoryItemVO> history(Long userId, int page, int size) {
        int safeSize = Math.max(1, Math.min(50, size));
        int safePage = Math.max(0, page);
        List<TarotReading> all = readingRepository.findByUserIdOrderByCreateTimeDesc(userId);
        int from = Math.min(safePage * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        List<TarotHistoryItemVO> out = new ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            out.add(TarotHistoryItemVO.from(all.get(i)));
        }
        return out;
    }

    // ==================== 原有方法 ====================

    /**
     * 每日一抽
     *
     * <p>GET /tarot/daily 响应：{ readingId, cards, shortInterpretation, unlockPrice, unlocked: false }</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public TarotReadingVO daily(Long userId) {
        LocalDate today = LocalDate.now();
        Optional<TarotReading> existing = readingRepository.findByUserIdAndSpreadTypeAndDrawDate(userId, "DAILY", today);
        if (existing.isPresent()) {
            // 今日已抽 → 返回原结果（不再扣资源）
            return TarotReadingVO.from(existing.get());
        }

        // 抽 1 张牌
        TarotCard card = pickRandomCard();
        boolean upright = RANDOM.nextBoolean();
        Map<String, Object> cardMap = toCardMap(card, upright, "今日指引");
        List<Map<String, Object>> cards = Arrays.asList(cardMap);

        // 生成短解读
        String shortInterp = buildShortInterpretation(card, upright);

        // 落库
        TarotReading reading = new TarotReading();
        reading.setUserId(userId);
        reading.setReadingNo(generateReadingNo(today));
        reading.setSpreadType("DAILY");
        reading.setCardsJson(toJson(cards));
        reading.setShortInterp(shortInterp);
        reading.setUnlockPrice(990);
        reading.setUnlocked(0);
        reading.setLuckyColor(randomLuckyColor());
        reading.setLuckyNumber(RANDOM.nextInt(10) + 1);
        reading.setDrawDate(today);
        try {
            reading = readingRepository.saveAndFlush(reading);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 并发双开 → 另一个请求已写入，重新查询返回
            log.warn("塔罗每日一抽撞唯一约束，重读：userId={}, date={}", userId, today);
            return readingRepository.findByUserIdAndSpreadTypeAndDrawDate(userId, "DAILY", today)
                    .map(TarotReadingVO::from)
                    .orElseThrow(() -> new BizException(ResultCode.INTERNAL_ERROR));
        }

        log.info("塔罗每日一抽：userId={}, card={}, position={}", userId, card.getNameCn(), upright ? "正位" : "逆位");
        return TarotReadingVO.from(reading);
    }

    /**
     * 三牌阵
     *
     * <p>POST /tarot/three-cards { question } 响应：{ readingId, cards, shortInterpretation, unlockPrice }</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public TarotReadingVO threeCards(Long userId, ThreeCardsRequest req) {
        // DB 有唯一约束 uk_user_spread_day(user_id, spread_type, draw_date)：
        // 每人每天每种牌阵仅一次。原来这里直接 save 撞 UK 抛未捕获异常 → 500。
        // 与 daily() 保持一致：先查复用，再 catch UK 兜底。
        LocalDate today = LocalDate.now();
        Optional<TarotReading> existing =
                readingRepository.findByUserIdAndSpreadTypeAndDrawDate(userId, "THREE_CARDS", today);
        if (existing.isPresent()) {
            return TarotReadingVO.from(existing.get());
        }

        // 抽 3 张不重复的牌
        List<TarotCard> picked = pickRandomCards(3);
        boolean[] uprights = new boolean[]{RANDOM.nextBoolean(), RANDOM.nextBoolean(), RANDOM.nextBoolean()};
        String[] positions = {"过去", "现在", "未来"};

        List<Map<String, Object>> cards = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            cards.add(toCardMap(picked.get(i), uprights[i], positions[i]));
        }

        String shortInterp = buildThreeCardsShortInterp(cards);

        TarotReading reading = new TarotReading();
        reading.setUserId(userId);
        reading.setReadingNo(generateReadingNo(LocalDate.now()));
        reading.setSpreadType("THREE_CARDS");
        reading.setQuestion(req == null ? null : req.getQuestion());
        reading.setCardsJson(toJson(cards));
        reading.setShortInterp(shortInterp);
        reading.setUnlockPrice(990);
        reading.setUnlocked(0);
        reading.setLuckyColor(randomLuckyColor());
        reading.setLuckyNumber(RANDOM.nextInt(10) + 1);
        reading.setDrawDate(today);
        try {
            reading = readingRepository.saveAndFlush(reading);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 并发双开 → 另一个请求已写入，重读返回
            log.warn("塔罗三牌阵撞唯一约束，重读：userId={}, date={}", userId, today);
            return readingRepository.findByUserIdAndSpreadTypeAndDrawDate(userId, "THREE_CARDS", today)
                    .map(TarotReadingVO::from)
                    .orElseThrow(() -> new BizException(ResultCode.INTERNAL_ERROR));
        }

        log.info("塔罗三牌阵：userId={}, question={}", userId, req != null ? req.getQuestion() : "");
        return TarotReadingVO.from(reading);
    }

    /**
     * 解锁完整解读
     *
     * <p>POST /tarot/unlock { readingId, orderId } 响应：{ fullInterpretation, advice, luckyColor, luckyNumber, songUrl }</p>
     *
     * <p>v1.x：mock 模式直接解锁；正式版需校验订单已支付</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public TarotReadingVO unlock(Long userId, UnlockRequest req) {
        TarotReading reading = readingRepository.findByReadingNoAndUserId(req.getReadingId(), userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));

        if (reading.getUnlocked() != null && reading.getUnlocked() == 1) {
            // 已解锁直接返回
            return TarotReadingVO.from(reading);
        }

        // TODO(v1.x)：接 OrderService 校验订单已支付
        if (req.getOrderId() == null || req.getOrderId().isEmpty()) {
            // MVP mock 模式：自动解锁
            log.warn("塔罗 mock 解锁：userId={}, readingId={}（v1.x 接 OrderService）", userId, req.getReadingId());
        }

        // 生成完整解读
        String fullInterp = buildFullInterpretation(reading);
        String[] advice = pickAdvice(3);

        reading.setFullInterp(fullInterp);
        reading.setAdviceJson(String.join("|", advice));
        reading.setUnlocked(1);
        reading.setOrderId(req.getOrderId());
        // 附加歌曲（占位）
        reading.setSongUrl("https://music.example.com/moonlit-" + RANDOM.nextInt(20) + ".mp3");
        readingRepository.save(reading);

        log.info("塔罗完整解读解锁：userId={}, readingId={}", userId, req.getReadingId());
        return TarotReadingVO.from(reading);
    }

    // ==================== 私有方法 ====================

    private TarotCard pickRandomCard() {
        long total = cardRepository.count();
        long idx = (long) (RANDOM.nextDouble() * total);
        return cardRepository.findAll().get((int) idx);
    }

    private List<TarotCard> pickRandomCards(int n) {
        long total = cardRepository.count();
        if (total <= n) {
            return cardRepository.findAll();
        }
        // 用 Set 防重复
        java.util.Set<Integer> pickedIdx = new java.util.HashSet<>();
        List<TarotCard> result = new ArrayList<>();
        while (result.size() < n) {
            int idx = (int) (RANDOM.nextDouble() * total);
            if (pickedIdx.add(idx)) {
                result.add(cardRepository.findAll().get(idx));
            }
        }
        return result;
    }

    private Map<String, Object> toCardMap(TarotCard card, boolean upright, String position) {
        Map<String, Object> map = new HashMap<>();
        map.put("cardId", card.getId());
        map.put("name", card.getNameCn());
        map.put("nameEn", card.getNameEn());
        map.put("position", upright ? "upright" : "reversed");
        map.put("positionName", upright ? "正位" : "逆位");
        map.put("role", position);
        // keywords 数组化
        String kw = upright ? card.getUprightKw() : card.getReversedKw();
        map.put("keywords", Arrays.asList(kw.split("\\s*,\\s*")));
        // 牌的 emoji（按 arcana+suit）
        map.put("emoji", cardEmoji(card));
        return map;
    }

    private String cardEmoji(TarotCard card) {
        if ("MAJOR".equals(card.getArcana())) {
            int n = card.getNumber();
            if (n == 0) return "🃏";
            if (n == 1) return "🎩";
            if (n == 2) return "🌙";
            if (n == 3) return "👑";
            if (n == 4) return "🏛️";
            if (n == 5) return "📜";
            if (n == 6) return "💕";
            if (n == 7) return "🛞";
            if (n == 8) return "🦁";
            if (n == 9) return "🏮";
            if (n == 10) return "🎡";
            if (n == 11) return "⚖️";
            if (n == 12) return "🙃";
            if (n == 13) return "💀";
            if (n == 14) return "🍵";
            if (n == 15) return "😈";
            if (n == 16) return "🗼";
            if (n == 17) return "⭐";
            if (n == 18) return "🌕";
            if (n == 19) return "☀️";
            if (n == 20) return "📯";
            return "🌍";
        }
        // 小阿卡纳按花色
        switch (card.getSuit()) {
            case "WANDS":       return "🔥";
            case "CUPS":        return "🍷";
            case "SWORDS":      return "⚔️";
            case "PENTACLES":   return "🪙";
            default:            return "🂠";
        }
    }

    private String buildShortInterpretation(TarotCard card, boolean upright) {
        String kw = upright ? card.getUprightKw() : card.getReversedKw();
        String first = kw.split("\\s*,\\s*")[0];
        // 优先匹配预置模板
        for (Map.Entry<String, String> e : SHORT_TEMPLATES.entrySet()) {
            if (first.contains(e.getKey())) {
                return e.getValue();
            }
        }
        // 兜底
        return "今天的主题是「" + first + "」，慢慢感受它。";
    }

    private String buildThreeCardsShortInterp(List<Map<String, Object>> cards) {
        if (cards.size() < 3) return "牌阵未完成";
        String past = (String) cards.get(0).get("name");
        String now = (String) cards.get(1).get("name");
        String future = (String) cards.get(2).get("name");
        return "从「" + past + "」走来，经过「" + now + "」，走向「" + future + "」。";
    }

    /**
     * 生成完整解读：优先 LLM，失败回落静态模板。
     *
     * <p>回落而非抛错的理由：用户已经付费解锁，宁可给模板文案也不能给报错页。
     * 与 BailanService 同一模式。</p>
     */
    private String buildFullInterpretation(TarotReading reading) {
        String kw = null;
        String cardDesc = null;
        try {
            List cards = MAPPER.readValue(reading.getCardsJson(), List.class);
            if (cards == null || cards.isEmpty()) {
                return "完整解读生成失败（牌数据缺失）";
            }
            StringBuilder sb = new StringBuilder();
            for (Object o : cards) {
                Map<String, Object> c = (Map<String, Object>) o;
                List<String> kws = (List<String>) c.get("keywords");
                if (kw == null && kws != null && !kws.isEmpty()) {
                    kw = kws.get(0);
                }
                if (sb.length() > 0) {
                    sb.append("；");
                }
                sb.append(c.get("role")).append("：").append(c.get("name"))
                        .append("（").append(c.get("positionName")).append("，关键词 ")
                        .append(kws == null ? "" : String.join("、", kws)).append("）");
            }
            cardDesc = sb.toString();
        } catch (Exception e) {
            log.warn("解析牌面失败：{}", e.getMessage());
            return "完整解读生成失败，请稍后再试。";
        }

        String ai = aiTarotInterpret(cardDesc);
        if (ai != null && !ai.trim().isEmpty()) {
            log.info("[Tarot] AI 解读生成成功 len={}", ai.length());
            return ai;
        }

        log.warn("[Tarot] AI 解读不可用，回落静态模板");
        String[] tpl = FULL_TEMPLATES.get(kw);
        if (tpl == null) {
            tpl = FULL_TEMPLATES.get("希望");
        }
        return String.join("\n\n", tpl);
    }

    /** 调 LLM 生成塔罗深度解读；失败返回 null */
    private String aiTarotInterpret(String cardDesc) {
        String prompt = "用户抽到的牌：" + cardDesc
                + "。请按要求给出三段式深度解读。现在是深夜，用户独自一人。";
        return aiService.longText(AI_TAROT_SYSTEM, prompt, 900);
    }

    private String[] pickAdvice(int n) {
        // 洗牌取 n 个
        List<String> pool = new ArrayList<>(Arrays.asList(ADVICE_POOL));
        java.util.Collections.shuffle(pool);
        return pool.subList(0, Math.min(n, pool.size())).toArray(new String[0]);
    }

    private String randomLuckyColor() {
        String[] colors = {"#F5D76E", "#6B5CE7", "#FF6B81", "#4ECDC4", "#9C97B8", "#F7B7C8"};
        return colors[RANDOM.nextInt(colors.length)];
    }

    private String generateReadingNo(LocalDate today) {
        String prefix = "T-" + today.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        long base = readingRepository.countByDrawDate(today);
        for (int i = 1; i <= 100; i++) {
            String candidate = prefix + String.format("%04d", base + i);
            if (!readingRepository.existsByReadingNo(candidate)) {
                return candidate;
            }
        }
        return prefix + String.format("%04d", base + 101) + RandomUtil.randomString(4);
    }

    private String toJson(Object obj) {
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("JSON 序列化失败", e);
            return "[]";
        }
    }
}
