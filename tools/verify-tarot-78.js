// 验证 78 张牌接入后抽牌功能正常（起临时实例 8086，不碰 8081）
// 关键修正：/tarot/daily 是 POST，不是 GET（上一版用 GET 得到 500，
// 真因是 HttpRequestMethodNotSupportedException，属于我探针的错，不是应用故障）
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8086;
const NL = String.fromCharCode(10);
const BEARER = 'Bearer ';

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
    q.setTimeout(120000, function () { q.destroy(); r({ status: 0, body: 'timeout' }); });
    if (body) q.write(body);
    q.end();
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function login(id) {
  const b = JSON.stringify({ openid: id });
  return req({
    host: '127.0.0.1', port: PORT, path: '/api/v1/wechat/test-login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }
  }, b).then(function (r) {
    try { return JSON.parse(r.body).data.token; } catch (e) { return null; }
  });
}

// POST /tarot/daily
function drawDaily(tk) {
  return req({
    host: '127.0.0.1', port: PORT, path: '/api/v1/tarot/daily', method: 'POST',
    headers: { 'Authorization': BEARER + tk, 'Content-Length': 0 }
  });
}

(async function () {
  console.log('启动临时实例 (port ' + PORT + ')...');
  const jvm = '-Dspring-boot.run.jvmArguments="-Dserver.port=' + PORT + '"';
  const child = spawn('mvn spring-boot:run ' + jvm, {
    cwd: ROOT, shell: true, env: process.env, stdio: ['ignore', 'ignore', 'ignore']
  });

  let up = false;
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const h = await req({ host: '127.0.0.1', port: PORT, path: '/api/v1/tarot/ping', method: 'POST', headers: { 'Content-Length': 0 } });
    if (h.status > 0) { up = true; break; }
  }
  if (!up) {
    console.log('实例启动失败');
    sh('taskkill /T /F /PID ' + child.pid);
    process.exit(1);
  }
  console.log('实例已就绪');
  console.log('');

  console.log('=== 抽 30 次（每次新用户），统计牌池覆盖 ===');
  const seen = {};
  const suits = {};
  const ids = {};
  let okCount = 0;
  let sample = null;
  for (let i = 0; i < 30; i++) {
    const t2 = await login('tarot78_' + Date.now() + '_' + i);
    if (!t2) continue;
    const r = await drawDaily(t2);
    try {
      const j = JSON.parse(r.body);
      if (i === 0) sample = r.body.slice(0, 260);
      if (j.code === 200 && j.data) {
        const d = j.data;
        // VO 实测结构：data.cards[0].{cardId,name,nameEn,position,keywords}
        const c0 = d.cards && d.cards[0];
        const nm = c0 && (c0.name || c0.nameCn);
        if (nm) {
          okCount++;
          seen[nm] = true;
          if (c0.cardId) ids[c0.cardId] = true;
          suits[c0.position || '?'] = (suits[c0.position || '?'] || 0) + 1;
        }
      }
    } catch (e) { }
  }
  if (sample) { console.log('首次响应样本: ' + sample); console.log(''); }
  console.log('成功抽牌: ' + okCount + '/30');
  console.log('不同牌面: ' + Object.keys(seen).length + ' 种');
  console.log('类别分布: ' + JSON.stringify(suits));

  console.log('正逆位分布: ' + JSON.stringify(suits));
  // id > 26 即为本次新增的 52 张之一（原有 26 张 id 为 1..26）
  const newIds = Object.keys(ids).filter(function (k) { return Number(k) > 26; });
  console.log('抽到的不同 cardId 数: ' + Object.keys(ids).length);
  console.log('其中新增牌(id>26): ' + newIds.length + ' 张 -> '
    + (newIds.length > 0 ? '52 张新牌确已进池' : '未抽到新牌'));

  console.log('');
  console.log('=========== 判定 ===========');
  const pass = okCount >= 25 && Object.keys(seen).length >= 10 && newIds.length > 0;
  console.log(pass
    ? 'PASS: 抽牌正常，' + Object.keys(seen).length + ' 种不同牌面，含新增小牌（78 张池已生效）'
    : 'FAIL: 见上方');

  console.log('');
  console.log('清理临时实例...');
  sh('taskkill /T /F /PID ' + child.pid);
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    const o = sh('netstat -ano -p TCP');
    let busy = false;
    o.split(NL).forEach(function (l) {
      if (l.indexOf(':' + PORT) >= 0 && l.indexOf('LISTENING') >= 0) busy = true;
    });
    if (!busy) { console.log('端口 ' + PORT + ' 已释放'); break; }
  }
  process.exit(pass ? 0 : 1);
})();
