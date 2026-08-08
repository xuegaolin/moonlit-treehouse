// 补充「围观用户」，让 warm_count 数字自然分布（12/34/7/51/88...）
// 关键约束：warm() 返回 countByBottleId(t_bottle_warm)，
//   所以 t_bottle.warm_count 必须等于明细条数，否则用户一点数字就跳水。
//   要 88 个赞就得有 88 条明细 → 造 90 个 filler 用户。
const { execFileSync } = require('child_process');
process.env.MYSQL_PWD = 'root';

function sql(stmt) {
  return execFileSync('mysql',
    ['-uroot', '-D', 'treehouse', '--default-character-set=utf8mb4', '-e', stmt],
    { encoding: 'utf8' });
}

// 目标热度（和 seed-bottles.js 里的设计值一致）
const TARGET = {
  'B-SEED-0001': 12,
  'B-SEED-0002': 34,
  'B-SEED-0003': 7,
  'B-SEED-0004': 51,
  'B-SEED-0005': 88,
  'B-SEED-0006': 19,
  'B-SEED-0007': 46,
  'B-SEED-0008': 23,
  'B-SEED-0009': 62,
  'B-SEED-0010': 15
};

const MAX = Math.max.apply(null, Object.keys(TARGET).map(function (k) { return TARGET[k]; }));
console.log('需要 filler 用户数: ' + MAX);

// ===== 1. 批量造 filler 用户 =====
// 用 UNION ALL 一次插入，避免几十条独立 INSERT
const BATCH = 30;
let created = 0;
for (let start = 1; start <= MAX; start += BATCH) {
  const end = Math.min(start + BATCH - 1, MAX);
  const rows = [];
  for (let i = start; i <= end; i++) {
    const oid = 'test_filler_' + String(i).padStart(3, '0');
    rows.push(
      "INSERT INTO t_user (openid, nickname, status, create_time, update_time, deleted) " +
      "SELECT '" + oid + "', 'passerby" + i + "', 1, NOW(), NOW(), 0 " +
      "WHERE NOT EXISTS (SELECT 1 FROM t_user WHERE openid = '" + oid + "');"
    );
  }
  sql(rows.join(' '));
  created += (end - start + 1);
}
console.log('1. filler 用户就绪 (' + created + ')');

// ===== 2. 按目标数补 warm 明细 =====
console.log('2. 补温暖明细...');
const bottleNos = Object.keys(TARGET);
for (const no of bottleNos) {
  const n = TARGET[no];
  const stmts = [];
  for (let i = 1; i <= n; i++) {
    const oid = 'test_filler_' + String(i).padStart(3, '0');
    stmts.push(
      "INSERT INTO t_bottle_warm (bottle_id, user_id, gift_type, coin_cost, create_time) " +
      "SELECT b.id, u.id, " +
      "CASE WHEN " + i + " % 7 = 0 THEN 'candy' WHEN " + i + " % 11 = 0 THEN 'candle' ELSE 'hug' END, " +
      "CASE WHEN " + i + " % 7 = 0 THEN 6 WHEN " + i + " % 11 = 0 THEN 8 ELSE 0 END, " +
      "DATE_SUB(NOW(), INTERVAL " + (i * 3) + " MINUTE) " +
      "FROM t_bottle b, t_user u " +
      "WHERE b.bottle_no = '" + no + "' AND u.openid = '" + oid + "' " +
      "AND NOT EXISTS (SELECT 1 FROM t_bottle_warm w WHERE w.bottle_id = b.id AND w.user_id = u.id);"
    );
  }
  // 分批执行
  const CH = 20;
  for (let i = 0; i < stmts.length; i += CH) {
    sql(stmts.slice(i, i + CH).join(' '));
  }
  process.stdout.write('   ' + no + ' -> ' + n + '\n');
}

// ===== 3. 校准 warm_count = 明细条数（保证一致，点赞不跳水）=====
sql(
  "UPDATE t_bottle b SET b.warm_count = " +
  "(SELECT COUNT(*) FROM t_bottle_warm w WHERE w.bottle_id = b.id);"
);
console.log('3. warm_count 已校准为明细条数');

// ===== 4. 结果 =====
console.log('');
const out = sql(
  "SELECT b.bottle_no, b.warm_count, " +
  "(SELECT COUNT(*) FROM t_bottle_warm w WHERE w.bottle_id = b.id) AS rows_cnt, " +
  "CASE WHEN b.warm_count = (SELECT COUNT(*) FROM t_bottle_warm w WHERE w.bottle_id = b.id) " +
  "THEN 'OK' ELSE 'MISMATCH' END AS consistent " +
  "FROM t_bottle b ORDER BY b.warm_count DESC;"
);
console.log(out);

const total = sql("SELECT COUNT(*) AS users FROM t_user; SELECT COUNT(*) AS bottles FROM t_bottle; SELECT COUNT(*) AS warms FROM t_bottle_warm;");
console.log(total);
