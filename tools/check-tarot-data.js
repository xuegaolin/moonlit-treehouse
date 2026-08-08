// 查塔罗牌数据现状（P0 待办：补齐 78 张 + 牌意）
const { execSync } = require('child_process');
const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);

function q(sql) {
  const cmd = 'mysql -uroot -proot treehouse -N -B -e ' + DQ + sql + DQ;
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return 'ERR: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300);
  }
}

console.log('=== 表结构 ===');
console.log(q('DESCRIBE t_tarot_card'));

console.log('=== 数量统计 ===');
console.log('总牌数            : ' + q('SELECT COUNT(*) FROM t_tarot_card').trim());
console.log('大牌(major)       : ' + q("SELECT COUNT(*) FROM t_tarot_card WHERE arcana='major'").trim());
console.log('小牌(minor)       : ' + q("SELECT COUNT(*) FROM t_tarot_card WHERE arcana='minor'").trim());

console.log('');
console.log('=== 前 8 张样本 ===');
console.log(q('SELECT id,name,arcana FROM t_tarot_card ORDER BY id LIMIT 8'));
