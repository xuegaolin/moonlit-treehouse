// 查现有小牌的写法，作为补齐 52 张的格式模板
const { execSync } = require('child_process');
const DQ = String.fromCharCode(34);

function q(sql) {
  const cmd = 'mysql -uroot -proot treehouse -B -e ' + DQ + sql + DQ;
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return 'ERR: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300);
  }
}

console.log('=== 现有 4 张小牌（完整字段）===');
console.log(q("SELECT id,arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw FROM t_tarot_card WHERE arcana='minor' ORDER BY id"));

console.log('=== 小牌花色分布 ===');
console.log(q("SELECT suit,COUNT(*) c FROM t_tarot_card WHERE arcana='minor' GROUP BY suit"));

console.log('=== 大牌样本（看 meaning 是否已填）===');
console.log(q("SELECT number,name_cn,upright_kw,CHAR_LENGTH(IFNULL(upright_meaning,'')) len FROM t_tarot_card WHERE arcana='major' ORDER BY number LIMIT 6"));

console.log('=== meaning 填充率 ===');
console.log(q("SELECT arcana, COUNT(*) total, SUM(CASE WHEN upright_meaning IS NULL OR upright_meaning='' THEN 0 ELSE 1 END) has_meaning FROM t_tarot_card GROUP BY arcana"));
