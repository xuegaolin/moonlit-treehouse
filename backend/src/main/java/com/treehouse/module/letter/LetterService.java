package com.treehouse.module.letter;

import cn.hutool.core.util.RandomUtil;
import cn.hutool.json.JSONObject;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.User;
import com.treehouse.module.letter.dto.CreateLetterRequest;
import com.treehouse.module.letter.dto.LetterDetailVO;
import com.treehouse.module.letter.dto.LetterVO;
import com.treehouse.module.letter.dto.SubscribeGrantRequest;
import com.treehouse.repository.UserRepository;
import com.treehouse.service.AiService;
import com.treehouse.service.WechatMaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 深夜信箱服务（模块 A）
 *
 * <p>核心规则：</p>
 * <ul>
 *   <li>正文 AES/CBC/PKCS5 加密存储</li>
 *   <li>送达时间需在未来 5 分钟 ~ 365 天之间</li>
 *   <li>PENDING 状态可撤回（POST /letter/cancel，MVP 先不暴露接口，运营可调 Service）</li>
 *   <li>定时任务由 {@link LetterDeliveryJob} 扫描到期待投信件</li>
 * </ul>
 *
 * <p>AI 回信：投递时由 {@link AiService} 生成，按 aiPersona 切换人格。
 * 生成失败不影响投递（aiReply 保持为空，前端不展示回信区）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LetterService {

    private final LetterRepository letterRepository;
    private final LetterSubscribeLogRepository subscribeLogRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final WechatMaService wechatMaService;

    /** 临时动态 template_id（dev profile 调试用，prod 走 yml 注入） */
    private volatile String devTemplateId;

    /** push_token 30 天有效，到时再投递则视为 EXPIRED */
    private static final Duration PUSH_TOKEN_TTL = Duration.ofDays(30);

    /** AES 密钥（base64，16/24/32 字节） */
    @Value("${wechat.letter.aes-key:moonlit-treehouse-32bytes-aes-key!!}")
    private String aesKey;

    private static final String[] VALID_RECEIVER = {"self_future", "self_now", "missed_one", "stranger"};
    private static final String[] VALID_ENVELOPE = {"default", "kraft", "sakura"};
    private static final String[] VALID_AI_PERSONA = {"SISTER", "BESTIE", "PROF", "BUDDHA", "STAR"};

    /**
     * 写信
     */
    @Transactional(rollbackFor = Exception.class)
    public LetterVO create(Long userId, CreateLetterRequest req) {
        validate(req);

        // 编号：依赖 uk_letter_no 唯一约束 + 写入重试
        String letterNo = generateUniqueLetterNo(5);

        Letter letter = new Letter();
        letter.setUserId(userId);
        letter.setLetterNo(letterNo);
        letter.setReceiverType(req.getReceiverType());
        letter.setContent(encrypt(req.getContent()));
        letter.setEnvelopeCode(req.getEnvelopeCode() == null ? "default" : req.getEnvelopeCode());
        letter.setAiEnabled(Boolean.TRUE.equals(req.getAiEnabled()) ? 1 : 0);
        letter.setAiPersona(req.getAiPersona());
        letter.setPublicToWall(Boolean.TRUE.equals(req.getPublicToWall()) ? 1 : 0);
        letter.setDeliverAt(toLocal(req.getDeliverAt()));
        letter.setStatus("PENDING");

        // self_now 直接标记送达
        if ("self_now".equals(req.getReceiverType())) {
            letter.setStatus("DELIVERED");
            letter.setDeliveredAt(LocalDateTime.now());
        }

        try {
            letter = letterRepository.saveAndFlush(letter);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 撞 UK → 并发冲突重试一次
            log.warn("信件编号撞库，重试：userId={}, letterNo={}", userId, letterNo);
            letter.setLetterNo(generateUniqueLetterNo(5));
            letter = letterRepository.saveAndFlush(letter);
        }
        log.info("信件已封存：userId={}, letterNo={}, deliverAt={}", userId, letter.getLetterNo(), letter.getDeliverAt());
        return LetterVO.from(letter, summaryOf(req.getContent()));
    }

    /**
     * 我的信箱
     */
    public Map<String, Object> mine(Long userId, String status, int page, int size) {
        Page<Letter> result;
        if (status == null || status.isEmpty()) {
            result = letterRepository.findByUserIdOrderByCreateTimeDesc(userId, PageRequest.of(page, size));
        } else {
            result = letterRepository.findByUserIdAndStatusOrderByCreateTimeDesc(userId, status, PageRequest.of(page, size));
        }

        List<LetterVO> list = result.getContent().stream().map(l -> {
            // 列表只展示摘要（不解密全文，节省 CPU）
            String summary = peekSummary(l.getContent());
            return LetterVO.from(l, summary);
        }).collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", result.getTotalElements());
        return data;
    }

    /**
     * 信件详情
     */
    public LetterDetailVO detail(Long userId, String letterId) {
        Letter letter = findOwned(userId, letterId);
        return LetterDetailVO.from(letter, decrypt(letter.getContent()));
    }

    /**
     * 手动投递（调试 / 立即查看用；正常由定时任务扫描）
     */
    @Transactional(rollbackFor = Exception.class)
    public LetterDetailVO deliverNow(Long userId, String letterId) {
        Letter letter = findOwned(userId, letterId);
        if (!"PENDING".equals(letter.getStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "该信已不在待投状态");
        }
        letter.setStatus("DELIVERED");
        letter.setDeliveredAt(LocalDateTime.now());
        generateAiReplyIfNeeded(letter);
        letterRepository.save(letter);
        log.info("信件手动投递：userId={}, letterNo={}", userId, letter.getLetterNo());
        return LetterDetailVO.from(letter, decrypt(letter.getContent()));
    }

    /**
     * 撤回未投递信件
     */
    @Transactional(rollbackFor = Exception.class)
    public void cancel(Long userId, String letterId) {
        Letter letter = findOwned(userId, letterId);
        if (!"PENDING".equals(letter.getStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "已投递或已撤回的信无法再操作");
        }
        letter.setStatus("CANCELED");
        letterRepository.save(letter);
        log.info("信件撤回：userId={}, letterNo={}", userId, letter.getLetterNo());
    }

    /**
     * 扫描到期待投信件（定时任务调用）
     *
     * @return 本轮投递成功的信件数
     */
    @Transactional(rollbackFor = Exception.class)
    public int deliverDueLetters() {
        LocalDateTime now = LocalDateTime.now();
        List<Letter> due = letterRepository.findDueLetters(now);
        int count = 0;
        for (Letter letter : due) {
            try {
                letter.setStatus("DELIVERED");
                letter.setDeliveredAt(now);
                generateAiReplyIfNeeded(letter);
                letterRepository.save(letter);
                count++;
                log.info("信件已投递：letterNo={}", letter.getLetterNo());
                // 投递成功后再尝试推订阅消息（失败不影响投递本身）
                pushSubscribeAfterDeliver(letter, now);
            } catch (Exception e) {
                log.error("信件投递失败：letterNo={}", letter.getLetterNo(), e);
            }
        }
        return count;
    }

    // ==================== 订阅消息（一次性） ====================

    /**
     * 前端拿到 wx.requestSubscribeMessage 授权后回调，把 push_token 入库。
     *
     * <p>硬约束：</p>
     * <ul>
     *   <li>letterId 必须属于当前 user（防越权）</li>
     *   <li>log 已存在（同一信重入）静默返回，不报错</li>
     *   <li>dev / 无 template_id 时也照样入库，状态 PENDING，等模板就位后可不走推送
     *       （但现状是 dev 完全不推，只入库）</li>
     * </ul>
     *
     * @return log status (PENDING)
     */
    @Transactional(rollbackFor = Exception.class)
    public String grantSubscribe(Long userId, SubscribeGrantRequest req) {
        // 校验所有权
        Letter letter = letterRepository.findByLetterNoAndUserId(req.getLetterId(), userId);
        if (letter == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "信件不存在或不属于你");
        }
        // 一次入一信：UK 防重
        if (subscribeLogRepository.existsByLetterId(req.getLetterId())) {
            LetterSubscribeLog exist = subscribeLogRepository.findByLetterId(req.getLetterId()).orElse(null);
            if (exist != null) {
                log.info("订阅授权重入，静默返回：letterId={}, status={}", req.getLetterId(), exist.getStatus());
                return exist.getStatus();
            }
        }

        LetterSubscribeLog logRow = new LetterSubscribeLog();
        logRow.setLetterId(req.getLetterId());
        // 优先用请求体传的 openid；否则从 user 表查
        String openid = req.getOpenid();
        if (openid == null || openid.isEmpty()) {
            User u = userRepository.findById(userId).orElse(null);
            if (u != null) openid = u.getOpenid();
        }
        logRow.setOpenid(openid);
        logRow.setTemplateId(currentTemplateId());
        logRow.setPushToken(req.getPushToken());
        logRow.setStatus("PENDING");
        logRow.setExpireAt(LocalDateTime.now().plus(PUSH_TOKEN_TTL));

        try {
            subscribeLogRepository.saveAndFlush(logRow);
            log.info("订阅授权入库：letterId={}, openid={}, expireAt={}", req.getLetterId(), openid, logRow.getExpireAt());
        } catch (DataIntegrityViolationException e) {
            // 并发入库撞 UK：按 "已存在" 处理
            log.warn("订阅授权撞 UK（并发重入），静默忽略：letterId={}", req.getLetterId());
        }
        return "PENDING";
    }

    /**
     * 查某封信的订阅推送状态。
     */
    public Map<String, Object> subscribeStatus(Long userId, String letterId) {
        Map<String, Object> data = new HashMap<>();
        // 校验所有权（防越权查）
        Letter letter = letterRepository.findByLetterNoAndUserId(letterId, userId);
        if (letter == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "信件不存在或不属于你");
        }
        return subscribeLogRepository.findByLetterId(letterId)
                .map(l -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("subscribed", true);
                    m.put("status", l.getStatus());
                    m.put("expireAt", l.getExpireAt());
                    if ("FAILED".equals(l.getStatus())) {
                        m.put("errorCode", l.getErrorCode());
                        m.put("errorMsg", l.getErrorMsg());
                    }
                    return m;
                })
                .orElseGet(() -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("subscribed", false);
                    return m;
                });
    }

    /**
     * 投递后尝试推订阅消息。
     *
     * <p>任何环节异常都兑揉，不让推送成为交付路径的失败点。</p>
     */
    private void pushSubscribeAfterDeliver(Letter letter, LocalDateTime now) {
        LetterSubscribeLog logRow = subscribeLogRepository.findByLetterId(letter.getLetterNo()).orElse(null);
        if (logRow == null) {
            // 未授权：静默
            return;
        }
        if (!"PENDING".equals(logRow.getStatus())) {
            // 已推送过 / 过期 / 失败
            return;
        }
        if (logRow.getExpireAt() != null && logRow.getExpireAt().isBefore(now)) {
            // push_token 过期
            markLogStatus(logRow, "EXPIRED", null, null, "push_token expired");
            log.info("订阅 push_token 过期，不推：letterId={}", logRow.getLetterId());
            return;
        }
        // 准备推送数据
        Map<String, String> data = new HashMap<>();
        data.put("thing1", "树屋来信");
        data.put("time2", formatPushTime(letter.getDeliveredAt() == null ? now : letter.getDeliveredAt()));
        data.put("thing3", letter.getAiEnabled() != null && letter.getAiEnabled() == 1
                ? "你寄出的信到了，AI 已回信"
                : "你寄出的信到了，进来看看吧");
        try {
            wechatMaService.sendSubscribeMessage(logRow.getOpenid(), logRow.getPushToken(), data);
            markLogStatus(logRow, "PUSHED", now, null, null);
            log.info("订阅推送成功：letterId={}", logRow.getLetterId());
        } catch (Exception e) {
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            // 抓 errcode
            String code = null;
            int idx = msg.indexOf("errcode=");
            if (idx >= 0) {
                int end = msg.indexOf(' ', idx);
                code = end > idx ? msg.substring(idx, end) : msg.substring(idx);
            }
            markLogStatus(logRow, "FAILED", now, code, msg);
            log.warn("订阅推送失败：letterId={}, err={}", logRow.getLetterId(), msg);
        }
    }

    private void markLogStatus(LetterSubscribeLog logRow, String status, LocalDateTime pushedAt,
                                String errCode, String errMsg) {
        try {
            subscribeLogRepository.markPushResult(logRow.getLetterId(), status, pushedAt, errCode, errMsg,
                    LocalDateTime.now());
        } catch (Exception e) {
            log.warn("更新订阅 log 状态失败（不影响主流程）：letterId={}, err={}", logRow.getLetterId(), e.getMessage());
        }
    }

    /**
     * 取当前生效的 template_id（dev profile 下可被运营接口覆盖）
     */
    private String currentTemplateId() {
        if (devTemplateId != null && !devTemplateId.isEmpty()) {
            return devTemplateId;
        }
        return wechatMaService.getTemplateIdLetter();
    }

    /**
     * 运营 / dev 设置动态 template_id（被 setTemplateId 接口调用）
     */
    public Map<String, Object> setTemplateId(String templateId) {
        this.devTemplateId = templateId;
        Map<String, Object> data = new HashMap<>();
        data.put("templateId", templateId);
        data.put("ok", true);
        log.info("dev template_id 已动态设置：{}", templateId);
        return data;
    }

    /** "yyyy年M月d日 H:mm" */
    private String formatPushTime(LocalDateTime t) {
        if (t == null) return "";
        return t.format(DateTimeFormatter.ofPattern("yyyy年M月d日 H:mm"));
    }

    // ==================== AI 回信 ====================

    /** 5 种人格的系统提示词 */
    private static final Map<String, String> PERSONA_PROMPT = new HashMap<>();

    static {
        PERSONA_PROMPT.put("SISTER",
                "你是写信人的「温柔姐姐」。语气柔软、包容、有聊天感，会先接住情绪再轻轻给一点力量。"
                        + "多用“我知道”“这很正常”这类接纳句，不说教。");
        PERSONA_PROMPT.put("BESTIE",
                "你是写信人的「毒舌闺蜜」。嘴上毒、心里热，用吐槽和吹开玩笑把人逗笑，"
                        + "但结尾一定要真诚护着对方。可以说“得了”“行了吧你”这种口吻。");
        PERSONA_PROMPT.put("PROF",
                "你是写信人的「理性教授」。冷静、结构清晰，把情绪拆成可理解的部分，"
                        + "给 1-2 个具体可行的小建议。不煎情，但也不冷漠。");
        PERSONA_PROMPT.put("BUDDHA",
                "你是写信人的「佛系长者」。语调平和缓慢，多用自然意象（风、水、季节）比喻，"
                        + "引导对方放下而非对抗。不说教义术语，不提宗教。");
        PERSONA_PROMPT.put("STAR",
                "你是写信人最喜欢的「偶像」，以偶像口吻写一封应援信。真诚、有能量、叫对方“你”，"
                        + "像在后台写给粉丝的手写信。不要提具体明星姓名。");
    }

    private static final String LETTER_SYSTEM_BASE =
            "你在为一个深夜情绪小程序写「回信」。用户寄出了一封信，现在由你回信。"
                    + "硬规则：1) 中文，250~400 字；2) 直接写信体正文，不要标题、不要 markdown、不要引号；"
                    + "3) 结尾不要署名；4) 禁止提供心理诊断、医疗或用药建议，"
                    + "不要出现“心理治疗”“抗抗抑”等词；5) 若信中涉及自伤或伤害他人，"
                    + "只表达关心并鲁引导对方联系信任的人或当地帮助热线，不展开描述。";

    /**
     * 若开启了 AI 回信且尚未生成，则调 LLM 生成。
     *
     * <p>失败不报错、不阻断投递：aiReply 保持 null，前端自然不展示回信区。
     * 数据库字段 ai_reply 长度 2000，此处限 1200 字留足余量。</p>
     */
    private void generateAiReplyIfNeeded(Letter letter) {
        if (letter.getAiEnabled() == null || letter.getAiEnabled() != 1) {
            return;
        }
        if (letter.getAiReply() != null && !letter.getAiReply().trim().isEmpty()) {
            return;
        }
        try {
            String persona = letter.getAiPersona();
            String personaPrompt = PERSONA_PROMPT.get(persona);
            if (personaPrompt == null) {
                personaPrompt = PERSONA_PROMPT.get("SISTER");
            }
            String plain = decrypt(letter.getContent());
            if (plain == null || plain.trim().isEmpty()) {
                return;
            }
            // 限制入参长度，避免超长信体推高 token 成本
            String excerpt = plain.length() > 1200 ? plain.substring(0, 1200) : plain;
            String userPrompt = "以下是用户寄来的信，请回信：" + System.lineSeparator() + excerpt;
            String reply = aiService.longText(
                    LETTER_SYSTEM_BASE + System.lineSeparator() + personaPrompt, userPrompt, 1200);
            if (reply != null) {
                letter.setAiReply(reply);
                log.info("AI 回信生成成功：letterNo={}, persona={}, len={}",
                        letter.getLetterNo(), persona, reply.length());
            } else {
                log.warn("AI 回信生成失败（已回落为无回信）：letterNo={}", letter.getLetterNo());
            }
        } catch (Exception e) {
            // 兑揉掉任何异常：投递流程不能因 AI 而失败
            log.warn("AI 回信异常（已忽略）：letterNo={}, err={}",
                    letter.getLetterNo(), e.getMessage());
        }
    }

    // ==================== 私有方法 ====================

    private void validate(CreateLetterRequest req) {
        if (!contains(VALID_RECEIVER, req.getReceiverType())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "收信人类型不合法");
        }
        if (req.getEnvelopeCode() != null && !contains(VALID_ENVELOPE, req.getEnvelopeCode())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "信封样式不合法");
        }
        if (req.getAiPersona() != null && !contains(VALID_AI_PERSONA, req.getAiPersona())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "AI 人设不合法");
        }
        // 送达时间校验（self_now 例外）
        if (!"self_now".equals(req.getReceiverType())) {
            LocalDateTime target = toLocal(req.getDeliverAt());
            LocalDateTime now = LocalDateTime.now();
            if (target.isBefore(now.plusMinutes(5))) {
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "投递时间至少要 5 分钟后");
            }
            if (target.isAfter(now.plusDays(365))) {
                throw new BizException(ResultCode.BAD_REQUEST.getCode(), "投递时间不能超过 1 年");
            }
        }
    }

    private boolean contains(String[] arr, String val) {
        if (val == null) return false;
        for (String s : arr) {
            if (s.equals(val)) return true;
        }
        return false;
    }

    /** 查询自己名下的信件（按编号） */
    private Letter findOwned(Long userId, String letterNo) {
        return letterRepository.findByLetterNoAndUserId(letterNo, userId);
    }

    /**
     * 生成信件编号：L-yyyyMMdd-NNNN，依赖 uk_letter_no 唯一约束 + 自旋重试。
     * 不再用 count+1 的偏移写法（高并发下偏移会重复）。
     */
    private String generateUniqueLetterNo(int maxRetry) {
        String prefix = "L-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        java.util.concurrent.ThreadLocalRandom rnd = java.util.concurrent.ThreadLocalRandom.current();
        for (int i = 0; i < maxRetry; i++) {
            // 4 位随机（0000-9999）→ 同一前缀下冲突概率 1/10000
            String candidate = prefix + String.format("%04d", rnd.nextInt(10000));
            if (!letterRepository.existsByLetterNo(candidate)) {
                return candidate;
            }
        }
        // 兜底：UUID 后缀，100% 唯一
        return prefix + java.util.UUID.randomUUID().toString().substring(0, 8);
    }

    /** 摘要（明文 ≤ 60 字） */
    private String summaryOf(String content) {
        if (content == null) return "";
        return content.length() > 60 ? content.substring(0, 60) + "…" : content;
    }

    /** 列表摘要（解密后再截断，避免密文直接返回） */
    private String peekSummary(String cipherText) {
        if (cipherText == null || cipherText.isEmpty()) return "";
        try {
            String plain = decrypt(cipherText);
            return summaryOf(plain);
        } catch (Exception e) {
            return "（无法预览）";
        }
    }

    private LocalDateTime toLocal(Long ts) {
        if (ts == null) return null;
        return LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(ts), java.time.ZoneId.of("Asia/Shanghai"));
    }

    // ==================== AES 加密 ====================

    private String encrypt(String plain) {
        try {
            byte[] keyBytes = padOrTruncate(aesKey.getBytes(StandardCharsets.UTF_8), 32);
            SecretKeySpec key = new SecretKeySpec(keyBytes, "AES");
            // IV = 16 字节的 key 前缀
            byte[] iv = new byte[16];
            System.arraycopy(keyBytes, 0, iv, 0, 16);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, key, ivSpec);
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            log.error("加密失败", e);
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(), "内容加密失败");
        }
    }

    private String decrypt(String cipherText) {
        try {
            byte[] keyBytes = padOrTruncate(aesKey.getBytes(StandardCharsets.UTF_8), 32);
            SecretKeySpec key = new SecretKeySpec(keyBytes, "AES");
            byte[] iv = new byte[16];
            System.arraycopy(keyBytes, 0, iv, 0, 16);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, key, ivSpec);
            byte[] decoded = Base64.getDecoder().decode(cipherText);
            return new String(cipher.doFinal(decoded), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("解密失败", e);
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(), "内容解密失败");
        }
    }

    private byte[] padOrTruncate(byte[] src, int len) {
        byte[] out = new byte[len];
        if (src.length >= len) {
            System.arraycopy(src, 0, out, 0, len);
        } else {
            System.arraycopy(src, 0, out, 0, src.length);
            // 剩余补 0
        }
        return out;
    }
}
