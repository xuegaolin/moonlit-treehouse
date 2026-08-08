// 建留存钩子三张表（幂等，可重复执行）
const { execSync } = require('child_process');
const fs = require('fs');

const SQL = 'D:/clawd_workspace/projects/moonlit-treehouse/backend/src/main/resources/db/V3__retention_hooks.sql';
const MYSQL = 'mysql';

function findMysql() {
  const cands = [
    'mysql',
    'C:/Program Files/MySQL/MySQL Server 5.7/bin/mysql.exe',
    'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe',
    'D:/mysql/bin/mysql.exe'
  ];
  for (const c of cands) {
    try {
      execSync('"' + c + '" --version', { stdio: 'ignore' });
      return c;
    } catch (e) { }
  }
  return null;
}

const bin = findMysql();
if (!bin) {
  console.log('未找到 mysql 客户端，请手工执行:');
  console.log('  ' + SQL);
  process.exit(2);
}
console.log('mysql 客户端: ' + bin);

try {
  const out = execSync('"' + bin + '" -uroot -proot treehouse < "' + SQL + '"',
    { encoding: 'utf8', shell: 'cmd.exe', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log('执行输出: ' + (out.trim() || '(无输出，即成功)'));
} catch (e) {
  const msg = String(e.stderr || e.stdout || e.message);
  // mysql 会把 password warning 写 stderr，不算失败
  if (msg.indexOf('ERROR') >= 0) {
    console.log('执行失败: ' + msg.slice(0, 400));
    process.exit(1);
  }
  console.log('警告(非致命): ' + msg.trim().slice(0, 160));
}

// 复核：三张表是否真的建好
const check = 'SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES '
  + "WHERE TABLE_SCHEMA='treehouse' AND TABLE_NAME IN ('t_checkin','t_user_growth','t_medal');";
try {
  const r = execSync('"' + bin + '" -uroot -proot -N -B -e "' + check + '" treehouse',
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = r.trim().split(String.fromCharCode(10)).filter(Boolean);
  console.log('');
  console.log('已建表数: ' + lines.length + '/3');
  lines.forEach(function (l) { console.log('  ' + l); });
  process.exit(lines.length === 3 ? 0 : 1);
} catch (e) {
  console.log('复核失败: ' + String(e.stderr || e.message).slice(0, 200));
  process.exit(1);
}
