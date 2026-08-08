// 直接用 JDBC 层复现：手工 INSERT 一条 THREE_CARDS，看是哪一列炸
const { execFileSync } = require('child_process');
process.env.MYSQL_PWD = 'root';

function sql(stmt) {
  try {
    return execFileSync('mysql',
      ['-uroot', '-D', 'treehouse', '--default-character-set=utf8mb4', '-e', stmt],
      { encoding: 'utf8' });
  } catch (e) {
    return 'ERR: ' + String(e.stdout || e.stderr || e.message).split(String.fromCharCode(10))[0];
  }
}

console.log('=== 各表字符集/排序规则（emoji 需要 utf8mb4）===');
console.log(sql(
  "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES " +
  "WHERE TABLE_SCHEMA='treehouse' AND TABLE_NAME LIKE 't_tarot%';"
));

console.log('=== cards_json / short_interp 列字符集 ===');
console.log(sql(
  "SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME, CHARACTER_MAXIMUM_LENGTH " +
  "FROM information_schema.COLUMNS " +
  "WHERE TABLE_SCHEMA='treehouse' AND TABLE_NAME='t_tarot_reading' " +
  "AND COLUMN_NAME IN ('cards_json','short_interp','question','lucky_color');"
));

console.log('=== 试插一条含 emoji 的 THREE_CARDS ===');
const json = JSON.stringify([
  { positionName: '逆位', role: '过去', keywords: ['轻信直觉'], emoji: '🌙', cardId: 3, name: '女祭司', nameEn: 'The High Priestess', position: 'reversed' },
  { positionName: '正位', role: '现在', keywords: ['希望'], emoji: '⭐', cardId: 18, name: '星星', nameEn: 'The Star', position: 'upright' },
  { positionName: '正位', role: '未来', keywords: ['传统'], emoji: '📐', cardId: 6, name: '教皇', nameEn: 'The Hierophant', position: 'upright' }
]).replace(/'/g, "\\'");

const interp = '从「女祭司」走来，经过「星星」，走向「教皇」。';
console.log(sql(
  "INSERT INTO t_tarot_reading (user_id, reading_no, spread_type, question, cards_json, short_interp, unlock_price, unlocked, lucky_color, lucky_number, draw_date, create_time, update_time, deleted) " +
  "VALUES (1, 'T-PROBE-0001', 'THREE_CARDS', 'probe', '" + json + "', '" + interp + "', 990, 0, '#6B5CE7', 7, CURDATE(), NOW(), NOW(), 0);"
));

console.log('=== 结果 ===');
console.log(sql("SELECT reading_no, LENGTH(cards_json) len, CHAR_LENGTH(cards_json) chars FROM t_tarot_reading WHERE reading_no='T-PROBE-0001';"));

console.log('=== 清理探针 ===');
console.log(sql("DELETE FROM t_tarot_reading WHERE reading_no='T-PROBE-0001';"));
