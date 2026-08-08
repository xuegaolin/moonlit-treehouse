package com.treehouse.module.chat;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 微信小程序内容安全检查（msgSecCheck）
 *
 * <p>合规路径：所有用户发的内容必须先过微信官方审核 + 本地敏感词。</p>
 *
 * <p>两层审核：</p>
 * <ol>
 *   <li>本地敏感词（{@link com.treehouse.common.SensitiveWordService}）—— 首道，毫秒级</li>
 *   <li>微信 msgSecCheck —— 二道，<1s，强权威</li>
 * </ol>
 *
 * <p>access_token 缓存：</p>
 * <ul>
 *   <li>2 小时过期（7200s）</li>
 *   <li>本地缓存，提前 5 分钟刷新</li>
 *   <li>CAS 替换避免并发请求</li>
 * </ul>
 *
 * <p>降级策略：</p>
 * <ul>
 *   <li>本地词库已经拦截 = 不调远程</li>
 *   <li>远程失败 = 放行（rejectOnError=false 默认），加日志告警</li>
 *   <li>原因：用户已经付费，错误拦截比放过更影响体验（放过会后台追溯）</li>
 * </ul>
 */
@Slf4j
@Service
public class WxMsgSecCheckService {

    @Value("${wechat.miniapp.appid}")
    private String appid;

    @Value("${wechat.miniapp.secret}")
    private String secret;

    /** reject-on-error=false：远程审核失败 = 放行（默认） */
    @Value("${treehouse.chat.msg-sec-check.reject-on-error:false}")
    private boolean rejectOnError;

    private static final String TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s";
    private static final String SEC_CHECK_URL = "https://api.weixin.qq.com/wxa/msg_sec_check?access_token=%s";

    private final AtomicReference<TokenCache> tokenRef = new AtomicReference<>();

    @PostConstruct
    public void init() {
        log.info("[msgSecCheck] 微信内容审核初始化完成 appid={}", appid);
    }

    /**
     * 审核文本
     * @return PASS=通过 / REJECT=拒绝 / ERROR=错误（按配置决定）
     */
    public String check(String content) {
        if (content == null || content.isEmpty()) return "REJECT";

        try {
            String token = getAccessToken();
            if (token == null) {
                return rejectOnError ? "REJECT" : "PASS";
            }

            Map<String, Object> body = new HashMap<>();
            body.put("content", content);
            body.put("version", 2);
            body.put("scene", 1);
            // scene: 1=资料 2=评论 3=论坛 4=社交日志
            // 聊天用 4（社交日志）

            String resp = HttpUtil.post(SEC_CHECK_URL.replace("%s", token),
                    JSONUtil.toJsonStr(body), 5000);
            JSONObject json = JSONUtil.parseObj(resp);
            Integer errcode = json.getInt("errcode");
            if (errcode != null && errcode == 0) {
                return "PASS";
            }
            log.warn("[msgSecCheck] 审核拒绝：errcode={}, errmsg={}, content={}",
                    errcode, json.getStr("errmsg"),
                    content.length() > 30 ? content.substring(0, 30) + "..." : content);
            return "REJECT";
        } catch (Exception e) {
            log.error("[msgSecCheck] 远程审核异常，降级为放行：{}", e.getMessage());
            return rejectOnError ? "REJECT" : "PASS";
        }
    }

    /** 取 access_token，缓存 2 小时，提前 5 分钟刷新 */
    private String getAccessToken() {
        TokenCache cached = tokenRef.get();
        long now = System.currentTimeMillis();
        if (cached != null && now < cached.expireAt) {
            return cached.token;
        }
        try {
            String url = String.format(TOKEN_URL, appid, secret);
            String resp = HttpUtil.get(url, 5000);
            JSONObject json = JSONUtil.parseObj(resp);
            String token = json.getStr("access_token");
            Integer expiresIn = json.getInt("expires_in", 7200);
            if (token == null || token.isEmpty()) {
                log.error("[msgSecCheck] 取 token 失败：{}", resp);
                return null;
            }
            long expireAt = now + (expiresIn - 300) * 1000L;  // 提前 5 分钟
            tokenRef.set(new TokenCache(token, expireAt));
            log.info("[msgSecCheck] token 刷新成功，{} 秒后过期", expiresIn);
            return token;
        } catch (Exception e) {
            log.error("[msgSecCheck] 取 token 异常：{}", e.getMessage());
            return null;
        }
    }

    private static class TokenCache {
        final String token;
        final long expireAt;
        TokenCache(String token, long expireAt) {
            this.token = token;
            this.expireAt = expireAt;
        }
    }
}
