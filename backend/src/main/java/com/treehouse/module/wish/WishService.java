package com.treehouse.module.wish;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.module.wish.dto.CloseWishRequest;
import com.treehouse.module.wish.dto.CreateWishRequest;
import com.treehouse.module.wish.dto.MokugyoTapRequest;
import com.treehouse.module.wish.dto.WishVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 许愿池服务（模块 D）
 *
 * <p>核心规则：</p>
 * <ul>
 *   <li>每日木鱼上限 100 次（配置）</li>
 *   <li>每 10 次敲击 = +1 月光币（v1.x 接 CoinService）</li>
 *   <li>结愿时让 AI 写祝福（v1.x 接 LLM）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WishService {

    private final WishRepository wishRepository;
    private final MokugyoLogRepository mokugyoLogRepository;

    /** 每日木鱼上限 */
    @Value("${treehouse.wish.mokugyo-daily-limit:100}")
    private int mokugyoDailyLimit;

    /** 每 N 次敲击 = 1 月光币 */
    @Value("${treehouse.wish.merit-to-coin-rate:10}")
    private int meritToCoinRate;

    private static final Random RANDOM = new Random();

    /** 月光祝福模板（结愿时随机） */
    private static final String[] BLESSINGS = {
            "月光女神听到了你的愿望，悄悄为你种下了一颗种子。愿你在对的时间、对的地点，遇到对的人。",
            "风记住了你的名字，雨替你说出了心声。你许下的，不是愿望，是对自己的承诺。",
            "宇宙收到你的愿望了。它没有立刻回复，但已经在安排——以你意想不到的方式。",
            "有些愿望不是用来实现的，是用来让你成为配得上它的人的。你已经在路上了。",
            "今晚月色很美，所以你的愿望也一定很美。月光会替我，陪你等到那一天。",
            "你看，你已经从写下它的那一刻起，就离它更近了一步。继续走，它在终点等你。"
    };

    /**
     * 木鱼敲击（批量上报）
     *
     * <p>POST /wish/mokugyo/tap 响应：{ totalMerit, todayLeft, coinReward }</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> mokugyoTap(Long userId, MokugyoTapRequest req) {
        int count = req.getCount() == null ? 1 : req.getCount();
        if (count <= 0 || count > 50) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "每次最多上报 50 次");
        }
        LocalDate today = LocalDate.now();
        // 使用行锁版本：事务内禁止其他请求读同用户的 mokugyo_log 聚合，
        // 避免「查 50 → 写 50 → 总数 100」被并发另一个「查 50 → 写 50」超到 200。
        long usedToday = mokugyoLogRepository.sumCountByUserIdAndDayForUpdate(userId, today);
        if (usedToday + count > mokugyoDailyLimit) {
            int canTap = (int) Math.max(0, mokugyoDailyLimit - usedToday);
            throw new BizException(ResultCode.TOO_FREQUENT.getCode(),
                    "今日木鱼已达上限，还剩 " + canTap + " 次");
        }

        // 计算累计功德
        long totalMerit = mokugyoLogRepository.findByUserIdOrderByCreateTimeDesc(userId).stream()
                .mapToLong(MokugyoLog::getCount).sum() + count;

        MokugyoLog log = new MokugyoLog();
        log.setUserId(userId);
        log.setCount(count);
        log.setTotalMerit(totalMerit);
        log.setDay(today);
        mokugyoLogRepository.save(log);

        // 每 10 次 = +1 月光币（触发条件：达到下一个 10 倍数）
        int coinReward = 0;
        if (meritToCoinRate > 0 && totalMerit % meritToCoinRate < count) {
            coinReward = 1;
            // TODO(v1.x)：调 CoinService.change(userId, 1, "MOKUGYO_MERIT", ...)
        }

        int todayLeft = (int) Math.max(0, mokugyoDailyLimit - (usedToday + count));
        Map<String, Object> data = new HashMap<>();
        data.put("totalMerit", totalMerit);
        data.put("todayLeft", todayLeft);
        data.put("coinReward", coinReward);
        return data;
    }

    /**
     * 许愿
     */
    @Transactional(rollbackFor = Exception.class)
    public WishVO create(Long userId, CreateWishRequest req) {
        validateCategory(req.getCategory());

        Wish w = new Wish();
        w.setUserId(userId);
        w.setWishNo(generateUniqueWishNo(5));
        w.setCategory(req.getCategory());
        w.setContent(req.getContent().trim());
        w.setPublicToWall(Boolean.TRUE.equals(req.getPublicToWall()) ? 1 : 0);
        if (req.getExpectAt() != null) {
            w.setExpectAt(java.time.LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(req.getExpectAt()),
                    java.time.ZoneId.of("Asia/Shanghai")));
        }
        w.setStatus("OPEN");
        try {
            w = wishRepository.saveAndFlush(w);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 撞 wish_no UK → 重试一次
            log.warn("wish_no 撞库，重试：userId={}, wishNo={}", userId, w.getWishNo());
            w.setWishNo(generateUniqueWishNo(5));
            w = wishRepository.saveAndFlush(w);
        }
        log.info("愿望已许下：userId={}, wishNo={}", userId, w.getWishNo());
        return WishVO.from(w);
    }

    /**
     * 我的愿望
     */
    public List<WishVO> mine(Long userId) {
        List<Wish> all = wishRepository.findByUserIdOrderByCreateTimeDesc(userId);
        List<WishVO> result = new ArrayList<>(all.size());
        for (Wish w : all) {
            result.add(WishVO.from(w));
        }
        return result;
    }

    /**
     * 结愿
     *
     * <p>POST /wish/close 响应：{ wishId, blessing, cost: 0 }</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> close(Long userId, CloseWishRequest req) {
        Wish w = wishRepository.findByWishNoAndUserId(req.getWishId(), userId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        if (!"OPEN".equals(w.getStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "已结愿或关闭的愿望不能再操作");
        }

        boolean achieved = Boolean.TRUE.equals(req.getAchieved());
        w.setStatus(achieved ? "ACHIEVED" : "CLOSED");
        w.setAchieved(achieved ? 1 : 0);

        // 生成月光祝福
        if (Boolean.TRUE.equals(req.getAiBlessing())) {
            w.setBlessing(BLESSINGS[RANDOM.nextInt(BLESSINGS.length)]);
        }
        wishRepository.save(w);

        Map<String, Object> data = new HashMap<>();
        data.put("wishId", w.getWishNo());
        data.put("blessing", w.getBlessing());
        data.put("cost", 0);
        return data;
    }

    // ============ 私有 ============

    private void validateCategory(String category) {
        if (category == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "请选择分类");
        }
        switch (category) {
            case "study": case "career": case "love": case "health": case "other":
                return;
            default:
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "分类不合法");
        }
    }

    /**
     * 生成 wishNo：W-yyyyMMdd-NNNN，依赖 uk_wish_no 唯一约束 + 自旋重试。
     * 4 位随机 + UUID 兜底，不再用 count+1 偏移。
     */
    private String generateUniqueWishNo(int maxRetry) {
        String prefix = "W-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        java.util.concurrent.ThreadLocalRandom rnd = java.util.concurrent.ThreadLocalRandom.current();
        for (int i = 0; i < maxRetry; i++) {
            String candidate = prefix + String.format("%04d", rnd.nextInt(10000));
            if (!wishRepository.existsByWishNo(candidate)) {
                return candidate;
            }
        }
        return prefix + java.util.UUID.randomUUID().toString().substring(0, 8);
    }
}
