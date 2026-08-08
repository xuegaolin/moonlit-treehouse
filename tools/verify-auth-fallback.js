// 端到端验证：模拟 develop 环境 + 真实 login 返回 40101，验证自动降级拿到 token
// 再用该 token 打真实后端接口，确认 401 消失
const http = require('http');

const HOST = '192.168.0.188';
const PORT = 8081;
const PREFIX = '/api/v1';

function call(method, path, body, token) {
  return new Promise(function (resolve) {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request({ host: HOST, port: PORT, path: PREFIX + path, method: method, headers: headers, timeout: 10000 },
      function (res) {
        let buf = '';
        res.on('data', function (c) { buf += c; });
        res.on('end', function () {
          let j = null;
          try { j = JSON.parse(buf); } catch (e) {}
          resolve({ status: res.statusCode, body: j, raw: buf });
        });
      });
    req.on('error', function (e) { resolve({ status: 0, err: e.message }); });
    req.on('timeout', function () { req.destroy(); resolve({ status: 0, err: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

(async function () {
  console.log('=== 1. 模拟小程序真实登录（appid 是占位符）===');
  const real = await call('POST', '/wechat/login', { code: 'mock_code_from_wx_login' });
  console.log('  /wechat/login  HTTP ' + real.status + '  code=' + (real.body && real.body.code) + '  ' + (real.body && real.body.message));
  const realFailed = !(real.body && real.body.code === 200);
  console.log('  -> 真实登录' + (realFailed ? '失败（预期）' : '成功'));

  let token = null;
  if (realFailed) {
    console.log('');
    console.log('=== 2. auth.js 降级逻辑：调 /wechat/test-login ===');
    const t = await call('POST', '/wechat/test-login', {});
    console.log('  /wechat/test-login  HTTP ' + t.status + '  code=' + (t.body && t.body.code) + '  ' + (t.body && t.body.message));
    if (t.body && t.body.code === 200 && t.body.data) {
      token = t.body.data.token;
      console.log('  -> 降级成功，openid=' + t.body.data.openid);
      console.log('  -> token=' + token.slice(0, 24) + '...');
    } else {
      console.log('  -> 降级失败！后端 profile 可能不是 dev');
      process.exit(1);
    }
  }

  console.log('');
  console.log('=== 3. 用降级 token 打之前全部 401 的接口 ===');
  const tests = [
    ['GET',  '/coin/wallet',           null],
    ['GET',  '/user/profile',          null],
    ['GET',  '/membership/plans',      null],
    ['POST', '/user/update-profile',   { nickname: '测试昵称' }],
    ['POST', '/membership/subscribe',  { planCode: 'monthly' }]
  ];

  let pass = 0, fail = 0;
  for (const t of tests) {
    const r = await call(t[0], t[1], t[2], token);
    const c = r.body && r.body.code;
    const is401 = r.status === 401 || c === 40101;
    const ok = r.status === 200 && c === 200;
    let tag;
    if (is401) { tag = '[401]'; fail++; }
    else if (ok) { tag = '[OK ]'; pass++; }
    else { tag = '[BIZ]'; pass++; }   // 业务错误（如余额不足）也算鉴权通过
    console.log('  ' + tag + ' ' + t[0].padEnd(4) + ' ' + t[1].padEnd(24) + ' HTTP ' + r.status + ' code=' + c + '  ' + ((r.body && r.body.message) || r.err || ''));
  }

  console.log('');
  console.log('=== 结果 ===');
  console.log('  鉴权通过: ' + pass + ' / ' + tests.length);
  console.log('  仍 401  : ' + fail);
  console.log(fail === 0 ? '  ✅ 401 问题已解决' : '  ❌ 仍有 401');
  process.exit(fail === 0 ? 0 : 1);
})();
