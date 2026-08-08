package com.treehouse.module.bailan;

import cn.hutool.core.util.RandomUtil;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.module.bailan.dto.GenerateLicenseRequest;
import com.treehouse.module.bailan.dto.LicenseVO;
import com.treehouse.service.AiService;
import com.treehouse.service.CoinService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 摆烂许可证服务（MVP 核心模块）
 *
 * <p>规则：每人每天限领一张；每日首次领取奖励月光币（配置 treehouse.bailan.daily-coin-reward）。
 * 证书图片由前端 Canvas 合成，后端只负责编号、理由与存档。</p>
 *
 * <p>理由生成：优先调用 {@link AiService} 由 LLM 生成，失败自动回落到 {@link #REASON_POOL} 静态模板。
 * AI 不可用时产品功能完全不受影响。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BailanService {

    private final BailanLicenseRepository licenseRepository;
    private final CoinService coinService;
    private final AiService aiService;

    /** 每日首次领取奖励月光币数 */
    @Value("${treehouse.bailan.daily-coin-reward:5}")
    private int dailyCoinReward;

    /** 理由库（MVP 静态文案，后续替换为 LLM 生成） */
    private static final Map<String, List<String>> REASON_POOL = new HashMap<>();

    static {
        REASON_POOL.put("monday", Arrays.asList(
                "根据《人间打工人保护法》第 3 章第 8 条：周一属于法定缓冲日，当事人有权拒绝一切无效努力。",
                "经月光委员会审定：周一空气含 emo 浓度超标，特批持证人今日躺平修养。",
                "依照《周末延续特别条例》：周一上班纯属义务加班，持证人可合法摆烂 24 小时。"));
        REASON_POOL.put("period", Arrays.asList(
                "根据《小仙女特别保护法》第 1 条：生理期期间，宇宙自动为持证人免除一切社交与劳动义务。",
                "经树屋医疗组（自封）诊断：今日宜卧床、宜奶茶、宜什么都不干。",
                "月光女神批示：特殊日子，特许摆烂，任何人不得催促、打扰、讲道理。"));
        REASON_POOL.put("breakup", Arrays.asList(
                "依据《失恋疗养法》：心脏维修期间，停工停学停社交，持证人今日合法摆烂。",
                "经鉴定：TA 不配。特发此证，准许持证人今日以眼泪和薯片为食，免于一切正经事。",
                "月光委员会一致通过：失恋属于工伤，今日工资照发、活儿全免。"));
        REASON_POOL.put("no_reason", Arrays.asList(
                "根据《躺平基本法》：摆烂不需要理由，本证即为理由。",
                "没有理由，就是不想动。本委员会认定该理由充分有效。",
                "经全票通过：今天、此刻、这位持证人了，什么都不做也完全 OK。"));
    }

    /**
     * 领取今日摆烂许可证
     *
     * @param userId 用户 ID
     * @param req    领取请求
     * @return 许可证视图（含月光币奖励数）
     * @throws BizException 今日已领取时抛 42901
     */
    @Transactional(rollbackFor = Exception.class)
    public LicenseVO generate(Long userId, GenerateLicenseRequest req) {
        // 1. 每日限领一张
        if (todayLicense(userId) != null) {
            throw new BizException(ResultCode.TOO_FREQUENT.getCode(), "今天已经领过啦，明天再来");
        }

        // 2. 生成编号：ML-yyyyMMdd-当日全站序号
        String licenseNo = generateLicenseNo();

        // 3. 挑选理由（MVP 静态池随机；ai_custom 用用户自定义）
        String reasonText = pickReason(req.getType(), req.getCustomReason());

        // 4. 存档
        BailanLicense license = new BailanLicense();
        license.setUserId(userId);
        license.setLicenseNo(licenseNo);
        license.setLicenseType(req.getType());
        license.setTemplateCode(req.getTemplate() == null ? "gov" : req.getTemplate());
        license.setReasonText(reasonText);
        license = licenseRepository.save(license);

        // 5. 发放月光币奖励（失败不阻断主流程：上限场景理论上不会发生，因为每日限领一张）
        int coinReward = 0;
        try {
            coinService.change(userId, dailyCoinReward, "BAILAN_LICENSE", licenseNo);
            coinReward = dailyCoinReward;
        } catch (BizException e) {
            log.warn("月光币发放失败：userId={}, reason={}", userId, e.getMessage());
        }

        log.info("摆烂许可证发放：userId={}, licenseNo={}, type={}", userId, licenseNo, req.getType());
        return LicenseVO.from(license, coinReward);
    }

    /**
     * 我的许可证列表 + 连续打卡 + 勋章
     *
     * <p>对齐 GET /bailan/mine 响应：{ list, total, streakDays, badges, todayClaimed }</p>
     */
    public Map<String, Object> mine(Long userId, int page, int size) {
        Page<BailanLicense> result = licenseRepository.findByUserIdOrderByCreateTimeDesc(
                userId, PageRequest.of(page, size));

        List<LicenseVO> list = result.getContent().stream()
                .map(entity -> LicenseVO.from(entity, 0))
                .collect(Collectors.toList());

        int streakDays = calcStreakDays(userId);

        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", result.getTotalElements());
        data.put("streakDays", streakDays);
        data.put("badges", calcBadges(streakDays, result.getTotalElements()));
        data.put("todayClaimed", todayLicense(userId) != null);
        return data;
    }

    /**
     * 摆烂日历（某月打卡情况）
     *
     * <p>对齐 GET /bailan/calendar?month=yyyyMM 响应：{ days: [{date, licenseId}] }</p>
     */
    public Map<String, Object> calendar(Long userId, String month) {
        LocalDate monthStart = LocalDate.parse(month + "01", DateTimeFormatter.ofPattern("yyyyMMdd"));
        LocalDateTime start = LocalDateTime.of(monthStart, LocalTime.MIN);
        LocalDateTime end = LocalDateTime.of(monthStart.plusMonths(1), LocalTime.MIN);

        List<Map<String, Object>> days = licenseRepository
                .findByUserIdAndCreateTimeBetween(userId, start, end).stream()
                .map(l -> {
                    Map<String, Object> day = new HashMap<>();
                    day.put("date", l.getCreateTime().toLocalDate().toString());
                    day.put("licenseId", l.getLicenseNo());
                    return day;
                })
                .collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("days", days);
        return data;
    }

    /** 查询今天的许可证（未领返回 null） */
    private BailanLicense todayLicense(Long userId) {
        LocalDateTime dayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime dayEnd = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
        List<BailanLicense> today = licenseRepository.findByUserIdAndCreateTimeBetween(userId, dayStart, dayEnd);
        return today.isEmpty() ? null : today.get(0);
    }

    /** 生成许可证编号：ML-yyyyMMdd-0001（当日全站序号）
     *
     * <p>线程安全：依赖 license_no 唯一索引，冲突时自旋重试（MVP 并发量低，足够）。
     * 高并发场景可替换为 Redis INCR 或 DB 序列表。</p>
     */
    private String generateLicenseNo() {
        LocalDate today = LocalDate.now();
        LocalDateTime dayStart = LocalDateTime.of(today, LocalTime.MIN);
        LocalDateTime dayEnd = LocalDateTime.of(today, LocalTime.MAX);
        String datePrefix = "ML-" + today.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";

        long base = licenseRepository.countByCreateTimeBetween(dayStart, dayEnd);
        for (int i = 1; i <= 100; i++) {
            String candidate = datePrefix + String.format("%04d", base + i);
            if (!licenseRepository.existsByLicenseNo(candidate)) {
                return candidate;
            }
        }
        // 极端兜底：追加随机后缀防死循环
        return datePrefix + String.format("%04d", base + 101) + RandomUtil.randomString(4);
    }

    /** 挑选摆烂理由：优先 LLM 生成，失败回落静态模板（AI 是增强，不是依赖） */
    private String pickReason(String type, String customReason) {
        if ("ai_custom".equals(type)) {
            if (customReason == null || customReason.trim().isEmpty()) {
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "自定义理由不能为空");
            }
            String raw = customReason.trim();
            String wrapped = aiWrapCustomReason(raw);
            return wrapped != null ? wrapped : raw;
        }
        String ai = aiGenerateReason(type);
        if (ai != null) {
            return ai;
        }
        List<String> pool = REASON_POOL.getOrDefault(type, REASON_POOL.get("no_reason"));
        return pool.get(RandomUtil.randomInt(pool.size()));
    }

    /** AI 系统提示：统一「摆烂许可证」的官方公文腔人格 */
    private static final String AI_SYSTEM_PROMPT =
            "你是「月光寡人事务局」的公文起草员，专为深夜疲惫的年轻人开具『摆烂许可证』。"
                    + "要求：1) 模仿正式公文腔（如“经核定”“依照”“准予”“特此批准”），"
                    + "但内容必须温柔、荒诞、好笑，是给人安慰而非真的公文；"
                    + "2) 可虚构法规名，如《人间打工人保护法》《周末延续特别条例》；"
                    + "3) 60 字以内，一句话，不要分段，不要引号，不要 markdown；"
                    + "4) 禁止说教、禁止劝人努力、禁止提及心理治疗或医疗建议。";

    /** 各场景的用户提示词 */
    private static final Map<String, String> AI_SCENE_PROMPT = new HashMap<>();

    static {
        AI_SCENE_PROMPT.put("monday", "场景：又是周一，完全不想上班。开一张今日摆烂许可。");
        AI_SCENE_PROMPT.put("period", "场景：生理期身体不适，只想躺着。开一张今日摆烂许可。");
        AI_SCENE_PROMPT.put("breakup", "场景：刚失恋，心里很空。开一张今日摆烂许可，注意温柔不要提“分手”二字。");
        AI_SCENE_PROMPT.put("no_reason", "场景：没什么具体原因，就是累了、什么都不想干。开一张今日摆烂许可。");
    }

    /** 调 LLM 生成场景理由；失败返回 null */
    private String aiGenerateReason(String type) {
        String scene = AI_SCENE_PROMPT.get(type);
        if (scene == null) {
            scene = AI_SCENE_PROMPT.get("no_reason");
        }
        String text = aiService.shortText(AI_SYSTEM_PROMPT, scene, 120);
        if (text != null) {
            log.debug("[Bailan] AI 理由生成成功 type={} len={}", type, text.length());
        }
        return text;
    }

    /** 把用户自定义理由包装成公文腔；失败返回 null（调用方用原文） */
    private String aiWrapCustomReason(String raw) {
        String prompt = "请把下面这句大白话，改写成一句 60 字以内的荒诞公文腔摆烂批准语，保留原意：" + raw;
        return aiService.shortText(AI_SYSTEM_PROMPT, prompt, 120);
    }

    /** 连续打卡天数（从今天/昨天往前数连续有证的日期） */
    private int calcStreakDays(Long userId) {
        List<BailanLicense> all = licenseRepository.findByUserIdOrderByCreateTimeDesc(userId);
        Set<LocalDate> days = new HashSet<>();
        for (BailanLicense l : all) {
            days.add(l.getCreateTime().toLocalDate());
        }

        LocalDate cursor = days.contains(LocalDate.now()) ? LocalDate.now() : LocalDate.now().minusDays(1);
        int streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    /** 勋章体系（对齐 PRD：连续 7/30/100 天） */
    private List<String> calcBadges(int streakDays, long total) {
        List<String> badges = new ArrayList<>();
        if (total >= 1) {
            badges.add("moxie-newbie");
        }
        if (streakDays >= 7) {
            badges.add("moxie-week");
        }
        if (streakDays >= 30) {
            badges.add("moxie-month");
        }
        if (streakDays >= 100) {
            badges.add("moxie-legend");
        }
        return badges;
    }
}
