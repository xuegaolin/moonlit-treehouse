// 验证 AI 摆烂理由是否真的走 LLM（起临时实例 8083，不碰 dev 8081）
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const BACKEND = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8083;
const KEY = fs.readFileSync('D:/clawd_workspace/.credentials/ark-api-key.txt', 'utf8').trim();

function killTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
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
    r.setTimeout(40000, function () { r.destroy(); resolve({ status: 0, body: 'timeout' }); });
    if (body) r.write(body);
    r.end();
  });
}

async function waitUp(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await req({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET', timeout: 3000 });
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
  const probe = await req({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET', timeout: 2000 });
  const released = probe.status === 0;
  console.log('端口 ' + port + (released ? ' 已释放' : ' 仍被占用!'));
  return released;
}

(async function () {
  console.log('启动临时实例 (port ' + PORT + ')，注入 AI key...');
  const child = spawn('mvn', ['-o', '-DskipTests', 'spring-boot:run',
    '-Dspring-boot.run.profiles=dev',
    '-Dspring-boot.run.arguments=--server.port=' + PORT
  ], {
    cwd: BACKEND,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, {
      NODE_NO_WARNINGS: '1',
      TREEHOUSE_AI_API_KEY: KEY
    })
  });

  // 捕获 AiService 的告警，定位 AI 为何回落模板
  const aiLogs = [];
  function sniff(buf) {
    String(buf).split(String.fromCharCode(10)).forEach(function (l) {
      if (l.indexOf('AiService') >= 0 || l.indexOf('AI 理由') >= 0) aiLogs.push(l.trim().slice(0, 180));
    });
  }
  if (child.stdout) child.stdout.on('data', sniff);
  if (child.stderr) child.stderr.on('data', sniff);

  let up = await waitUp(PORT, 150000);
  if (!up) {
    console.log('启动超时');
    await cleanup(child, PORT);
    process.exit(1);
  }
  console.log('实例已就绪，开始验证...');
  console.log('');
  // 登录拿 token
  const loginBody = JSON.stringify({ openid: 'test_ai_probe_' + Date.now() });
  const lg = await req({
    host: '127.0.0.1', port: PORT, path: '/api/v1/wechat/test-login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
  }, loginBody);
  let token = null;
  try { token = JSON.parse(lg.body).data.token; } catch (e) { }
  if (!token) {
    console.log('登录失败: ' + lg.body.slice(0, 200));
    await cleanup(child, PORT);
    process.exit(1);
  }
  console.log('登录成功');
  console.log('');

  // 连续领 3 张不同场景的摆烂证，看理由是否每次不同且非模板
  // 每个场景用独立 openid，绕开「每日限领一张」限制
  const scenes = ['monday', 'no_reason', 'breakup'];
  const got = [];
  for (const sc of scenes) {
    const oid = 'test_ai_' + sc + '_' + Date.now();
    const lb = JSON.stringify({ openid: oid });
    const lr = await req({
      host: '127.0.0.1', port: PORT, path: '/api/v1/wechat/test-login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) }
    }, lb);
    let tk = null;
    try { tk = JSON.parse(lr.body).data.token; } catch (e) { }
    if (!tk) { console.log('[' + sc + '] 登录失败'); continue; }

    const b = JSON.stringify({ type: sc });
    const r = await req({
      host: '127.0.0.1', port: PORT, path: '/api/v1/bailan/generate', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tk,
        'Content-Length': Buffer.byteLength(b)
      }
    }, b);
    let reason = null, code = null;
    try {
      const j = JSON.parse(r.body);
      code = j.code;
      reason = j.data && j.data.reasonText;
    } catch (e) { }
    console.log('[' + sc + '] http=' + r.status + ' code=' + code);
    if (reason) {
      console.log('   理由: ' + reason);
      got.push(reason);
    } else {
      console.log('   响应: ' + r.body.slice(0, 200));
    }
    console.log('');
  }

  // 判定：是否命中静态模板
  const templates = [
    '根据《人间打工人保护法》第 3 章第 8 条',
    '经月光委员会审定',
    '依照《周末延续特别条例》'
  ];
  let templateHit = 0;
  got.forEach(function (g) {
    templates.forEach(function (t) { if (g.indexOf(t) >= 0) templateHit++; });
  });

  console.log('=========== 判定 ===========');
  console.log('成功生成理由数: ' + got.length + '/3');
  console.log('命中静态模板数: ' + templateHit);
  if (aiLogs.length) {
    console.log('');
    console.log('--- AiService 相关日志 ---');
    aiLogs.slice(-8).forEach(function (l) { console.log('  ' + l); });
  } else {
    console.log('(未捕获到 AiService 日志)');
  }
  if (got.length === 3 && templateHit === 0) {
    console.log('PASS: 三条理由全部由 LLM 实时生成，未命中任何静态模板');
  } else if (got.length === 3) {
    console.log('注意: 有 ' + templateHit + ' 条命中模板 —— 可能 AI 调用失败走了兜底');
  } else {
    console.log('FAIL: 有请求未拿到理由');
  }

  const released = await cleanup(child, PORT);
  process.exit(got.length === 3 && templateHit === 0 && released ? 0 : 1);
})();
