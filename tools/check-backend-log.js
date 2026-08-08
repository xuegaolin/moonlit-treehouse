// 后端日志健康检查 —— 自动挑最新的 boot*.log
// 用法: node tools/check-backend-log.js [logPath]
const fs = require('fs');
const path = require('path');

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const LOG_DIR = 'D:/clawd_workspace';

function newestLog() {
  const files = fs.readdirSync(LOG_DIR)
    .filter(function (f) { return /^boot.*\.log$/.test(f); })
    .map(function (f) {
      const full = path.join(LOG_DIR, f);
      return { f: f, full: full, mtime: fs.statSync(full).mtimeMs, size: fs.statSync(full).size };
    })
    .filter(function (x) { return x.size > 0; })
    .sort(function (a, b) { return b.mtime - a.mtime; });
  return files.length ? files[0] : null;
}

const arg = process.argv[2];
let LOG, label;
if (arg) {
  LOG = arg;
  label = arg;
} else {
  const n = newestLog();
  if (!n) { console.log('no boot*.log found in ' + LOG_DIR); process.exit(0); }
  LOG = n.full;
  label = n.f + '  (' + new Date(n.mtime).toLocaleString() + ', ' + n.size + ' bytes)';
}

if (!fs.existsSync(LOG)) { console.log('log not found: ' + LOG); process.exit(0); }

const lines = fs.readFileSync(LOG, 'utf8').split(NL).map(function (l) {
  return l.charAt(l.length - 1) === CR ? l.slice(0, -1) : l;
});

// 真 ERROR：排除 GlobalExceptionHandler 的业务 WARN（类名里带 Exception 会误判）
const isBiz = function (l) { return l.indexOf('业务异常') > -1; };
const err = lines.filter(function (l) {
  if (isBiz(l)) return false;
  return l.indexOf(' ERROR ') > -1 || l.indexOf('Caused by') > -1 ||
         (l.indexOf('Exception') > -1 && l.indexOf('GlobalExceptionHandler') === -1);
});
const biz = lines.filter(isBiz);
const started = lines.filter(function (l) { return l.indexOf('Started TreehouseApplication') > -1; });
const profile = lines.filter(function (l) { return l.indexOf('profile is active') > -1; });

console.log('log        : ' + label);
console.log('lines      : ' + lines.length);
console.log('启动次数   : ' + started.length);
if (profile.length) console.log('profile    : ' + profile[profile.length - 1].split(':').pop().trim());
console.log('真 ERROR   : ' + err.length);
console.log('业务 WARN  : ' + biz.length);

if (err.length) {
  console.log('');
  console.log('--- 真实错误（前 10）---');
  err.slice(0, 10).forEach(function (l) { console.log('  ' + l.slice(0, 170)); });
}

if (biz.length) {
  console.log('');
  console.log('--- 业务异常分布（正常现象）---');
  const map = {};
  biz.forEach(function (l) {
    const i = l.indexOf('message=');
    const k = i > -1 ? l.slice(i + 8).trim() : l.slice(-40);
    map[k] = (map[k] || 0) + 1;
  });
  Object.keys(map).sort(function (a, b) { return map[b] - map[a]; })
    .forEach(function (k) { console.log('  ' + String(map[k]).padStart(3) + ' x  ' + k); });
}

console.log('');
console.log(err.length === 0 ? '结论：无真实错误' : '结论：存在 ' + err.length + ' 条真实错误，需排查');
