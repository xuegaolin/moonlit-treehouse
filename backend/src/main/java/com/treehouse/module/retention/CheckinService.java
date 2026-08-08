package com.treehouse.module.retention;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.service.CoinService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 留存钩子服务：每日签到 + 连续天数 + 勋章体系。
 *
 * <p>这是产品的回访理由。原 PRD 写了签到与勋章但从未实现，导致用户没有任何"明天再来"的动机。</p>
 *
 * <p><b>并发设计</b>（遵循 7/31 并发审计硬规则）：
 * <ul>
 *   <li>重复签到：靠 t_checkin 的 UK(user_id, checkin_date) 拦，catch
 *       DataIntegrityViolationException 判为"今日已签"，不做 exists 预检</li>
 *   <li>连续天数：走 {@link UserGrowthRepository#advanceStreak} 原子 SQL，
 *       条件里带 last_checkin_date &lt;&gt; today，天然幂等</li>
 *   <li>勋章颁发：靠 t_medal 的 UK(user_id, medal_code) 拦重复</li>
 *   <li>月光币：走 {@link CoinService#change} 的原子累加</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckinService {

    private final CheckinRepository checkinRepository;
    private final UserGrowthRepository growthRepository;
    private final MedalRepository medalRepository;
    private final CoinService coinService;

    /**
     * 连续签到奖励阶梯：连签越久给得越多，制造"不想断"的心理成本。
     * 第 1~2 天 1 币，第 3~6 天 2 币，第 7~13 天 3 币，第 14~29 天 5 币，第 30 天起 8 币。
     * <p>v1.5 饥饿营销：阶梯值砍到原来 1/2~1/3 区间，避免用户过快积累月光币（最终走 7/31 付费）</p>
     */
    private static int coinRewardFor(int streak) {
        if (streak >= 30) {
            return 8;
        }
        if (streak >= 14) {
            return 5;
        }
        if (streak >= 7) {
            return 3;
        }
        if (streak >= 3) {
            return 2;
        }
        return 1;
    }

    /** 勋章目录：code -> {name, 需要的连续天数} */
    private static final Map<String, Object[]> MEDAL_CATALOG = new LinkedHashMap<>();

    static {
        MEDAL_CATALOG.put("STREAK_3", new Object[]{"三日微光", 3});
        MEDAL_CATALOG.put("STREAK_7", new Object[]{"一周有你", 7});
        MEDAL_CATALOG.put("STREAK_30", new Object[]{"月满树屋", 30});
        MEDAL_CATALOG.put("STREAK_100", new Object[]{"百夜不熄", 100});
    }

    /**
     * 每日签到。
     *
     * @return 签到结果视图（含本次奖励、连续天数、新解锁勋章）
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> checkin(Long userId) {
        LocalDate today = LocalDate.now();

        // 1) 确保成长档存在（首次签到时创建）
        ensureGrowth(userId);

        // 2) 先插签到流水：拿 t_checkin 的 UK(user_id, checkin_date) 做第一道门。
        //    放在最前面是故意的 —— 若先去 UPDATE 成长档，并发请求会全部排队抢同一行的行锁，
        //    导致后来者长时间阻塞甚至锁等待超时（实测 10 并发下 9 个超时/500）。
        //    先抢一个很轻的唤作为并发闸门，重复请求能立即拿到友好提示。
        Checkin record = new Checkin();
        record.setUserId(userId);
        record.setCheckinDate(today);
        record.setStreakDays(1);
        record.setCoinReward(0);
        try {
            checkinRepository.saveAndFlush(record);
        } catch (DataIntegrityViolationException e) {
            log.info("签到重复（DB UK 拦下）：userId={}, date={}", userId, today);
            throw new BizException(ResultCode.TOO_FREQUENT.getCode(), "今天已经签到过啦，明天再来");
        }

        // 3) 原子推进连续天数（此时已通过闸门，同一用户同一天只会走到这里一次）
        growthRepository.advanceStreak(userId, today);

        // 4) 读回推进后的连续天数
        UserGrowth growth = growthRepository.findByUserId(userId)
                .orElseThrow(() -> new BizException(ResultCode.INTERNAL_ERROR.getCode(), "成长档异常"));
        int streak = growth.getCurrentStreak() == null ? 1 : growth.getCurrentStreak();

        int reward = coinRewardFor(streak);

        // 5) 回写流水的快照字段
        record.setStreakDays(streak);
        record.setCoinReward(reward);
        checkinRepository.save(record);

        // 5) 发月光币（原子累加，内部已处理每日上限）
        int balance = 0;
        try {
            balance = coinService.change(userId, reward, "CHECKIN", today.toString());
        } catch (Exception e) {
            // 币没发成功不影响签到本身，记日志即可
            log.warn("签到发币失败（签到已生效）：userId={}, err={}", userId, e.getMessage());
        }

        // 6) 结算勋章
        List<Map<String, Object>> newMedals = grantMedals(userId, streak);

        Map<String, Object> data = new HashMap<>();
        data.put("checkinDate", today.toString());
        data.put("streakDays", streak);
        data.put("maxStreak", growth.getMaxStreak());
        data.put("totalDays", growth.getTotalCheckinDays());
        data.put("coinReward", reward);
        data.put("coinBalance", balance);
        data.put("newMedals", newMedals);
        data.put("nextReward", coinRewardFor(streak + 1));
        data.put("encourage", encourageText(streak));
        log.info("签到成功：userId={}, streak={}, reward={}, newMedals={}",
                userId, streak, reward, newMedals.size());
        return data;
    }

    /**
     * 签到状态（首页/个人页展示，不产生副作用）。
     */
    public Map<String, Object> status(Long userId) {
        LocalDate today = LocalDate.now();
        Optional<UserGrowth> gOpt = growthRepository.findByUserId(userId);
        boolean checkedToday = checkinRepository.findByUserIdAndCheckinDate(userId, today).isPresent();

        int streak = 0;
        int maxStreak = 0;
        int total = 0;
        if (gOpt.isPresent()) {
            UserGrowth g = gOpt.get();
            total = g.getTotalCheckinDays() == null ? 0 : g.getTotalCheckinDays();
            maxStreak = g.getMaxStreak() == null ? 0 : g.getMaxStreak();
            // 断签判定：最后签到既不是今天也不是昨天，则当前连续已归零
            LocalDate last = g.getLastCheckinDate();
            if (last != null && (last.equals(today) || last.equals(today.minusDays(1)))) {
                streak = g.getCurrentStreak() == null ? 0 : g.getCurrentStreak();
            }
        }

        // 近 31 天签到日期，供前端画日历
        List<LocalDate> recent = checkinRepository.findDatesBetween(userId, today.minusDays(30), today);
        List<String> recentStr = new ArrayList<>();
        for (LocalDate d : recent) {
            recentStr.add(d.toString());
        }

        Map<String, Object> data = new HashMap<>();
        data.put("checkedToday", checkedToday);
        data.put("streakDays", streak);
        data.put("maxStreak", maxStreak);
        data.put("totalDays", total);
        data.put("todayReward", coinRewardFor(streak + (checkedToday ? 0 : 1)));
        data.put("recentDates", recentStr);
        data.put("medals", medalListView(userId));
        return data;
    }

    /** 勋章墙（含未解锁项，用于展示进度） */
    public Map<String, Object> medals(Long userId) {
        Map<String, Object> data = new HashMap<>();
        data.put("medals", medalListView(userId));
        return data;
    }

    // ==================== 私有 ====================

    /** 首次签到时创建成长档；UK 冲突说明并发已创建，忽略即可 */
    private void ensureGrowth(Long userId) {
        if (growthRepository.findByUserId(userId).isPresent()) {
            return;
        }
        UserGrowth g = new UserGrowth();
        g.setUserId(userId);
        g.setCurrentStreak(0);
        g.setMaxStreak(0);
        g.setTotalCheckinDays(0);
        try {
            growthRepository.saveAndFlush(g);
        } catch (DataIntegrityViolationException e) {
            log.debug("成长档并发创建（DB UK 拦下），忽略：userId={}", userId);
        }
    }

    /** 按连续天数结算勋章，返回本次新解锁的 */
    private List<Map<String, Object>> grantMedals(Long userId, int streak) {
        List<Map<String, Object>> granted = new ArrayList<>();
        for (Map.Entry<String, Object[]> e : MEDAL_CATALOG.entrySet()) {
            String code = e.getKey();
            String name = (String) e.getValue()[0];
            int need = (Integer) e.getValue()[1];
            if (streak < need) {
                continue;
            }
            if (medalRepository.existsByUserIdAndMedalCode(userId, code)) {
                continue;
            }
            Medal m = new Medal();
            m.setUserId(userId);
            m.setMedalCode(code);
            m.setMedalName(name);
            try {
                medalRepository.saveAndFlush(m);
                Map<String, Object> v = new HashMap<>();
                v.put("code", code);
                v.put("name", name);
                v.put("needDays", need);
                granted.add(v);
                log.info("勋章解锁：userId={}, medal={}", userId, code);
            } catch (DataIntegrityViolationException ex) {
                // 并发重复颁发，DB UK 拦下，静默跳过
                log.debug("勋章并发重复（DB UK 拦下）：userId={}, medal={}", userId, code);
            }
        }
        return granted;
    }

    /** 勋章墙视图：全目录 + 是否已解锁 */
    private List<Map<String, Object>> medalListView(Long userId) {
        List<Medal> owned = medalRepository.findByUserIdOrderByAchievedAtDesc(userId);
        Map<String, Medal> ownedMap = new HashMap<>();
        for (Medal m : owned) {
            ownedMap.put(m.getMedalCode(), m);
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<String, Object[]> e : MEDAL_CATALOG.entrySet()) {
            Map<String, Object> v = new HashMap<>();
            String code = e.getKey();
            v.put("code", code);
            v.put("name", e.getValue()[0]);
            v.put("needDays", e.getValue()[1]);
            Medal m = ownedMap.get(code);
            v.put("achieved", m != null);
            v.put("achievedAt", m == null ? null : m.getAchievedAt().toString());
            list.add(v);
        }
        return list;
    }

    /** 连续天数对应的鼓励文案（制造情绪价值，别只给数字） */
    private String encourageText(int streak) {
        if (streak == 1) {
            return "今晚也来了，树屋给你留了灯。";
        }
        if (streak < 3) {
            return "连着来第 " + streak + " 天了，这份坚持树屋记着。";
        }
        if (streak < 7) {
            return "连签 " + streak + " 天，你比自己想的更能坚持。";
        }
        if (streak < 30) {
            return "整整 " + streak + " 天了，这盏灯因为你才亮着。";
        }
        return "第 " + streak + " 天。你已经是树屋的老朋友了。";
    }
}
