// 全模块接口回归：覆盖 A-F 六大模块，输出 UTF-8 报告
const http = require('http');
const fs = require('fs');
const NL = String.fromCharCode(10);

function call(method, path, body, token) {
  return new Promise(function (resolve) {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: '192.168.0.188', port: 8081, path: '/api/v1' + path, method: method, headers: headers, timeout: 15000 }, function (res) {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { buf += c; });
      res.on('end', function () {
        let j = null; try { j = JSON.parse(buf); } catch (e) {}
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
  const L = [];
  let pass = 0, biz = 0, fail = 0;

  const t = await call('POST', '/wechat/test-login', {});
  if (!(t.body && t.body.code === 200)) {
    fs.writeFileSync('D:/clawd_workspace/_regression.txt', 'LOGIN FAILED: ' + t.raw, 'utf8');
    console.log('login failed');
    process.exit(1);
  }
  const token = t.body.data.token;
  L.push('登录 OK  openid=' + t.body.data.openid);
  L.push('');

  const TESTS = [
    ['通用', 'GET',  '/coin/wallet', null],
    ['通用', 'GET',  '/coin/logs?page=0&size=10', null],
    ['通用', 'GET',  '/user/profile', null],
    ['通用', 'POST', '/user/update-profile', { nickname: '回归测试' }],
    ['会员', 'GET',  '/membership/plans', null],
    ['会员', 'POST', '/membership/subscribe', { planCode: 'MONTH' }],
    ['A摆烂','POST', '/bailan/generate', { type: 'daily', template: 'gov' }],
    ['A摆烂','GET',  '/bailan/mine?page=0&size=10', null],
    ['A摆烂','GET',  '/bailan/calendar?month=' + new Date().toISOString().slice(0,7).replace('-',''), null],
    ['B信箱','POST', '/letter/create', { receiverType: 'self_future', content: '回归测试信件', deliverAt: Date.now() + 86400000, envelope: 'default' }],
    ['B信箱','GET',  '/letter/mine?page=0&size=20', null],
    ['C塔罗','POST', '/tarot/daily', {}],
    ['C塔罗','POST', '/tarot/three-cards', { question: '回归测试' }],
    ['D许愿','POST', '/wish/mokugyo/tap', {}],
    ['D许愿','POST', '/wish/create', { category: 'study', content: '回归测试愿望' }],
    ['D许愿','GET',  '/wish/mine', null],
    ['E漂流','GET',  '/bottle/feed?page=0&size=10', null],
    ['E漂流','GET',  '/bottle/feed?page=0&size=10&sort=hot', null],
    ['E漂流','POST', '/bottle/publish', { content: '回归测试瓶子内容占位', tags: ['治愈'] }]
  ];

  let curMod = '';
  for (const [mod, method, path, body] of TESTS) {
    if (mod !== curMod) { L.push('--- ' + mod + ' ---'); curMod = mod; }
    const r = await call(method, path, body, token);
    const code = r.body && r.body.code;
    let tag;
    if (r.status === 0) { tag = 'FAIL'; fail++; }
    else if (r.status === 401 || code === 40101) { tag = '401 '; fail++; }
    else if (code === 200) { tag = 'PASS'; pass++; }
    else { tag = 'BIZ '; biz++; }
    L.push('  [' + tag + '] ' + method.padEnd(4) + ' ' + path.split('?')[0].padEnd(26) +
           ' code=' + String(code).padEnd(6) + ((r.body && r.body.message) || r.err || ''));
  }

  L.push('');
  L.push('=== 汇总 ===');
  L.push('  PASS(200)     : ' + pass);
  L.push('  BIZ(业务拒绝) : ' + biz);
  L.push('  FAIL(401/网络): ' + fail);
  L.push('  总计          : ' + TESTS.length);
  L.push('');
  L.push(fail === 0 ? '鉴权与连通性全部正常' : '存在 ' + fail + ' 项硬失败，需排查');

  fs.writeFileSync('D:/clawd_workspace/_regression.txt', L.join(NL), 'utf8');
  console.log('written to _regression.txt  pass=' + pass + ' biz=' + biz + ' fail=' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
