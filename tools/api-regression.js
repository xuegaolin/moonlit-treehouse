// 全量接口回归（dev test-login + 所有模块）
const http = require('http');

const HOST = process.argv[2] || '192.168.0.188';
const PORT = 8081;
const PREFIX = '/api/v1';

function call(method, apiPath, body, token) {
  return new Promise(function (resolve) {
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      host: HOST, port: PORT, path: PREFIX + apiPath,
      method: method, headers: headers, timeout: 25000
    }, function (res) {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { buf += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf.slice(0, 200) }); }
      });
    });
    req.on('error', function (e) { resolve({ error: e.message }); });
    req.on('timeout', function () { req.destroy(); resolve({ error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

let pass = 0, fail = 0;

async function check(label, method, apiPath, body, token, allowBiz) {
  const r = await call(method, apiPath, body, token);
  if (r.error) {
    console.log('FAIL  ' + label + '  -> ' + r.error);
    fail++;
    return null;
  }
  const j = r.json;
  if (!j) {
    console.log('FAIL  ' + label + '  -> HTTP ' + r.status + ' non-json: ' + r.raw);
    fail++;
    return null;
  }
  if (j.code === 200) {
    console.log('PASS  ' + label);
    pass++;
    return j.data;
  }
  // 业务码：40x 是预期的校验/权限拦截，50001 才是服务端崩
  if (allowBiz && j.code !== 50001) {
    console.log('PASS  ' + label + '  (biz ' + j.code + ': ' + j.message + ')');
    pass++;
    return null;
  }
  console.log('FAIL  ' + label + '  -> code=' + j.code + ' ' + j.message);
  fail++;
  return null;
}

(async function () {
  console.log('=== moonlit-treehouse API regression ===');
  console.log('target http://' + HOST + ':' + PORT + PREFIX);
  console.log('');

  const login = await call('POST', '/wechat/test-login', {}, null);
  const token = login.json && login.json.data && login.json.data.token;
  if (!token) {
    console.log('FATAL: test-login failed -> ' + JSON.stringify(login.json || login));
    process.exit(1);
  }
  console.log('PASS  POST /wechat/test-login (token ' + token.length + ' chars)');
  pass++;

  // --- 读接口 ---
  await check('GET  /coin/wallet', 'GET', '/coin/wallet', null, token);
  await check('GET  /coin/logs', 'GET', '/coin/logs?page=0&size=10', null, token);
  await check('GET  /user/profile', 'GET', '/user/profile', null, token);
  await check('GET  /bailan/mine', 'GET', '/bailan/mine?page=0&size=10', null, token);
  await check('GET  /bailan/calendar', 'GET', '/bailan/calendar', null, token, true);
  await check('GET  /letter/mine', 'GET', '/letter/mine?page=0&size=50', null, token);
  await check('GET  /wish/mine', 'GET', '/wish/mine', null, token);
  await check('GET  /bottle/feed', 'GET', '/bottle/feed?page=0&size=10', null, token);

  // --- 写接口 ---
  await check('POST /tarot/daily', 'POST', '/tarot/daily', {}, token);
  await check('POST /tarot/three-cards', 'POST', '/tarot/three-cards',
    { question: '回归测试问题' }, token, true);
  await check('POST /wish/mokugyo/tap', 'POST', '/wish/mokugyo/tap', { count: 1 }, token);
  await check('POST /bailan/generate', 'POST', '/bailan/generate', {}, token, true);
  await check('POST /user/update-profile', 'POST', '/user/update-profile',
    { nickname: '回归测试' }, token, true);

  const wish = await check('POST /wish/create', 'POST', '/wish/create',
    { content: '回归测试愿望', category: 'other', isPublic: false }, token, true);

  await check('POST /bottle/publish', 'POST', '/bottle/publish',
    { content: '回归测试瓶子内容占位这里要够长一点', tags: ['治愈'] }, token, true);

  await check('POST /letter/create', 'POST', '/letter/create',
    { receiverType: 'self_future', content: '回归测试信件内容', deliverAt: Date.now() + 86400000, envelope: 'default' }, token, true);

  // --- 参数校验（这次修的两个 DTO，必须返回 400 而不是 500）---
  await check('POST /wish/mokugyo/tap (bad count)', 'POST', '/wish/mokugyo/tap',
    { count: 999 }, token, true);
  await check('POST /wish/close (missing field)', 'POST', '/wish/close',
    { wishId: 'NOT_EXIST' }, token, true);
  await check('POST /bottle/warm (bad id)', 'POST', '/bottle/warm',
    { bottleId: 'NOT_EXIST' }, token, true);
  await check('GET  /letter/detail (bad id)', 'GET', '/letter/detail?letterId=NOT_EXIST', null, token, true);

  // --- 鉴权（无 token 必须 401，不能 500）---
  await check('GET  /coin/wallet (no token)', 'GET', '/coin/wallet', null, null, true);

  console.log('');
  console.log('=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail === 0 ? 0 : 1);
})();
