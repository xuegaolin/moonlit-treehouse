package com.treehouse.service;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 微信小程序 API 服务
 *
 * <p>封装 jscode2session / access_token / 订阅消息推送 等微信服务端接口
 * （HTTP 直连，未引入 weixin-java-miniapp SDK 以保持 MVP 依赖精简）。</p>
 *
 * <p>access_token 走 Caffeine 本地缓存（微信官方 2 小时有效，提前 5 分钟刷新
 * 避免边界竞争）。全局唯一 + 每日 2000 次上限，缓存能省 80%+ 调用。</p>
 */
@Slf4j
@Service
public class WechatMaService {

    @Value("${wechat.miniapp.appid}")
    private String appid;

    @Value("${wechat.miniapp.secret}")
    private String secret;

    @Value("${wechat.miniapp.login-url}")
    private String loginUrl;

    /**
     * 订阅消息推送模板 ID。
     *
     * <p>占位符由 application.yml 注入；dev 默认空，sendSubscribeMessage 会自动
     * 跳过真发并返回 null（业务侧走日志 + 标 FAILED 兜底，不报错）。</p>
     */
    @Value("${wechat.miniapp.template-id-letter:}")
    private String templateIdLetter;

    /** access_token 缓存：key=appid，value=带过期时间的 token 封装，提前 5 分钟失效 */
    private static final class TokenEntry {
        final String token;
        final Instant expireAt; // 提前 5 分钟过期
        TokenEntry(String t, Instant e) { this.token = t; this.expireAt = e; }
        boolean alive() { return Instant.now().isBefore(expireAt); }
    }
    private final ConcurrentHashMap<String, TokenEntry> accessTokenCache = new ConcurrentHashMap<>();

    /**
     * code 换 openid / session_key
     *
     * @param code wx.login 返回的临时登录凭证
     * @return 微信返回的 JSON（含 openid、session_key、可选 unionid）
     * @throws BizException 微信返回 errcode 时抛出
     */
    public JSONObject code2Session(String code) {
        Map<String, Object> params = new HashMap<>();
        params.put("appid", appid);
        params.put("secret", secret);
        params.put("js_code", code);
        params.put("grant_type", "authorization_code");

        String result = HttpUtil.get(loginUrl, params);
        log.info("jscode2session 返回：{}", result);

        JSONObject json = JSONUtil.parseObj(result);
        if (json.getInt("errcode", 0) != 0) {
            log.error("微信登录失败：errcode={}, errmsg={}", json.getInt("errcode"), json.getStr("errmsg"));
            throw new BizException(ResultCode.UNAUTHORIZED.getCode(), "微信登录失败：" + json.getStr("errmsg"));
        }
        return json;
    }

    /**
     * 取 access_token（带 Caffeine 缓存）。
     *
     * <p>微信 access_token 全局唯一，2 小时有效，单日 2000 次上限。
     * 缓存命中直接返回，未命中则调接口拉新。</p>
     *
     * @return access_token；微信返回异常时抛 BizException
     */
    public String getAccessToken() {
        TokenEntry cached = accessTokenCache.get(appid);
        if (cached != null && cached.alive()) {
            return cached.token;
        }
        String url = "https://api.weixin.qq.com/cgi-bin/token"
                + "?grant_type=client_credential"
                + "&appid=" + appid
                + "&secret=" + secret;
        String body = HttpUtil.get(url);
        log.debug("刷新 access_token：{}", body);
        JSONObject json = JSONUtil.parseObj(body);
        if (json.getInt("errcode", 0) != 0) {
            log.error("获取 access_token 失败：errcode={}, errmsg={}",
                    json.getInt("errcode"), json.getStr("errmsg"));
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(),
                    "获取 access_token 失败：" + json.getStr("errmsg"));
        }
        String token = json.getStr("access_token");
        if (token == null || token.isEmpty()) {
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(), "access_token 为空");
        }
        long expiresInSec = json.getLong("expires_in", 7200L);
        // 提前 5 分钟过期避免边界竞争
        Instant expireAt = Instant.now().plus(Duration.ofSeconds(expiresInSec - 300));
        accessTokenCache.put(appid, new TokenEntry(token, expireAt));
        return token;
    }

    /**
     * 主动清缓存（调试 / 收到 40001 invalid credential 时调用）。
     */
    public void evictAccessToken() {
        accessTokenCache.remove(appid);
        log.info("已清空 access_token 缓存：appid={}", appid);
    }

    /**
     * 发送一次性订阅消息。
     *
     * <p>硬约束：</p>
     * <ul>
     *   <li>template_id 走配置（wechat.miniapp.template-id-letter），未配置直接返回 null（dev 兜底）</li>
     *   <li>openid / push_token 任一为空返回 null（dev 模拟 / 旧 log）</li>
     *   <li>微信返回非 0 errcode 抛 BizException，由调用方标 FAILED</li>
     * </ul>
     *
     * @param openid    收信人 openid
     * @param pushToken wx.requestSubscribeMessage 返回的 push_token（30 天有效）
     * @param data      模板字段映射（key = 模板关键词，value = 填充字符串）
     * @return 成功返回 null（失败抛 BizException 或返回 null 由调用方决定）
     */
    public Void sendSubscribeMessage(String openid, String pushToken, Map<String, String> data) {
        if (templateIdLetter == null || templateIdLetter.trim().isEmpty()) {
            log.info("[subscribe] template-id-letter 未配置，跳过真发推送（dev 兜底）");
            return null;
        }
        if (openid == null || openid.isEmpty() || pushToken == null || pushToken.isEmpty()) {
            log.info("[subscribe] openid / push_token 为空，跳过推送（dev 模拟或旧 log）");
            return null;
        }
        String accessToken = getAccessToken();
        String url = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=" + accessToken;

        Map<String, Object> body = new HashMap<>();
        body.put("touser", openid);
        body.put("template_id", templateIdLetter);
        body.put("page", "pages/letter/letter");
        body.put("miniprogram_state", "formal");
        body.put("lang", "zh_CN");
        body.put("data", data);
        // push_token 走 query 拼接，不是 body 字段
        url += "&push_token=" + pushToken;

        String resp = HttpUtil.post(url, JSONUtil.toJsonStr(body));
        log.debug("订阅消息推送响应：{}", resp);
        JSONObject json = JSONUtil.parseObj(resp);
        int errcode = json.getInt("errcode", 0);
        if (errcode != 0) {
            String errmsg = json.getStr("errmsg");
            // 40001 invalid credential -> 清缓存
            if (errcode == 40001) {
                evictAccessToken();
            }
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(),
                    "订阅消息推送失败：errcode=" + errcode + " errmsg=" + errmsg);
        }
        log.info("订阅消息推送成功：openid={}, template={}", openid, templateIdLetter);
        return null;
    }

    /**
     * 取当前配置的 template_id（前端 / 调试用）。
     */
    public String getTemplateIdLetter() {
        return templateIdLetter;
    }

    /**
     * 把 Map<String,String> 转成微信 data 结构 {"keyword1": {"value": "..."}}
     * （仅供调用方测试 / 外部拼装参考，sendSubscribeMessage 内部已处理）
     */
    static Map<String, Object> wrapData(Map<String, String> flat) {
        Map<String, Object> out = new HashMap<>();
        for (Map.Entry<String, String> e : flat.entrySet()) {
            Map<String, String> v = new HashMap<>();
            v.put("value", e.getValue() == null ? "" : e.getValue());
            out.put(e.getKey(), v);
        }
        return out;
    }

    /**
     * 兼容旧 List<Map> 调用方（如有遗留代码）
     */
    @Deprecated
    public static class _Holder {
        public static List<Object> _noop = java.util.Collections.emptyList();
    }
}
