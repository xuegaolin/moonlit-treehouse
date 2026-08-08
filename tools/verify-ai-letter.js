// 验证 AI 回信：写信 -> 立即投递 -> 检查 aiReply 是否由 LLM 真实生成
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const BACKEND = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8084;
const KEY = fs.readFileSync('D:/clawd_workspace/.credentials/ark-api-key.txt', 'utf8').trim();

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
    r.setTimeout(60000, function () { r.destroy(); resolve({ status: 0, body: 'timeout' }); });
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
  const p = await req({ host: '127.0.0.1', port: port, path: '/api/v1/membership/plans', method: 'GET', timeout: 2000 });
  const released = p.status === 0;
  console.log('端口 ' + port + (released ? ' 已释放' : ' 仍被占用!'));
  return released;
}

const LETTER = '今天又加班到十一点，地铁末班车上只剩我一个人。'
  + '我不知道自己这么拼是为了什么，好像所有人都在往前跑，只有我一直在原地打转。'
  + '有时候真的很想放弃，但又不敢停下来。写给一年后的我：你还在坚持吗？';

(async function () {
  console.log('启动临时实例 (port ' + PORT + ')...');
  const child = spawn('mvn', ['-o', '-DskipTests', 'spring-boot:run',
    '-Dspring-boot.run.profiles=dev',
    '-Dspring-boot.run.arguments=--server.port=' + PORT
  ], {
    cwd: BACKEND, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { NODE_NO_WARNINGS: '1', TREEHOUSE_AI_API_KEY: KEY })
  });

  const aiLogs = [];
  function sniff(b) {
    String(b).split(String.fromCharCode(10)).forEach(function (l) {
      if (l.indexOf('AiService') >= 0 || l.indexOf('AI 回信') >= 0) aiLogs.push(l.trim().slice(0, 170));
    });
  }
  if (child.stdout) child.stdout.on('data', sniff);
  if (child.stderr) child.stderr.on('data', sniff);

  if (!await waitUp(PORT, 150000)) {
    console.log('启动超时');
    await cleanup(child, PORT);
    process.exit(1);
  }
  console.log('实例已就绪');
  console.log('');

  // 测两种人格，验证 prompt 生效
  const personas = ['SISTER', 'BESTIE'];
  const replies = [];

  for (const persona of personas) {
    const oid = 'test_ai_letter_' + persona + '_' + Date.now();
    const lb = JSON.stringify({ openid: oid });
    const lr = await req({
      host: '127.0.0.1', port: PORT, path: '/api/v1/wechat/test-login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lb) }
    }, lb);
    let tk = null;
    try { tk = JSON.parse(lr.body).data.token; } catch (e) { }
    if (!tk) { console.log('[' + persona + '] 登录失败'); continue; }

    // 写信（开启 AI 回信）—— deliverAt 是时间戳（毫秒），不是天数
    const cb = JSON.stringify({
      receiverType: 'self_future',
      content: LETTER,
      deliverAt: Date.now() + 7 * 86400000,
      aiEnabled: true,
      aiPersona: persona
    });
    const cr = await req({
      host: '127.0.0.1', port: PORT, path: '/api/v1/letter/create', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk,
        'Content-Length': Buffer.byteLength(cb)
      }
    }, cb);
    let letterId = null;
    try {
      const j = JSON.parse(cr.body);
      letterId = j.data && (j.data.letterId || j.data.id || j.data.letterNo);
    } catch (e) { }
    if (!letterId) {
      console.log('[' + persona + '] 写信失败: ' + cr.body.slice(0, 250));
      continue;
    }

    // 立即投递（触发 AI 回信）—— letterId 走 query 参数，不是路径段
    const dr = await req({
      host: '127.0.0.1', port: PORT,
      path: '/api/v1/letter/deliver-now?letterId=' + encodeURIComponent(letterId),
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + tk, 'Content-Length': 0 }
    }, null);
    let reply = null, code = null;
    try {
      const j = JSON.parse(dr.body);
      code = j.code;
      reply = j.data && j.data.aiReply;
    } catch (e) { }

    console.log('=========== 人格 ' + persona + ' ===========');
    console.log('http=' + dr.status + ' code=' + code);
    if (reply) {
      console.log('回信长度: ' + reply.length + ' 字');
      console.log('');
      console.log(reply);
      replies.push({ persona: persona, text: reply });
    } else {
      console.log('未拿到 aiReply，响应: ' + dr.body.slice(0, 300));
    }
    console.log('');
  }

  console.log('=========== 判定 ===========');
  console.log('成功生成回信: ' + replies.length + '/' + personas.length);
  let pass = replies.length === personas.length;
  replies.forEach(function (r) {
    const len = r.text.length;
    const lenOk = len >= 150 && len <= 1200;
    const noMd = r.text.indexOf('```') < 0 && r.text.indexOf('##') < 0;
    const noBan = ['心理治疗', '抗抑郁', '诊断'].every(function (w) { return r.text.indexOf(w) < 0; });
    console.log('  ' + r.persona + ': 长度' + len + (lenOk ? ' OK' : ' 异常')
      + ' / markdown' + (noMd ? '干净' : '残留')
      + ' / 合规词' + (noBan ? '通过' : '命中禁词!'));
    if (!lenOk || !noMd || !noBan) pass = false;
  });
  if (replies.length === 2) {
    const diff = replies[0].text !== replies[1].text;
    console.log('  两种人格内容不同: ' + (diff ? '是 -> persona prompt 生效' : '否 -> 可疑'));
    if (!diff) pass = false;
  }
  console.log('');
  console.log(pass ? 'PASS: AI 回信已真实接入 LLM' : 'FAIL: 见上方异常项');

  if (aiLogs.length) {
    console.log('');
    console.log('--- AiService 日志 ---');
    aiLogs.slice(-6).forEach(function (l) { console.log('  ' + l); });
  }

  const released = await cleanup(child, PORT);
  process.exit(pass && released ? 0 : 1);
})();
