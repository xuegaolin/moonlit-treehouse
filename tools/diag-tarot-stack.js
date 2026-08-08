// 抓塔罗 500 的真实异常栈（前台启动，输出确实落盘）
// 上一版用 detached spawn 导致日志空文件 —— 教训：detached + 文件重定向不可靠
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8087;
const LOG = ROOT + '/tarot-diag.log';
const NL = String.fromCharCode(10);

function sh(c) {
  try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}

function req(opt, body) {
  return new Promise(function (r) {
    const q = http.request(opt, function (s) {
      let d = '';
      s.on('data', function (c) { d += c; });
      s.on('end', function () { r({ status: s.statusCode, body: d }); });
    });
    q.on('error', function (e) { r({ status: 0, body: e.message }); });
    q.setTimeout(60000, function () { q.destroy(); r({ status: 0, body: 'timeout' }); });
    if (body) q.write(body);
    q.end();
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  const chunks = [];
  console.log('启动实例 (port ' + PORT + ')，输出实时收集...');
  const jvm = '-Dspring-boot.run.jvmArguments="-Dserver.port=' + PORT + '"';
  const child = spawn('mvn spring-boot:run ' + jvm, {
    cwd: ROOT, shell: true, env: process.env
  });
  child.stdout.on('data', function (d) { chunks.push(d.toString()); });
  child.stderr.on('data', function (d) { chunks.push(d.toString()); });

  let up = false;
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const h = await req({ host: '127.0.0.1', port: PORT, path: '/api/v1/tarot/daily', method: 'GET' });
    if (h.status > 0) { up = true; break; }
  }
  if (!up) {
    fs.writeFileSync(LOG, chunks.join(''), 'utf8');
    console.log('启动失败，日志已存 tarot-diag.log');
    sh('taskkill /T /F /PID ' + child.pid);
    process.exit(1);
  }
  console.log('实例已就绪，清空已收集日志再打接口');
  chunks.length = 0;

  // 登录
  const b = JSON.stringify({ openid: 'diag500_' + Date.now() });
  const lg = await req({
    host: '127.0.0.1', port: PORT, path: '/api/v1/wechat/test-login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }
  }, b);
  let tk = null;
  try { tk = JSON.parse(lg.body).data.token; } catch (e) { }
  console.log('登录: ' + (tk ? 'OK' : 'FAIL ' + lg.body.slice(0, 150)));

  if (tk) {
    const r = await req({
      host: '127.0.0.1', port: PORT, path: '/api/v1/tarot/daily', method: 'GET',
      headers: { 'Authorization': 'Bearer ' + tk }
    });
    console.log('');
    console.log('抽牌响应: HTTP ' + r.status);
    console.log(r.body.slice(0, 250));
  }

  await sleep(3000);
  const all = chunks.join('');
  fs.writeFileSync(LOG, all, 'utf8');

  console.log('');
  console.log('=== 异常栈（打接口后新产生的日志）===');
  const lines = all.split(NL);
  const hits = [];
  lines.forEach(function (l, k) {
    if (/Exception|Caused by|ERROR|IndexOutOfBounds|NullPointer|at com\.treehouse/.test(l)) hits.push(k);
  });
  if (hits.length === 0) {
    console.log('未捕获到异常行，输出末 30 行:');
    lines.slice(-30).forEach(function (l) { console.log('  ' + l.slice(0, 160)); });
  } else {
    hits.slice(0, 30).forEach(function (k) { console.log('  ' + lines[k].trim().slice(0, 170)); });
  }

  console.log('');
  console.log('清理...');
  sh('taskkill /T /F /PID ' + child.pid);
  await sleep(2000);
  process.exit(0);
})();
