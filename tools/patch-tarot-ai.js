// 把 TarotService.buildFullInterpretation 改成 LLM 生成 + 模板回落
// 用 node 改而不是 edit 工具：这个文件有 GBK/UTF-8 编码混杂，
// edit 的精确匹配会因「匿名/匆名」类差异失败（今天已踩两次）
const fs = require('fs');
const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const P = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/java/com/treehouse/module/tarot/TarotService.java';

let s = fs.readFileSync(P, 'utf8');

if (s.indexOf('AI_TAROT_SYSTEM') >= 0) {
  console.log('已改过，跳过');
  process.exit(0);
}

// ---- 1) 在 ADVICE_POOL 前插入 AI prompt 常量 ----
const anchor = '    /** 建议库 */';
if (s.indexOf(anchor) < 0) {
  console.log('未找到建议库锚点，中止');
  process.exit(1);
}

const promptLines = [
  '    /**',
  '     * 塔罗深度解读的 system prompt。',
  '     *',
  '     * <p>定位：这是付费内容（19.9 元），质量必须明显高于免费短解读。',
  '     * 关键约束是不算命、不预言——我们卖的是情绪陪伴与自我觉察，',
  '     * 不是玄学预测，既避免合规风险，也更贴合深夜用户的真实需求。</p>',
  '     */',
  '    private static final String AI_TAROT_SYSTEM =',
  '            "你是「今夜树屋」的塔罗解读师，为深夜独处的年轻人做温柔的自我觉察引导。"',
  '                    + "要求：1) 不算命、不预言未来、不给确定性断言，只做情绪照见与自我觉察；"',
  '                    + "2) 语气像深夜里懂你的朋友，温柔具体，不空泛励志；"',
  '                    + "3) 必须结合给到的牌面关键词展开，不要泛泛而谈；"',
  '                    + "4) 分三段，每段一个自然段，段间空一行，总共 300-420 字；"',
  '                    + "5) 第一段照见当下状态，第二段指出容易被忽略的一面，第三段给一个今晚能做的小事；"',
  '                    + "6) 不要用 markdown、不要标题、不要列表、不要引号；"',
  '                    + "7) 禁止提及心理治疗、抗抑郁、诊断等医疗词汇。";',
  ''
];
const promptBlock = promptLines.join(NL);

s = s.split(anchor).join(promptBlock + anchor);

// ---- 2) 替换 buildFullInterpretation 方法体 ----
const startMark = '    private String buildFullInterpretation(TarotReading reading) {';
const si = s.indexOf(startMark);
if (si < 0) {
  console.log('未找到 buildFullInterpretation，中止');
  process.exit(1);
}
const endMark = NL + '    }' + NL;
const ei = s.indexOf(endMark, si);
if (ei < 0) {
  console.log('未找到方法结束位置，中止');
  process.exit(1);
}

// Java 源码里要出现的双转义换行，用 BS 拼出来避免本文件出现字面转义
const JAVA_NLNL = BS + 'n' + BS + 'n';

const methodLines = [
  '    /**',
  '     * 生成完整解读：优先 LLM，失败回落静态模板。',
  '     *',
  '     * <p>回落而非抛错的理由：用户已经付费解锁，宁可给模板文案也不能给报错页。',
  '     * 与 BailanService 同一模式。</p>',
  '     */',
  '    private String buildFullInterpretation(TarotReading reading) {',
  '        String kw = null;',
  '        String cardDesc = null;',
  '        try {',
  '            List cards = MAPPER.readValue(reading.getCardsJson(), List.class);',
  '            if (cards == null || cards.isEmpty()) {',
  '                return "完整解读生成失败（牌数据缺失）";',
  '            }',
  '            StringBuilder sb = new StringBuilder();',
  '            for (Object o : cards) {',
  '                Map<String, Object> c = (Map<String, Object>) o;',
  '                List<String> kws = (List<String>) c.get("keywords");',
  '                if (kw == null && kws != null && !kws.isEmpty()) {',
  '                    kw = kws.get(0);',
  '                }',
  '                if (sb.length() > 0) {',
  '                    sb.append("；");',
  '                }',
  '                sb.append(c.get("role")).append("：").append(c.get("name"))',
  '                        .append("（").append(c.get("positionName")).append("，关键词 ")',
  '                        .append(kws == null ? "" : String.join("、", kws)).append("）");',
  '            }',
  '            cardDesc = sb.toString();',
  '        } catch (Exception e) {',
  '            log.warn("解析牌面失败：{}", e.getMessage());',
  '            return "完整解读生成失败，请稍后再试。";',
  '        }',
  '',
  '        String ai = aiTarotInterpret(cardDesc);',
  '        if (ai != null && !ai.trim().isEmpty()) {',
  '            log.info("[Tarot] AI 解读生成成功 len={}", ai.length());',
  '            return ai;',
  '        }',
  '',
  '        log.warn("[Tarot] AI 解读不可用，回落静态模板");',
  '        String[] tpl = FULL_TEMPLATES.get(kw);',
  '        if (tpl == null) {',
  '            tpl = FULL_TEMPLATES.get("希望");',
  '        }',
  '        return String.join("' + JAVA_NLNL + '", tpl);',
  '    }',
  '',
  '    /** 调 LLM 生成塔罗深度解读；失败返回 null */',
  '    private String aiTarotInterpret(String cardDesc) {',
  '        String prompt = "用户抽到的牌：" + cardDesc',
  '                + "。请按要求给出三段式深度解读。现在是深夜，用户独自一人。";',
  '        return aiService.longText(AI_TAROT_SYSTEM, prompt, 900);',
  '    }'
];
const newMethod = methodLines.join(NL);

s = s.slice(0, si) + newMethod + s.slice(ei + endMark.length - 1);

fs.writeFileSync(P, s, 'utf8');
console.log('已改写 TarotService.buildFullInterpretation');
console.log('新增 AI_TAROT_SYSTEM 常量 + aiTarotInterpret 方法');
console.log('文件行数: ' + s.split(NL).length);
