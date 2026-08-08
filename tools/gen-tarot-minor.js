// tools/gen-tarot-minor.js — 生成缺失的 52 张小牌 seed SQL
//
// 现状（实测）：MAJOR 22 张齐全，MINOR 只有 WANDS 的 1/2/3/14 四张。
// 缺口：WANDS 4-13（10 张）+ CUPS/SWORDS/PENTACLES 各 14 张（42 张）= 52 张
//
// 关于 meaning 字段：全 26 张现有牌的 upright_meaning 都是空的。
// 这是**设计选择而非缺陷** —— C 模块要做 LLM 深度解读，
// 长文本由 AI 按用户问题实时生成，比预写死的通用牌意更贴切。
// 关键词（upright_kw/reversed_kw）才是 LLM prompt 的输入，必须填准。
const fs = require('fs');
const NL = String.fromCharCode(10);

// 四花色的情绪基调（深夜情绪产品语境，不用传统占卜术语堆砌）
const SUITS = {
  WANDS: { cn: '权杖', en: 'Wands' },
  CUPS: { cn: '圣杯', en: 'Cups' },
  SWORDS: { cn: '宝剑', en: 'Swords' },
  PENTACLES: { cn: '星币', en: 'Pentacles' }
};

const NUM_CN = {
  1: '王牌', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七',
  8: '八', 9: '九', 10: '十', 11: '侍从', 12: '骑士', 13: '王后', 14: '国王'
};

const NUM_EN = {
  1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King'
};

// 关键词表：[正位, 逆位]
const KW = {
  WANDS: {
    4: ['庆祝, 安定, 归属', '不安, 缺乏归属感'],
    5: ['竞争, 摩擦, 内耗', '避免冲突, 妥协'],
    6: ['胜利, 被认可, 荣耀', '骄傲, 名不副实'],
    7: ['坚守, 防御, 压力', '力不从心, 想放弃'],
    8: ['迅速, 进展, 消息', '延迟, 混乱'],
    9: ['疲惫但坚持, 警惕', '固执, 硬撑'],
    10: ['重担, 责任过多', '放下负担, 卸载'],
    11: ['好奇, 跃跃欲试', '轻率, 三分钟热度'],
    12: ['行动, 冒险, 冲劲', '鲁莽, 半途而废'],
    13: ['热情, 魅力, 自信', '强势, 情绪化']
  },
  CUPS: {
    1: ['新感情, 心动, 满溢', '情感压抑, 空虚'],
    2: ['共鸣, 联结, 相互', '失衡, 单方付出'],
    3: ['友谊, 分享, 热闹', '孤立, 塑料情谊'],
    4: ['厌倦, 不满足, 回避', '重新接受, 醒悟'],
    5: ['失落, 遗憾, 沉溺过去', '接受, 走出来'],
    6: ['怀旧, 童年, 温柔回忆', '沉溺过去, 不肯长大'],
    7: ['幻想, 选择太多', '看清现实, 清醒'],
    8: ['离开, 转身, 寻找更好', '徘徊, 不敢走'],
    9: ['满足, 心愿达成', '虚假满足, 贪心'],
    10: ['圆满, 归属, 家', '关系裂痕, 表面和谐'],
    11: ['敏感, 直觉, 纯粹', '情绪化, 幼稚'],
    12: ['浪漫, 追随内心', '不切实际, 逃避'],
    13: ['共情, 温柔, 包容', '过度付出, 情绪淹没'],
    14: ['情绪成熟, 沉稳温和', '压抑, 情感操控']
  },
  SWORDS: {
    1: ['清晰, 真相, 突破', '混乱, 判断失误'],
    2: ['僵局, 难以决定', '被迫选择, 打破僵局'],
    3: ['心痛, 被伤害, 真话', '疗愈开始, 释怀'],
    4: ['休息, 暂停, 恢复', '强撑, 该停却不停'],
    5: ['冲突, 赢了却空虚', '和解, 放下胜负'],
    6: ['过渡, 离开困境', '停滞, 走不出来'],
    7: ['隐瞒, 走捷径', '坦白, 被揭穿'],
    8: ['自我设限, 感觉被困', '松绑, 发现出口'],
    9: ['焦虑, 深夜失眠, 反刍', '缓解, 说出恐惧'],
    10: ['触底, 结束, 最坏已过', '复原, 慢慢好转'],
    11: ['好奇, 直言, 观察', '刺人, 说话不留情'],
    12: ['果断, 直冲, 效率', '急躁, 伤人伤己'],
    13: ['独立, 清醒, 界限', '冷漠, 尖锐'],
    14: ['理性, 公正, 判断力', '严苛, 冷酷']
  },
  PENTACLES: {
    1: ['新机会, 实际收获', '错失, 短视'],
    2: ['平衡, 兼顾, 灵活', '失衡, 顾此失彼'],
    3: ['协作, 被认可的技能', '各行其是, 质量差'],
    4: ['守护, 安全感, 抓紧', '吝啬, 不敢放手'],
    5: ['匮乏, 孤立无援', '援助出现, 转机'],
    6: ['给予, 互助, 慷慨', '不对等, 施舍感'],
    7: ['耐心, 长期投入', '不耐烦, 想放弃'],
    8: ['专注, 打磨, 熟练', '重复枯燥, 敷衍'],
    9: ['自足, 独立享受成果', '依赖, 空虚的富足'],
    10: ['稳固, 传承, 长久', '家庭压力, 得失焦虑'],
    11: ['学习, 踏实起步', '不专心, 拖延'],
    12: ['稳步, 可靠, 坚持', '停滞, 固执保守'],
    13: ['务实, 滋养, 踏实', '过度操心, 物质焦虑'],
    14: ['富足, 稳健, 掌控', '控制欲, 唯利是图']
  }
};

// 现有的 4 张（不重复插入）
const EXIST = { WANDS: [1, 2, 3, 14] };

const rows = [];
Object.keys(SUITS).forEach(function (suit) {
  const s = SUITS[suit];
  for (let n = 1; n <= 14; n++) {
    const has = (EXIST[suit] || []).indexOf(n) >= 0;
    if (has) continue;
    const kw = (KW[suit] || {})[n];
    if (!kw) {
      console.log('警告: 缺关键词 ' + suit + ' ' + n);
      continue;
    }
    const nameCn = s.cn + NUM_CN[n];
    const nameEn = NUM_EN[n] + ' of ' + s.en;
    rows.push({ suit: suit, number: n, nameCn: nameCn, nameEn: nameEn, up: kw[0], rev: kw[1] });
  }
});

function esc(v) { return String(v).split(String.fromCharCode(39)).join(String.fromCharCode(39, 39)); }
const Q = String.fromCharCode(39);

const lines = [];
lines.push('-- V4__tarot_minor_52.sql');
lines.push('-- 补齐塔罗小牌至 78 张全套（现有 26 张：MAJOR 22 + WANDS 1/2/3/14）');
lines.push('-- 幂等：按 (arcana,suit,number) 判重，重复执行不会产生脏数据');
lines.push('');
rows.forEach(function (r) {
  lines.push('INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)');
  lines.push('SELECT ' + Q + 'MINOR' + Q + ',' + Q + r.suit + Q + ',' + r.number + ','
    + Q + esc(r.nameCn) + Q + ',' + Q + esc(r.nameEn) + Q + ','
    + Q + esc(r.up) + Q + ',' + Q + esc(r.rev) + Q);
  lines.push('FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card');
  lines.push('  WHERE arcana=' + Q + 'MINOR' + Q + ' AND suit=' + Q + r.suit + Q + ' AND number=' + r.number + ');');
  lines.push('');
});

const out = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/resources/db/V4__tarot_minor_52.sql';
fs.writeFileSync(out, lines.join(NL), 'utf8');

console.log('生成牌数: ' + rows.length + ' (期望 52)');
const bySuit = {};
rows.forEach(function (r) { bySuit[r.suit] = (bySuit[r.suit] || 0) + 1; });
Object.keys(bySuit).forEach(function (k) { console.log('  ' + k + ': ' + bySuit[k]); });
console.log('输出: ' + out);
console.log(rows.length === 52 ? 'OK' : 'FAIL: 数量不对');
