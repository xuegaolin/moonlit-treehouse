package com.treehouse.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 敏感词扫描服务（v1.5 聊天合规核心组件）
 *
 * <p>设计原则：</p>
 * <ul>
 *   <li>配置化：词库从 classpath:sensitive-words.txt 加载，运维改文件即生效</li>
 *   <li>线程安全：{@link AtomicReference} 持有当前词库实例，热更新无锁</li>
 *   <li>降级：词库加载失败 = 放行所有内容（避免业务中断，配合 msgSecCheck 二道）</li>
 *   <li>性能：纯字符串扫描，500 词库单次扫描 < 1ms（够用，量大了换 AC 自动机）</li>
 * </ul>
 *
 * <p>运维 SOP：</p>
 * <ol>
 *   <li>修改 {@code src/main/resources/sensitive-words.txt}（每行一词，# 开头注释）</li>
 *   <li>提交后端</li>
 *   <li>调用 {@link #reload()} 触发热更新（或重启）</li>
 * </ol>
 *
 * <p>v1.5 词库只覆盖：色情/广告/政治/黑产引流（占位）。正式上线前必须由内容安全运营审核扩充。</p>
 */
@Slf4j
@Service
public class SensitiveWordService {

    private final ResourceLoader resourceLoader;
    /** 词库文件路径（application.yml 配置） */
    @Value("${treehouse.chat.sensitive-words-file:classpath:sensitive-words.txt}")
    private String wordsFile;

    /** 当前生效的扫描正则（热更新通过 CAS 替换） */
    private final AtomicReference<Pattern> currentPattern = new AtomicReference<>(Pattern.compile("(?!^)"));

    public SensitiveWordService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    /** 启动时加载 */
    @PostConstruct
    public void init() {
        reload();
    }

    /**
     * 热重载词库。生产可暴露管理端点调用（v1.6 接入管理后台）。
     */
    public synchronized void reload() {
        try {
            List<String> words = loadWords();
            if (words.isEmpty()) {
                log.warn("[sensitive-word] 词库为空，降级为放行（不推荐生产）");
                currentPattern.set(Pattern.compile("(?!^)"));
                return;
            }
            // 转义 + 拼接：(?i)(word1|word2|word3)  case-insensitive
            String joined = words.stream()
                    .map(Pattern::quote)
                    .collect(Collectors.joining("|"));
            Pattern p = Pattern.compile("(?i)(" + joined + ")");
            currentPattern.set(p);
            log.info("[sensitive-word] 词库加载完成：{} 词", words.size());
        } catch (Exception e) {
            log.error("[sensitive-word] 词库加载失败，降级为放行：{}", e.getMessage());
            currentPattern.set(Pattern.compile("(?!^)"));
        }
    }

    private List<String> loadWords() throws Exception {
        Resource res = resourceLoader.getResource(wordsFile);
        if (!res.exists()) {
            log.warn("[sensitive-word] 词库文件不存在：{}", wordsFile);
            return new ArrayList<>();
        }
        List<String> out = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                out.add(line);
            }
        }
        return out;
    }

    /**
     * 扫描文本是否含敏感词
     * @return 第一个命中的敏感词（null=通过）
     */
    public String findFirst(String text) {
        if (text == null || text.isEmpty()) return null;
        java.util.regex.Matcher m = currentPattern.get().matcher(text);
        return m.find() ? m.group(1) : null;
    }

    /**
     * 扫描是否含敏感词（快路径）
     */
    public boolean contains(String text) {
        return findFirst(text) != null;
    }

    /**
     * 命中所有敏感词（用于前端高亮提示）
     */
    public List<String> findAll(String text) {
        if (text == null || text.isEmpty()) return new ArrayList<>();
        List<String> hits = new ArrayList<>();
        java.util.regex.Matcher m = currentPattern.get().matcher(text);
        while (m.find()) {
            hits.add(m.group(1));
        }
        return hits;
    }
}
