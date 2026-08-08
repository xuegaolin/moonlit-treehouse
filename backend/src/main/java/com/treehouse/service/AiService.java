package com.treehouse.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * LLM 统一接入层（OpenAI 兼容 /chat/completions 协议）。
 *
 * <p>设计要点：
 * <ul>
 *   <li><b>永不抛异常给业务层</b>：所有失败都返回 null，由调用方走静态模板兜底。
 *       AI 是增强而非依赖，LLM 挂了产品必须还能用。</li>
 *   <li><b>可整体开关</b>：treehouse.ai.enabled=false 时直接返回 null，不发请求。</li>
 *   <li><b>超时严格</b>：默认连接 5s / 读取 20s，避免拖垮小程序请求。</li>
 *   <li><b>内容长度硬截断</b>：防止 LLM 超长输出撑爆前端排版和 DB 字段。</li>
 * </ul>
 *
 * <p>已验证可用的 provider：volcengine-plan（ark），doubao-seed-2.0-pro / deepseek-v4-flash。
 * 注意 bailian(coding.dashscope) 是 Coding-Agent 专用端点，业务调用返回 HTTP 405。
 */
@Slf4j
@Service
public class AiService {

    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${treehouse.ai.enabled:true}")
    private boolean enabled;

    @Value("${treehouse.ai.base-url:https://ark.cn-beijing.volces.com/api/coding/v3}")
    private String baseUrl;

    @Value("${treehouse.ai.api-key:}")
    private String apiKey;

    /** 常规文案模型（速度优先） */
    @Value("${treehouse.ai.model:doubao-seed-2.0-pro}")
    private String model;

    /** 长文模型（AI 回信、塔罗深度解读等付费内容，质量优先） */
    @Value("${treehouse.ai.model-long:deepseek-v4-pro}")
    private String modelLong;

    @Value("${treehouse.ai.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${treehouse.ai.read-timeout-ms:20000}")
    private int readTimeoutMs;

    /**
     * 专用 truststore 路径（classpath 相对或文件系统绝对路径）。
     *
     * <p>为何需要：本机 JDK 8 的 cacerts 被替换成了自定义密钥库（仅 15 个私有证书，
     * 正常 JDK 8 应有 ~90 个公共 CA），导致所有 HTTPS 调用报 PKIX path building failed。
     * 不去改共用的 JDK cacerts（会影响其他项目），而是给 AI 调用单独挂一个 truststore。</p>
     *
     * <p>置空则使用 JVM 默认信任链（生产环境 cacerts 正常时建议置空）。</p>
     */
    @Value("${treehouse.ai.truststore:}")
    private String truststorePath;

    @Value("${treehouse.ai.truststore-password:treehouse}")
    private String truststorePassword;

    /** 按 truststore 构建的 SSL 工厂；为 null 则用 JVM 默认 */
    private SSLSocketFactory sslSocketFactory;

    @PostConstruct
    public void initSsl() {
        if (truststorePath == null || truststorePath.trim().isEmpty()) {
            log.info("[AiService] 使用 JVM 默认信任链（未配置专用 truststore）");
            return;
        }
        InputStream in = null;
        try {
            String p = truststorePath.trim();
            if (p.startsWith("classpath:")) {
                String res = p.substring("classpath:".length());
                in = getClass().getClassLoader().getResourceAsStream(res);
                if (in == null) {
                    log.warn("[AiService] classpath 中未找到 truststore: {}，回退 JVM 默认", res);
                    return;
                }
            } else {
                java.io.File f = new java.io.File(p);
                if (!f.exists()) {
                    log.warn("[AiService] truststore 文件不存在: {}，回退 JVM 默认", p);
                    return;
                }
                in = new java.io.FileInputStream(f);
            }
            KeyStore ks = KeyStore.getInstance("JKS");
            ks.load(in, truststorePassword.toCharArray());
            TrustManagerFactory tmf =
                    TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(ks);
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, tmf.getTrustManagers(), null);
            this.sslSocketFactory = ctx.getSocketFactory();
            log.info("[AiService] 已加载专用 truststore，证书数={}", ks.size());
        } catch (Exception e) {
            log.warn("[AiService] 加载 truststore 失败，回退 JVM 默认: {}", e.getMessage());
        } finally {
            if (in != null) {
                try { in.close(); } catch (Exception ignore) { }
            }
        }
    }

    /**
     * 是否处于可用状态（配置了 key 且未关闭）。业务层可用它决定是否展示"AI 生成中"文案。
     */
    public boolean isAvailable() {
        return enabled && apiKey != null && !apiKey.trim().isEmpty();
    }

    /**
     * 短文案生成（摆烂理由、塔罗关键词短解等）。
     *
     * @return 生成文本；失败返回 null（调用方须走模板兜底）
     */
    public String shortText(String systemPrompt, String userPrompt, int maxChars) {
        return complete(model, systemPrompt, userPrompt, 400, 0.95, maxChars);
    }

    /**
     * 长文案生成（AI 回信、深度解读等付费内容）。
     *
     * @return 生成文本；失败返回 null
     */
    public String longText(String systemPrompt, String userPrompt, int maxChars) {
        return complete(modelLong, systemPrompt, userPrompt, 1600, 0.85, maxChars);
    }

    /**
     * 核心调用。任何异常都吞掉并返回 null —— 保证业务永不因 AI 故障而失败。
     */
    private String complete(String useModel, String systemPrompt, String userPrompt,
                            int maxTokens, double temperature, int maxChars) {
        if (!isAvailable()) {
            return null;
        }
        HttpURLConnection conn = null;
        try {
            List<Map<String, String>> messages = new ArrayList<>();
            if (systemPrompt != null && !systemPrompt.isEmpty()) {
                Map<String, String> sys = new HashMap<>();
                sys.put("role", "system");
                sys.put("content", systemPrompt);
                messages.add(sys);
            }
            Map<String, String> user = new HashMap<>();
            user.put("role", "user");
            user.put("content", userPrompt);
            messages.add(user);

            Map<String, Object> payload = new HashMap<>();
            payload.put("model", useModel);
            payload.put("messages", messages);
            payload.put("max_tokens", maxTokens);
            payload.put("temperature", temperature);

            byte[] body = mapper.writeValueAsBytes(payload);

            String url = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";
            conn = (HttpURLConnection) new URL(url).openConnection();
            if (sslSocketFactory != null && conn instanceof HttpsURLConnection) {
                ((HttpsURLConnection) conn).setSSLSocketFactory(sslSocketFactory);
            }
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(connectTimeoutMs);
            conn.setReadTimeout(readTimeoutMs);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }

            int code = conn.getResponseCode();
            if (code != 200) {
                String err = readAll(conn, true);
                log.warn("[AiService] HTTP {} model={} err={}", code, useModel,
                        err == null ? "-" : err.substring(0, Math.min(200, err.length())));
                return null;
            }

            String resp = readAll(conn, false);
            JsonNode root = mapper.readTree(resp);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.size() == 0) {
                log.warn("[AiService] empty choices model={}", useModel);
                return null;
            }
            String text = choices.get(0).path("message").path("content").asText(null);
            if (text == null || text.trim().isEmpty()) {
                log.warn("[AiService] blank content model={}", useModel);
                return null;
            }
            text = text.trim();
            // 去掉模型偶发的包裹引号/markdown 围栏
            text = stripWrappers(text);
            if (maxChars > 0 && text.length() > maxChars) {
                text = text.substring(0, maxChars);
            }
            return text;
        } catch (Exception e) {
            log.warn("[AiService] call failed model={} : {}", useModel, e.getMessage());
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private String readAll(HttpURLConnection conn, boolean errorStream) {
        try (java.io.InputStream in = errorStream ? conn.getErrorStream() : conn.getInputStream()) {
            if (in == null) {
                return null;
            }
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return new String(bos.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** 剥掉 markdown 代码围栏和首尾成对引号 */
    private String stripWrappers(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) {
                t = t.substring(nl + 1);
            }
            if (t.endsWith("```")) {
                t = t.substring(0, t.length() - 3);
            }
            t = t.trim();
        }
        if (t.length() > 1) {
            char a = t.charAt(0);
            char b = t.charAt(t.length() - 1);
            boolean quoted = (a == '"' && b == '"') || (a == '\u201c' && b == '\u201d')
                    || (a == '\u300c' && b == '\u300d');
            if (quoted) {
                t = t.substring(1, t.length() - 1).trim();
            }
        }
        return t;
    }
}
