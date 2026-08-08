// 应用 V4 塔罗小牌 seed 并复核（幂等，可重复跑）
const { execSync } = require('child_process');
const fs = require('fs');
const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);

const SQL = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/resources/db/V4__tarot_minor_52.sql';

function q(sql) {
  const cmd = 'mysql -uroot -proot treehouse -N -B -e ' + DQ + sql + DQ;
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return 'ERR: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300);
  }
}

console.log('=== 执行前 ===');
const before = q('SELECT COUNT(*) FROM t_tarot_card').trim();
console.log('总牌数: ' + before);

console.log('');
console.log('=== 执行 V4 seed ===');
try {
  const out = execSync('mysql -uroot -proot treehouse < ' + DQ + SQL + DQ,
    { encoding: 'utf8', shell: 'cmd.exe', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('输出: ' + (out.trim() || '(无输出，即成功)'));
} catch (e) {
  console.log('执行失败: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 400));
  process.exit(1);
}

console.log('');
console.log('=== 执行后复核 ===');
console.log('总牌数        : ' + q('SELECT COUNT(*) FROM t_tarot_card').trim() + '  (期望 78)');
console.log(q("SELECT arcana,COUNT(*) FROM t_tarot_card GROUP BY arcana"));
console.log('小牌花色分布:');
console.log(q("SELECT suit,COUNT(*) FROM t_tarot_card WHERE arcana='MINOR' GROUP BY suit"));

console.log('=== 完整性校验 ===');
const dup = q("SELECT COUNT(*) FROM (SELECT arcana,suit,number,COUNT(*) c FROM t_tarot_card GROUP BY arcana,suit,number HAVING c>1) t").trim();
console.log('重复牌组合数  : ' + dup + '  (期望 0)');
const emptyKw = q("SELECT COUNT(*) FROM t_tarot_card WHERE upright_kw IS NULL OR upright_kw=''").trim();
console.log('缺正位关键词  : ' + emptyKw + '  (期望 0)');
const emptyRev = q("SELECT COUNT(*) FROM t_tarot_card WHERE reversed_kw IS NULL OR reversed_kw=''").trim();
console.log('缺逆位关键词  : ' + emptyRev + '  (期望 0)');

// 每花色应恰好 14 张，number 1..14 无缺号
const gaps = q("SELECT suit,COUNT(DISTINCT number) FROM t_tarot_card WHERE arcana='MINOR' GROUP BY suit HAVING COUNT(DISTINCT number)<>14").trim();
console.log('花色缺号情况  : ' + (gaps || '无缺号（每花色 14 张齐全）'));

const total = q('SELECT COUNT(*) FROM t_tarot_card').trim();
console.log('');
const pass = total === '78' && dup === '0' && emptyKw === '0' && emptyRev === '0' && !gaps;
console.log(pass ? 'PASS: 78 张全套齐全，无重复无缺号' : 'FAIL: 见上方');
process.exit(pass ? 0 : 1);
