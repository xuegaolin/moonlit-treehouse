// 造多条不同用户的漂流瓶测试数据，让漂流墙看起来像真有人在用
// 幂等：重复执行不会插重复数据
const { execFileSync } = require('child_process');

process.env.MYSQL_PWD = 'root';

function sql(stmt) {
  return execFileSync('mysql',
    ['-uroot', '-D', 'treehouse', '--default-character-set=utf8mb4', '-e', stmt],
    { encoding: 'utf8' });
}

// ---- 测试用户（openid 统一 test_seed_ 前缀，便于将来清理）----
const USERS = [
  { openid: 'test_seed_u01', nick: '深夜写代码的人' },
  { openid: 'test_seed_u02', nick: '楼下便利店' },
  { openid: 'test_seed_u03', nick: '想养猫' },
  { openid: 'test_seed_u04', nick: '考研倒计时' },
  { openid: 'test_seed_u05', nick: '刚失恋' },
  { openid: 'test_seed_u06', nick: '打工人甲' }
];

// ---- 瓶子（内容贴合"今夜树屋"emo/治愈调性）----
// minsAgo 控制 create_time，让 timeHint 分布自然
const BOTTLES = [
  { no: 'B-SEED-0001', u: 0, anon: '路人-7K2M', tags: ['emo深夜', '工作'],   warm: 12, mins: 8,
    c: '凌晨两点还在改需求，改到第七版的时候我突然不知道自己在干什么了。' },
  { no: 'B-SEED-0002', u: 1, anon: '路人-3XQ9', tags: ['治愈', '生活'],     warm: 34, mins: 26,
    c: '今天下班路上看到一只橘猫躺在花坛上晒月亮，我蹲下来看了它五分钟，它也看我。那一刻好像什么都不着急了。' },
  { no: 'B-SEED-0003', u: 2, anon: '路人-8FD4', tags: ['孤独'],             warm: 7,  mins: 55,
    c: '搬来这个城市三年，手机里存了两百个号码，生病的时候一个都不好意思打。' },
  { no: 'B-SEED-0004', u: 3, anon: '路人-1PL6', tags: ['焦虑', '学习'],     warm: 51, mins: 92,
    c: '距离考试还有 43 天，我今天一整天只看了 12 页书，剩下的时间都在焦虑自己看得太慢。' },
  { no: 'B-SEED-0005', u: 4, anon: '路人-9WZ1', tags: ['失恋', 'emo'],      warm: 88, mins: 150,
    c: '把和 TA 的聊天记录导出来了，一共 4.7 万条。删的时候手在抖，最后还是按了确认。' },
  { no: 'B-SEED-0006', u: 5, anon: '路人-5NB8', tags: ['工作', '焦虑'],     warm: 19, mins: 240,
    c: '开了三个小时会，什么结论都没有。散会的时候领导说"辛苦大家"，我笑了一下，笑得很假。' },
  { no: 'B-SEED-0007', u: 0, anon: '路人-2HJ7', tags: ['治愈'],             warm: 46, mins: 400,
    c: '今天有个陌生人在便利店帮我付了 3 块钱，因为我手机没电了。我会记很久。' },
  { no: 'B-SEED-0008', u: 2, anon: '路人-6RT3', tags: ['想要倾诉', '孤独'], warm: 23, mins: 700,
    c: '有时候我觉得我不是需要有人陪，我只是需要有人知道我今天过得不太好。' },
  { no: 'B-SEED-0009', u: 4, anon: '路人-4VC5', tags: ['生活', '治愈'],     warm: 62, mins: 1500,
    c: '学会做番茄炒蛋了。第一次做糊了，第二次咸了，第三次我妈说"还行"。她很少说还行。' },
  { no: 'B-SEED-0010', u: 3, anon: '路人-0MK9', tags: ['emo深夜'],          warm: 15, mins: 2600,
    c: '睡不着的时候我会数今天说过的谎，今天数到第九个的时候天亮了。' }
];

function esc(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ===== 1. 插用户 =====
let uStmts = [];
USERS.forEach(function (u) {
  uStmts.push(
    "INSERT INTO t_user (openid, nickname, status, create_time, update_time, deleted) " +
    "SELECT '" + esc(u.openid) + "', '" + esc(u.nick) + "', 1, NOW(), NOW(), 0 " +
    "WHERE NOT EXISTS (SELECT 1 FROM t_user WHERE openid = '" + esc(u.openid) + "');"
  );
});
sql(uStmts.join(' '));
console.log('1. 测试用户已插入 (' + USERS.length + ' 个)');

// ===== 2. 插瓶子 =====
let bStmts = [];
BOTTLES.forEach(function (b) {
  const openid = USERS[b.u].openid;
  const tagsJson = JSON.stringify(b.tags);
  bStmts.push(
    "INSERT INTO t_bottle (bottle_no, user_id, content, tags_json, anonymous_id, warm_count, audit_status, create_time, update_time, deleted) " +
    "SELECT '" + b.no + "', (SELECT id FROM t_user WHERE openid = '" + esc(openid) + "'), " +
    "'" + esc(b.c) + "', '" + esc(tagsJson) + "', '" + esc(b.anon) + "', " +
    b.warm + ", 'PASSED', DATE_SUB(NOW(), INTERVAL " + b.mins + " MINUTE), NOW(), 0 " +
    "WHERE NOT EXISTS (SELECT 1 FROM t_bottle WHERE bottle_no = '" + b.no + "');"
  );
});
sql(bStmts.join(' '));
console.log('2. 测试瓶子已插入 (' + BOTTLES.length + ' 条)');

// ===== 3. 造 warm 记录，让 warm_count 和 t_bottle_warm 对得上 =====
// warm() 返回的 warmedTotal = countByBottleId(t_bottle_warm)，
// 若只改 t_bottle.warm_count 而没有明细，前端温暖后数字会从 88 掉到 1
console.log('3. 补 t_bottle_warm 明细（让 warm_count 与明细一致）...');
let wStmts = [];
BOTTLES.forEach(function (b) {
  // 用 6 个测试用户循环填充明细，不足部分用同一批用户重复不了（UK 限制），
  // 所以明细数取 min(warm, USERS.length)，同时把 warm_count 校准成明细数
  const n = Math.min(b.warm, USERS.length);
  for (let i = 0; i < n; i++) {
    const openid = USERS[i].openid;
    wStmts.push(
      "INSERT INTO t_bottle_warm (bottle_id, user_id, gift_type, coin_cost, create_time) " +
      "SELECT b.id, u.id, 'hug', 0, NOW() FROM t_bottle b, t_user u " +
      "WHERE b.bottle_no = '" + b.no + "' AND u.openid = '" + esc(openid) + "' " +
      "AND NOT EXISTS (SELECT 1 FROM t_bottle_warm w WHERE w.bottle_id = b.id AND w.user_id = u.id);"
    );
  }
  // 校准 warm_count = 明细条数
  wStmts.push(
    "UPDATE t_bottle b SET b.warm_count = " +
    "(SELECT COUNT(*) FROM t_bottle_warm w WHERE w.bottle_id = b.id) " +
    "WHERE b.bottle_no = '" + b.no + "';"
  );
});
// 分批执行避免命令行过长
const CHUNK = 12;
for (let i = 0; i < wStmts.length; i += CHUNK) {
  sql(wStmts.slice(i, i + CHUNK).join(' '));
}
console.log('   完成');

// ===== 4. 结果 =====
console.log('');
console.log('=== 当前漂流墙 ===');
const out = sql(
  "SELECT b.bottle_no, u.nickname AS author, b.warm_count, " +
  "(SELECT COUNT(*) FROM t_bottle_warm w WHERE w.bottle_id = b.id) AS warm_rows, " +
  "b.audit_status, LEFT(b.content, 22) AS preview " +
  "FROM t_bottle b JOIN t_user u ON u.id = b.user_id ORDER BY b.create_time DESC;"
);
console.log(out);
