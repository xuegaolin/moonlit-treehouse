// 验证留存钩子：签到 / 连续天数 / 勋章 / 并发安全
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const BACKEND = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8085;

function killTree(pid) {
  try {
    if (process.platform === 'win32') execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch (e) { }
}
function killByPort(port) {
  try {
    const ps = 'Get-NetTCPConnection -LocalPort ' + port + ' -State Listen -ErrorAction SilentlyContinue | '
      + 'ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }';
    execSync('powershell -NoProfile -Command "' + ps + '"', { stdio: 'ignore' });
  } catch (e) { }
}
function req(opts, body) {
  return new Promise(function (resolve) {
    const r = http.request(opts, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: d }); });
    });
    r.on('error', function (e) { resolve({ status: 0, body: 'ERR ' + e.message }); });
    r.setTimeout(30000, function () { r.destroy(); resolve({ status: 0, body: 'timeout' }); });
    if (body) r.write(body);
    r.end();
  });
}
async function waitUp(port, timeoutMs) {
  const dl = Date.now() + timeoutMs;
  while (Date.now() < dl) {
    const r = await req({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET' });
    if (r.status > 0) return true;
    await new Promise(function (s) { setTimeout(s, 3000); });
  }
  return false;
}
async function cleanup(child, port) {
  console.log('');
  console.log('清理临时实例...');
  if (child && child.pid) killTree(child.pid);
  killByPort(port);
  await new Promise(function (s) { setTimeout(s, 2000); });
  const p = await req({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET' });
  const rel = p.status === 0;
  console.log('端口 ' + port + (rel ? ' 已释放' : ' 仍被占用!'));
  return rel;
}
async function login(port, openid) {
  const b = JSON.stringify({ openid: openid });
  const r = await req({
    host: '127.0.0.1', port: port, path: '/api/v1/wechat/test-login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }
  }, b);
  try { return JSON.parse(r.body).data.token; } catch (e) { return null; }
}
function authGet(port, path, tk) {
  return req({
    host: '127.0.0.1', port: port, path: path, method: 'GET',
    headers: { 'Authorization': 'Bearer ' + tk }
  }, null);
}
function authPost(port, path, tk) {
  return req({
    host: '127.0.0.1', port: port, path: path, method: 'POST',
    headers: { 'Authorization': 'Bearer ' + tk, 'Content-Length': 0 }
  }, null);
}

(async function () {
  console.log('启动临时实例 (port ' + PORT + ')...');
  const child = spawn('mvn', ['-o', '-DskipTests', 'spring-boot:run',
    '-Dspring-boot.run.profiles=dev',
    '-Dspring-boot.run.arguments=--server.port=' + PORT
  ], {
    cwd: BACKEND, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { NODE_NO_WARNINGS: '1' })
  });

  if (!await waitUp(PORT, 150000)) {
    console.log('启动超时');
    await cleanup(child, PORT);
    process.exit(1);
  }
  console.log('实例已就绪');
  console.log('');

  let pass = true;
  const uid = 'test_checkin_' + Date.now();
  const tk = await login(PORT, uid);
  if (!tk) { console.log('登录失败'); await cleanup(child, PORT); process.exit(1); }

  // --- 1. 初始状态：未签到 ---
  console.log('=== 1. 初始状态 ===');
  let r = await authGet(PORT, '/api/v1/checkin/status', tk);
  let j = null;
  try { j = JSON.parse(r.body); } catch (e) { }
  if (j && j.data) {
    console.log('checkedToday=' + j.data.checkedToday + '  streak=' + j.data.streakDays
      + '  todayReward=' + j.data.todayReward + '  勋章目录=' + (j.data.medals || []).length + '项');
    if (j.data.checkedToday !== false) { console.log('  异常：新用户应为未签到'); pass = false; }
  } else {
    console.log('  FAIL: ' + r.body.slice(0, 200)); pass = false;
  }
  console.log('');

  // --- 2. 首次签到 ---
  console.log('=== 2. 首次签到 ===');
  r = await authPost(PORT, '/api/v1/checkin/do', tk);
  try { j = JSON.parse(r.body); } catch (e) { j = null; }
  if (j && j.code === 200 && j.data) {
    console.log('streak=' + j.data.streakDays + '  reward=' + j.data.coinReward
      + '  balance=' + j.data.coinBalance + '  nextReward=' + j.data.nextReward);
    console.log('文案: ' + j.data.encourage);
    if (j.data.streakDays !== 1 || j.data.coinReward !== 3) {
      console.log('  异常：首签应 streak=1 reward=3'); pass = false;
    }
  } else {
    console.log('  FAIL: ' + r.body.slice(0, 250)); pass = false;
  }
  console.log('');

  // --- 3. 重复签到必须被拒 ---
  console.log('=== 3. 重复签到（应拒绝）===');
  r = await authPost(PORT, '/api/v1/checkin/do', tk);
  try { j = JSON.parse(r.body); } catch (e) { j = null; }
  if (j && j.code === 42901) {
    console.log('正确拒绝: code=' + j.code + ' "' + j.message + '"');
  } else {
    console.log('  FAIL 未被拒绝: ' + r.body.slice(0, 200)); pass = false;
  }
  console.log('');

  // --- 4. 并发签到：10 并发只能成功 1 次 ---
  console.log('=== 4. 并发签到 10 次（新用户，只应成功 1 次）===');
  const uid2 = 'test_concur_' + Date.now();
  const tk2 = await login(PORT, uid2);
  const tasks = [];
  for (let i = 0; i < 10; i++) tasks.push(authPost(PORT, '/api/v1/checkin/do', tk2));
  const rs = await Promise.all(tasks);
  let ok = 0, rejected = 0, other = 0;
  const otherSamples = [];
  rs.forEach(function (x) {
    try {
      const y = JSON.parse(x.body);
      if (y.code === 200) ok++;
      else if (y.code === 42901) rejected++;
      else { other++; if (otherSamples.length < 3) otherSamples.push('code=' + y.code + ' ' + y.message); }
    } catch (e) { other++; if (otherSamples.length < 3) otherSamples.push(x.body.slice(0, 120)); }
  });
  console.log('成功=' + ok + '  正确拒绝=' + rejected + '  其他=' + other);
  if (otherSamples.length) {
    console.log('其他响应样本:');
    otherSamples.forEach(function (s) { console.log('  ' + s); });
  }
  if (ok === 1 && rejected === 9) {
    console.log('PASS: DB UK + 原子 SQL 成功拦住并发重复签到');
  } else if (ok === 1) {
    console.log('注意: 并发安全成立（仅 1 次成功），但 ' + other + ' 次返回非预期错码');
    pass = false;
  } else {
    console.log('FAIL: 并发下出现 ' + ok + ' 次成功（应为 1）');
    pass = false;
  }
  console.log('');

  // --- 5. 签到后状态 + 勋章墙 ---
  console.log('=== 5. 签到后状态 ===');
  r = await authGet(PORT, '/api/v1/checkin/status', tk);
  try { j = JSON.parse(r.body); } catch (e) { j = null; }
  if (j && j.data) {
    console.log('checkedToday=' + j.data.checkedToday + '  streak=' + j.data.streakDays
      + '  totalDays=' + j.data.totalDays + '  recentDates=' + (j.data.recentDates || []).length);
    if (j.data.checkedToday !== true) { console.log('  异常：应为已签到'); pass = false; }
  } else { console.log('  FAIL'); pass = false; }

  r = await authGet(PORT, '/api/v1/checkin/medals', tk);
  try { j = JSON.parse(r.body); } catch (e) { j = null; }
  if (j && j.data && j.data.medals) {
    console.log('勋章墙:');
    j.data.medals.forEach(function (m) {
      console.log('  ' + (m.achieved ? '[已解锁]' : '[未解锁]') + ' ' + m.name + ' (需' + m.needDays + '天)');
    });
  } else { console.log('  FAIL 勋章墙'); pass = false; }

  console.log('');
  console.log('=========== 判定 ===========');
  console.log(pass ? 'PASS: 留存钩子全部正常，并发安全' : 'FAIL: 见上方异常');

  const rel = await cleanup(child, PORT);
  process.exit(pass && rel ? 0 : 1);
})();
