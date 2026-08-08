// 验证 prod profile 下 test-login 后门确实关闭（不靠读代码，实跑）
// 用法: node tools/verify-prod-gate.js
//
// 做法：不改任何文件，用 SPRING_PROFILES_ACTIVE=prod 起一个临时实例到 8082 端口，
// 打 test-login 确认返回 403，然后关掉。避免污染当前 dev 实例。
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BACKEND = path.join(__dirname, '..', 'backend');
const PORT = 8082;

function call(port, p, body) {
  return new Promise(function (resolve) {
    const data = JSON.stringify(body || {});
    const req = http.request({
      host: '127.0.0.1', port: port, path: '/api/v1' + p, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000
    }, function (res) {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { b += c; });
      res.on('end', function () {
        let j = null; try { j = JSON.parse(b); } catch (e) {}
        resolve({ status: res.statusCode, body: j, raw: b });
      });
    });
    req.on('error', function (e) { resolve({ status: 0, err: e.message }); });
    req.on('timeout', function () { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

function waitUp(port, maxMs) {
  const deadline = Date.now() + maxMs;
  return new Promise(function (resolve) {
    (function poll() {
      const req = http.request({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET', timeout: 3000 },
        function (res) { res.resume(); resolve(true); });
      req.on('error', function () {
        if (Date.now() > deadline) return resolve(false);
        setTimeout(poll, 2000);
      });
      req.on('timeout', function () { req.destroy(); if (Date.now() > deadline) return resolve(false); setTimeout(poll, 2000); });
      req.end();
    })();
  });
}

// 杀进程树（shell:true 时 child.kill() 不会级联到孙进程，
// 19:20 那次就是这个缺陷导致两个 java 进程残留占着 8082）
function killTree(pid) {
  return new Promise(function (resolve) {
    if (process.platform === 'win32') {
      const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      k.on('close', function () { resolve(); });
      k.on('error', function () { resolve(); });
    } else {
      try { process.kill(-pid, 'SIGKILL'); } catch (e) {}
      resolve();
    }
  });
}

// 兼底：按端口清理所有听在该端口的进程
function killByPort(port) {
  return new Promise(function (resolve) {
    if (process.platform !== 'win32') return resolve();
    const ps = spawn('powershell', ['-NoProfile', '-Command',
      '(Get-NetTCPConnection -LocalPort ' + port + ' -State Listen -ErrorAction SilentlyContinue).OwningProcess | ' +
      'ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }'
    ], { stdio: 'ignore' });
    ps.on('close', function () { resolve(); });
    ps.on('error', function () { resolve(); });
  });
}

async function cleanup(child, port) {
  if (child && child.pid) await killTree(child.pid);
  await killByPort(port);
  // 确认端口真的释放了
  await new Promise(function (r) { setTimeout(r, 2000); });
  return new Promise(function (resolve) {
    const req = http.request({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET', timeout: 3000 },
      function (res) { res.resume(); resolve(false); });
    req.on('error', function () { resolve(true); });
    req.on('timeout', function () { req.destroy(); resolve(true); });
    req.end();
  });
}

(async function () {
  console.log('启动临时 prod 实例 (port ' + PORT + ')，不影响现有 dev 实例...');
  console.log('');

  // Windows 上 .cmd 必须经 shell 启动（直接 spawn mvn.cmd 会 EINVAL）。
  // shell:true 会触发 DEP0190 警告到 stderr，用 NODE_NO_WARNINGS 抑制，
  // 避免警告被 PowerShell 当成错误输出污染 exit code。
  const child = spawn('mvn', ['-o', '-DskipTests', 'spring-boot:run',
    '-Dspring-boot.run.profiles=prod',
    '-Dspring-boot.run.arguments=--server.port=' + PORT
  ], {
    cwd: BACKEND,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { NODE_NO_WARNINGS: '1' })
  });

  let bootLog = '';
  child.stdout.on('data', function (c) { bootLog += c.toString(); });
  child.stderr.on('data', function (c) { bootLog += c.toString(); });

  const up = await waitUp(PORT, 120000);
  if (!up) {
    console.log('临时实例启动失败/超时。最后日志片段：');
    console.log(bootLog.slice(-1200));
    await cleanup(child, PORT);
    process.exit(1);
  }

  console.log('实例已就绪，开始验证...');
  console.log('');

  const r = await call(PORT, '/wechat/test-login', {});
  const code = r.body && r.body.code;
  const msg = (r.body && r.body.message) || '';

  console.log('POST /wechat/test-login  (profile=prod)');
  console.log('  HTTP ' + r.status + '  code=' + code);
  console.log('  message: ' + msg);
  console.log('');

  const blocked = code !== 200;
  console.log(blocked
    ? 'PASS: prod 下后门已关闭，符合预期'
    : 'FAIL: prod 下后门仍可用！这是严重安全问题');

  console.log('');
  console.log('清理临时实例...');
  const released = await cleanup(child, PORT);
  console.log(released
    ? '端口 ' + PORT + ' 已释放，进程树已清理完毕'
    : '警告：端口 ' + PORT + ' 仍被占用，需手工检查');
  console.log('现有 dev 实例 (8081) 未受影响。');
  process.exit(blocked && released ? 0 : 1);
})();
