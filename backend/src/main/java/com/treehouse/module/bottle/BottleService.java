package com.treehouse.module.bottle;

import cn.hutool.core.util.RandomUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.common.R;
import com.treehouse.module.bottle.dto.BottleVO;
import com.treehouse.module.bottle.dto.PublishBottleRequest;
import com.treehouse.module.bottle.dto.WarmRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

/**
 * 漂流墙服务（模块 E）
 *
 * <p>核心规则：</p>
 * <ul>
 *   <li>投递后进入 PENDING 审核，MVP 假审核（直接 PASSED）</li>
 *   <li>信息流：默认按时间倒序，sort=hot 按 warm_count desc</li>
 *   <li>温暖：每人对同一瓶子只 1 次；hug=免费，candy=6月币，candle=8月币（v1.x）</li>
 *   <li>匿名 ID 落库即生成，永远不暴露 user_id</li>
 * </ul>
 *
 * <p>TODO(v1.x)：对接微信内容安全 msgSecCheck V2</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BottleService {

    private final BottleRepository bottleRepository;
    private final BottleWarmRepository bottleWarmRepository;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Random RANDOM = new Random();

    /** 简单敏感词（v1.x 替换为微信内容安全接口） */
    private static final String[] SIMPLE_BAD_WORDS = {"色情", "赌博", "毒品", "枪支"};

    /**
     * 发布
     */
    @Transactional(rollbackFor = Exception.class)
    public BottleVO publish(Long userId, PublishBottleRequest req) {
        // 简单敏感词脱敏
        String content = req.getContent().trim();
        for (String bad : SIMPLE_BAD_WORDS) {
            if (content.contains(bad)) {
                throw new BizException(ResultCode.CONTENT_VIOLATION);
            }
        }

        Bottle b = new Bottle();
        b.setUserId(userId);
        b.setBottleNo(generateUniqueBottleNo(5));
        b.setContent(content);
        b.setAnonymousId(generateAnonymousId());
        b.setTagsJson(toJson(req.getTags()));
        b.setAuditStatus("PASSED");  // MVP 直接通过；v1.x 接微信接口
        b.setWarmCount(0);
        try {
            b = bottleRepository.saveAndFlush(b);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 撞瓶号 UK → 重试一次
            log.warn("瓶号撞库，重试：userId={}, bottleNo={}", userId, b.getBottleNo());
            b.setBottleNo(generateUniqueBottleNo(5));
            b = bottleRepository.saveAndFlush(b);
        }

        log.info("瓶子已投递：userId={}, bottleNo={}", userId, b.getBottleNo());
        return BottleVO.from(b);
    }

    /**
     * 信息流
     */
    public Map<String, Object> feed(Long currentUserId, String tag, String sort, int page, int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(size, 50));
        Page<Bottle> result;

        if (tag != null && !tag.isEmpty()) {
            result = bottleRepository.findByAuditStatusAndTagsJsonContainingOrderByCreateTimeDesc(
                    "PASSED", tag, pageable);
        } else if ("hot".equals(sort)) {
            result = bottleRepository.findByAuditStatusOrderByWarmCountDescCreateTimeDesc("PASSED", pageable);
        } else {
            result = bottleRepository.findByAuditStatusOrderByCreateTimeDesc("PASSED", pageable);
        }

        List<Bottle> bottles = result.getContent();

        // 一次查出当前用户温暖过的瓶子 id（避免每条瓶子都 exists 查一次）
        final java.util.Set<Long> warmedIds;
        if (currentUserId != null && !bottles.isEmpty()) {
            List<Long> ids = bottles.stream().map(Bottle::getId).collect(Collectors.toList());
            warmedIds = new java.util.HashSet<>(
                    bottleWarmRepository.findBottleIdsByUserIdAndBottleIdIn(currentUserId, ids));
        } else {
            warmedIds = java.util.Collections.emptySet();
        }

        List<BottleVO> list = bottles.stream()
                .map(b -> BottleVO.from(b, currentUserId, warmedIds.contains(b.getId())))
                .collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", result.getTotalElements());
        data.put("page", page);
        data.put("size", size);
        return data;
    }

    /**
     * 温暖
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> warm(Long userId, WarmRequest req) {
        Bottle bottle = bottleRepository.findByBottleNo(req.getBottleId())
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));

        if (!"PASSED".equals(bottle.getAuditStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "瓶子未通过审核");
        }
        if (bottle.getUserId().equals(userId)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "不能温暖自己的瓶子");
        }
        // 重复温暖检测交给 uk_bottle_user 唯一约束去保
        // 预查询只是为了给出更友好的提示
        if (bottleWarmRepository.existsByBottleIdAndUserId(bottle.getId(), userId)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "你已经温暖过这个瓶子啦");
        }

        // 扣月光币（v1.x 接 CoinService）
        int cost = giftCost(req.getGiftType());
        if (cost > 0) {
            // TODO(v1.x)：CoinService.change(userId, -cost, "BOTTLE_WARM", bottle.getBottleNo())
        }

        BottleWarm warm = new BottleWarm();
        warm.setBottleId(bottle.getId());
        warm.setUserId(userId);
        warm.setGiftType(req.getGiftType());
        warm.setCoinCost(cost);
        try {
            bottleWarmRepository.saveAndFlush(warm);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 撞 uk_bottle_user → 另一线程已温暖成功
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "你已经温暖过这个瓶子啦");
        }

        // 原子累加热度（无需读取旧值，避免 TOCTOU）
        bottleRepository.incrWarmCount(bottle.getId());
        // 清 session 缓存以便后续读是新值（事务内）
        bottleRepository.flush();
        long newCount = bottleWarmRepository.countByBottleId(bottle.getId());

        Map<String, Object> data = new HashMap<>();
        data.put("warmedTotal", newCount);
        data.put("giftType", req.getGiftType());
        return data;
    }

    // ============ 私有 ============

    private int giftCost(String giftType) {
        switch (giftType == null ? "hug" : giftType) {
            case "hug":    return 0;
            case "candy":  return 6;
            case "candle": return 8;
            default:       return 0;
        }
    }

    /**
     * 生成瓶号：B-yyyyMMdd-NNNN，依赖 uk_bottle_no 唯一约束 + 自旋重试。
     * 4 位随机 + UUID 兜底，不再用 count+1 偏移。
     */
    private String generateUniqueBottleNo(int maxRetry) {
        String prefix = "B-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        java.util.concurrent.ThreadLocalRandom rnd = java.util.concurrent.ThreadLocalRandom.current();
        for (int i = 0; i < maxRetry; i++) {
            String candidate = prefix + String.format("%04d", rnd.nextInt(10000));
            if (!bottleRepository.existsByBottleNo(candidate)) {
                return candidate;
            }
        }
        return prefix + java.util.UUID.randomUUID().toString().substring(0, 8);
    }

    private String generateAnonymousId() {
        // 路人-XXXX（4 位字母+数字）
        return "路人-" + RandomUtil.randomString(4).toUpperCase();
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
