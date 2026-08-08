// 造一个「别人」的瓶子用于验证温暖流程（走 mysql -e，避开 BOM/编码问题）
const { execFileSync } = require('child_process');

const SQL = [
  "INSERT INTO t_user (openid, nickname, status, create_time, update_time, deleted) SELECT 'test_openid_other_002', 'passerby-B', 1, NOW(), NOW(), 0 WHERE NOT EXISTS (SELECT 1 FROM t_user WHERE openid = 'test_openid_other_002');",
  "INSERT INTO t_bottle (bottle_no, user_id, content, tags_json, anonymous_id, warm_count, audit_status, create_time, update_time, deleted) SELECT 'B-TEST-OTHER-01', (SELECT id FROM t_user WHERE openid = 'test_openid_other_002'), 'bottle from another user for warm test', '[\"heal\",\"life\"]', 'passerby-TEST', 0, 'PASSED', NOW(), NOW(), 0 WHERE NOT EXISTS (SELECT 1 FROM t_bottle WHERE bottle_no = 'B-TEST-OTHER-01');",
  "SELECT b.id, b.bottle_no, b.user_id, u.openid, b.warm_count FROM t_bottle b JOIN t_user u ON u.id = b.user_id;"
].join(' ');

process.env.MYSQL_PWD = 'root';
try {
  const out = execFileSync('mysql', ['-uroot', '-D', 'treehouse', '--default-character-set=utf8mb4', '-e', SQL], { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.log('ERR:', e.stdout || e.message);
  process.exit(1);
}
