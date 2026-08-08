// tools/restart-dev.js — 重启 dev 实例（8081），带全部踩坑防护
//
// 现状核查结论（2026-08-03 实测，不是猜的）：
//   - dev 不是跑 jar，而是 mvn spring-boot:run（pid 17016=maven, 9208=forked app）
//   - truststore 由 application.yml 默认值 classpath:ark-truststore.jks 自动加载，
//     不需要手动传 -Djavax.net.ssl.* （已在 target/classes 里）
//   - 只需注入 TREEHOUSE_AI_API_KEY，其余配置 yml 已有默认值
//
// 内置的踩坑防护（8/1~8/2 教训）：
//   1. shell:true 下 child.kill() 只杀壳不杀孙进程 -> 用 taskkill /T /F
//   2. 「杀了」不等于「端口释放了」 -> 杀完主动探端口
//   3. .cmd 批处理必须经 shell 启动，裸 spawn('mvn.cmd') 会 EINVAL
//   4. 不注入 AI key 则静默回落静态模板 -> 用户看到假 AI
//   5. 「启动了」不等于「能服务了」 -> 轮询健康检查
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8081;
const KEY_FILE = 'D:/clawd_workspace/.credentials/ark-api-key.txt';
const NL = String.fromCharCode(10);

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

function portPids(port) {
  const out = sh('netstat -ano -p TCP');
  const pids = [];
  out.split(NL).forEach(function (l) {
    if (l.indexOf(':' + port) < 0) return;
    if (l.indexOf('LISTENING') < 0) return;
    const parts = l.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pids.indexOf(pid) < 0) pids.push(pid);
  });
  return pids;
}

// 连 maven 壳进程一起找出来（它不监听端口，但必须一起杀）
function mavenPids() {
  const out = sh('wmic process where "name=\'java.exe\'" get ProcessId,CommandLine /format:csv');
  const pids = [];
  out.split(NL).forEach(function (l) {
    if (l.indexOf('moonlit-treehouse') < 0 && l.indexOf('plexus-classworlds') < 0) return;
    const parts = l.trim().split(',');
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid) && pids.indexOf(pid) < 0) pids.push(pid);
  });
  return pids;
}

function health(cb) {
  const req = http.request(
    { host: '127.0.0.1', port: PORT, path: '/api/v1/checkin/status', method: 'GET', timeout: 3000 },
    function (res) { res.resume(); cb(res.statusCode); }
  );
  req.on('error', function () { cb(0); });
  req.on('timeout', function () { req.destroy(); cb(0); });
  req.end();
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function main() {
  console.log('=== 1. 杀掉旧进程（含 maven 壳，进程树）===');
  const targets = [];
  portPids(PORT).forEach(function (p) { if (targets.indexOf(p) < 0) targets.push(p); });
  mavenPids().forEach(function (p) { if (targets.indexOf(p) < 0) targets.push(p); });

  if (targets.length === 0) {
    console.log('  无相关 java 进程');
  } else {
    targets.forEach(function (p) {
      console.log('  taskkill /T /F /PID ' + p);
      sh('taskkill /T /F /PID ' + p);
    });
  }

  console.log('');
  console.log('=== 2. 确认端口真释放 ===');
  let freed = false;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    if (portPids(PORT).length === 0) { freed = true; break; }
  }
  console.log('  端口 ' + PORT + (freed ? ' 已释放' : ' 仍被占用 —— 中止'));
  if (!freed) process.exit(1);

  console.log('');
  console.log('=== 3. 准备启动参数 ===');
  if (!fs.existsSync(KEY_FILE)) {
    console.log('  AI key 文件不存在: ' + KEY_FILE + ' —— 中止');
    process.exit(1);
  }
  const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
  console.log('  AI key: 已读取 (' + KEY.length + ' 字符)');

  const ts = ROOT + '/target/classes/ark-truststore.jks';
  console.log('  truststore: ' + (fs.existsSync(ts)
    ? 'classpath 已就位（yml 默认值自动加载）'
    : '缺失! AI 调用会 PKIX 失败'));

  console.log('');
  console.log('=== 4. 启动 mvn spring-boot:run ===');
  const logPath = ROOT + '/dev-restart.log';
  const logFd = fs.openSync(logPath, 'w');
  // .cmd 必须经 shell 启动，否则 EINVAL
  const child = spawn('mvn spring-boot:run', {
    cwd: ROOT,
    shell: true,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: Object.assign({}, process.env, {
      NODE_NO_WARNINGS: '1',
      TREEHOUSE_AI_API_KEY: KEY
    })
  });
  child.unref();
  console.log('  已启动 pid=' + child.pid + '  日志: backend/dev-restart.log');

  console.log('');
  console.log('=== 5. 轮询健康检查（最多 150s，mvn 启动较慢）===');
  let code = 0;
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    code = await new Promise(function (r) { health(r); });
    if (code === 200 || code === 401) break;
    if (i % 5 === 0) process.stdout.write('.');
  }
  console.log('');
  console.log('  /checkin/status -> HTTP ' + code + (code === 401 ? '（401=需登录，说明接口已存在）' : ''));

  if (code === 200 || code === 401) {
    console.log('');
    console.log('PASS: 新代码已生效（签到接口存在，不再是 404）');
    console.log('下一步: node tools/verify-after-restart.js 做三项复核');
    process.exit(0);
  } else {
    console.log('');
    console.log('FAIL: 启动异常，查看 backend/dev-restart.log 末尾');
    console.log(sh('powershell -c "Get-Content ' + logPath + ' -Tail 15"'));
    process.exit(1);
  }
})();
