// 排查抽牌 500 的真因：检查新插入的 52 张牌是否违反实体约束
const { execSync } = require('child_process');
const DQ = String.fromCharCode(34);

function q(sql) {
  const cmd = 'mysql -uroot -proot treehouse -N -B -e ' + DQ + sql + DQ;
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return 'ERR: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300); }
}

console.log('=== 实体约束 vs 实际数据 ===');
console.log('实体 name_cn 限长 50, name_en 限长 50, upright_kw 200, reversed_kw 200');
console.log('');
console.log('name_cn 超 50 的  : ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE CHAR_LENGTH(name_cn)>50').trim());
console.log('name_en 超 50 的  : ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE CHAR_LENGTH(name_en)>50').trim());
console.log('upright_kw 超 200 : ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE CHAR_LENGTH(upright_kw)>200').trim());
console.log('reversed_kw 超 200: ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE CHAR_LENGTH(reversed_kw)>200').trim());

console.log('');
console.log('=== NULL / 空值检查（实体标了 nullable=false）===');
console.log('arcana 空 : ' + q("SELECT COUNT(*) FROM t_tarot_card WHERE arcana IS NULL OR arcana=''").trim());
console.log('number 空 : ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE number IS NULL').trim());
console.log('name_cn 空: ' + q("SELECT COUNT(*) FROM t_tarot_card WHERE name_cn IS NULL OR name_cn=''").trim());
console.log('name_en 空: ' + q("SELECT COUNT(*) FROM t_tarot_card WHERE name_en IS NULL OR name_en=''").trim());
console.log('deleted 空: ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE deleted IS NULL').trim());
console.log('create_time 空: ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE create_time IS NULL').trim());

console.log('');
console.log('=== count() 与 findAll() 会不会不一致 ===');
console.log('全部行数        : ' + q('SELECT COUNT(*) FROM t_tarot_card').trim());
console.log('deleted=0 行数  : ' + q('SELECT COUNT(*) FROM t_tarot_card WHERE deleted=0').trim());
console.log('（实体有 @Where(deleted=0)，若两者不等则 count/findAll 索引错位 -> IndexOutOfBounds）');

console.log('');
console.log('=== 新插入的 52 张样本 ===');
console.log(q("SELECT id,suit,number,name_cn,name_en,deleted FROM t_tarot_card WHERE arcana='MINOR' AND suit='CUPS' ORDER BY number LIMIT 4"));
