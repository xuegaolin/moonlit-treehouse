// 验证塔罗深度解读已真实接入 LLM（非静态模板）
// 判定标准：解读文本不能命中 FULL_TEMPLATES 里的任何固定句
const { execSync, spawn } = require('child_process');
const http = require('http');

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend';
const PORT = 8088;
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
    q.setTimeout(180000, function () { q.destroy(); r({ status: 0, body: 'timeout' }); });
    if (body) q.write(body);
    q.end();
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function post(path, tk, body) {
  const h = { 'Content-Type': 'application/json' };
  if (tk) h['Authorization'] = BEARER + tk;
  const b = body ? JSON.stringify(body) : null;
  if (b) h['Content-Length'] = Buffer.byteLength(b);
  else h['Content-Length'] = 0;
  return req({ host: '127.0.0.1', port: PORT, path: '/api/v1' + path, method: 'POST', headers: h }, b);
}

// 静态模板的特征句（若出现说明回落了）
const TEMPLATE_MARKS = [
  '今天的太阳照进你心里',
  '放下旧的，全新的剧本刚刚翻开第一页',
  '你比自己想象的更勇敢',
  '今天的功课不在外面',
  '转角就在不远处',
  '雾在散，真相慢慢浮出水面'
];

(async function () {
  console.log('启动临时实例 (port ' + PORT + ')...');
  const jvm = '-Dspring-boot.run.jvmArguments="-Dserver.port=' + PORT + '"';
  const child = spawn('mvn spring-boot:run ' + jvm, {
    cwd: ROOT, shell: true, env: process.env, stdio: ['ignore', 'ignore', 'ignore']
  });

  let up = false;
  for (let i = 0; i < 80; i++) {
    await sleep(2000);
    const h = await post('/tarot/ping', null);
    if (h.status > 0) { up = true; break; }
  }
  if (!up) {
    console.log('实例启动失败');
    sh('taskkill /T /F /PID ' + child.pid);
    process.exit(1);
  }
  console.log('实例已就绪');

  let pass = 0;
  let total = 0;

  for (let round = 1; round <= 2; round++) {
    total++;
    console.log('');
    console.log('=========== 第 ' + round + ' 次解锁 ===========');

    // 登录
    const lb = { openid: 'tarotai_' + Date.now() + '_' + round };
    const lg = await post('/wechat/test-login', null, lb);
    let tk = null;
    try { tk = JSON.parse(lg.body).data.token; } catch (e) { }
    if (!tk) { console.log('登录失败: ' + lg.body.slice(0, 150)); continue; }

    // 抽牌
    const dr = await post('/tarot/daily', tk);
    let readingId = null;
    let cardName = null;
    try {
      const j = JSON.parse(dr.body);
      readingId = j.data.readingId;
      cardName = j.data.cards[0].name + '(' + j.data.cards[0].positionName + ')';
    } catch (e) { }
    if (!readingId) { console.log('抽牌失败: ' + dr.body.slice(0, 200)); continue; }
    console.log('抽到: ' + cardName + '  readingId=' + readingId);

    // 解锁完整解读
    const un = await post('/tarot/unlock', tk, { readingId: readingId });
    let full = null;
    try {
      const j = JSON.parse(un.body);
      full = j.data && (j.data.fullInterpretation || j.data.fullInterp);
    } catch (e) { }

    if (!full) {
      console.log('解锁失败: ' + un.body.slice(0, 250));
      continue;
    }

    console.log('解读长度: ' + full.length + ' 字');
    console.log('');
    console.log(full);
    console.log('');

    const hitTpl = TEMPLATE_MARKS.filter(function (m) { return full.indexOf(m) >= 0; });
    const hasMd = /[#*`]/.test(full);
    const badWords = ['心理治疗', '抗抑郁', '诊断', '精神科'].filter(function (w) {
      return full.indexOf(w) >= 0;
    });
    const paras = full.split(NL).filter(function (l) { return l.trim().length > 0; }).length;

    console.log('模板命中  : ' + (hitTpl.length === 0 ? '0 -> 真 LLM 生成' : hitTpl.join(', ') + ' -> 回落了模板!'));
    console.log('markdown  : ' + (hasMd ? '有残留' : '干净'));
    console.log('合规词    : ' + (badWords.length === 0 ? '通过' : '命中 ' + badWords.join(',')));
    console.log('段落数    : ' + paras + ' (要求 3)');
    console.log('长度合规  : ' + (full.length >= 250 && full.length <= 600 ? '是' : '否(要求300-420,容差250-600)'));

    if (hitTpl.length === 0 && !hasMd && badWords.length === 0 && full.length >= 250) {
      pass++;
    }
  }

  console.log('');
  console.log('=========== 判定 ===========');
  console.log('通过: ' + pass + '/' + total);
  const ok = pass === total && total > 0;
  console.log(ok ? 'PASS: 塔罗深度解读已真实接入 LLM' : 'FAIL: 见上方');

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
  process.exit(ok ? 0 : 1);
})();
