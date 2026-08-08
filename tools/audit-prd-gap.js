// 今夜树屋：PRD 规划 vs 实际实现 差距审计
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse';
const NL = String.fromCharCode(10);

function walk(dir, exts, out) {
  out = out || [];
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (it.name === 'target' || it.name === 'node_modules' || it.name === '.git' || it.name === 'tools') continue;
      walk(p, exts, out);
    } else if (exts.some(e => it.name.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(ROOT, ['.java', '.js', '.wxml', '.json'], []);
const corpus = {};
for (const f of files) {
  try { corpus[f] = fs.readFileSync(f, 'utf8'); } catch (e) { }
}
function hits(pattern) {
  let n = 0;
  const where = [];
  for (const f in corpus) {
    if (corpus[f].indexOf(pattern) >= 0) { n++; where.push(path.basename(f)); }
  }
  return { n: n, where: where.slice(0, 3) };
}

// PRD 承诺的付费点清单
const payPoints = [
  ['A 深夜信箱', 'AI 深度回信 4.9元', 'aiLetterReply'],
  ['A 深夜信箱', '定制人格 9.9元', 'aiPersona'],
  ['B 摆烂许可证', '高级模板 3元', 'template'],
  ['B 摆烂许可证', '专属证书 6.9元', 'certificate'],
  ['B 摆烂许可证', '实体明信片 9.9元', 'postcard'],
  ['C 塔罗盲盒', '三牌阵 9.9元', 'threeCards'],
  ['C 塔罗盲盒', '深度解读 19.9~68元', 'unlock'],
  ['C 塔罗盲盒', '情感专题 29.9~99元', 'topic'],
  ['C 塔罗盲盒', '年度报告 99元', 'annualReport'],
  ['D 许愿池', '木鱼皮肤 6元', 'skin'],
  ['D 许愿池', '结愿仪式 4.9元', 'ceremony'],
  ['E 漂流墙', '虚拟礼物 3档', 'gift'],
];

console.log('======== 一、PRD 付费点实现情况 ========');
console.log('');
let payDone = 0;
for (const [mod, name, key] of payPoints) {
  const h = hits(key);
  const ok = h.n > 0;
  if (ok) payDone++;
  console.log((ok ? '[有代码]' : '[缺失  ]') + ' ' + mod.padEnd(14) + ' ' + name);
}
console.log('');
console.log('付费点代码存在率: ' + payDone + '/' + payPoints.length);

// 但"有代码"不等于"能收钱" —— 查支付链路
console.log('');
console.log('======== 二、能否真正收到钱 ========');
console.log('');
const payChecks = [
  ['微信支付 JSAPI 下单', 'createOrder'],
  ['支付回调验签', 'OrderNotify'],
  ['wechatpay-java SDK', 'wechatpay'],
];
for (const [name, key] of payChecks) {
  const h = hits(key);
  console.log((h.n > 0 ? '[命中] ' : '[缺失] ') + name.padEnd(24) + ' 文件数=' + h.n);
}
const pom = fs.existsSync(ROOT + '/backend/pom.xml') ? fs.readFileSync(ROOT + '/backend/pom.xml', 'utf8') : '';
console.log('pom.xml 含 wechatpay 依赖: ' + (pom.indexOf('wechatpay') >= 0 ? '是' : '否 <- 无法真实收款'));
console.log('pom.xml 含 AI/LLM 依赖  : ' + (/openai|spring-ai|dashscope/i.test(pom) ? '是' : '否 <- 所有AI功能是假的'));

// 增长机制
console.log('');
console.log('======== 三、增长与留存机制 ========');
console.log('');
const growth = [
  ['分享卡片 onShareAppMessage', 'onShareAppMessage'],
  ['分享朋友圈 onShareTimeline', 'onShareTimeline'],
  ['勋章体系', 'medal'],
  ['每日签到', 'checkin'],
  ['连续打卡 streak', 'streak'],
  ['订阅消息推送', 'requestSubscribeMessage'],
  ['邀请裂变', 'invite'],
  ['排行榜', 'rank'],
];
for (const [name, key] of growth) {
  const h = hits(key);
  console.log((h.n > 0 ? '[有] ' : '[无] ') + name.padEnd(30) + (h.n > 0 ? h.where.join(',') : ''));
}

// 塔罗内容库
console.log('');
console.log('======== 四、内容库规模（决定可玩性） ========');
console.log('');
const seedPath = ROOT + '/backend/seed-tarot-card.sql';
if (fs.existsSync(seedPath)) {
  const s = new TextDecoder('utf-16le').decode(fs.readFileSync(seedPath));
  const m = s.match(/\((\d+),'(MAJOR|MINOR)'/g) || [];
  const major = m.filter(x => x.indexOf('MAJOR') >= 0).length;
  const minor = m.filter(x => x.indexOf('MINOR') >= 0).length;
  console.log('塔罗牌: ' + (major + minor) + '/78 张  (MAJOR ' + major + '/22, MINOR ' + minor + '/56)');
  const nullMeaning = (s.match(/,NULL,NULL,'2026/g) || []).length;
  console.log('  其中牌意正文为空: ' + nullMeaning + ' 张 -> 只有关键词，无解读文案');
}
const imgs = walk(ROOT + '/miniprogram', ['.png', '.jpg', '.jpeg', '.svg', '.webp'], []);
console.log('小程序图片资源: ' + imgs.length + ' 个 -> 78张牌面图需要 78 个，缺口巨大');

// TODO 统计
console.log('');
console.log('======== 五、代码里自己标注的未完成项 ========');
console.log('');
const todos = [];
for (const f in corpus) {
  if (!f.endsWith('.java')) continue;
  corpus[f].split(NL).forEach(l => {
    if (l.indexOf('TODO') >= 0) todos.push(l.trim().replace(/^[*\/\s]+/, '').slice(0, 88));
  });
}
[...new Set(todos)].forEach(t => console.log('  ' + t));
console.log('');
console.log('TODO 总数(去重): ' + new Set(todos).size);
