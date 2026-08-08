// 验证 /membership/plans 三档齐全 + LIFE 可下单
const http = require('http');
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
  const t = await call('POST', '/wechat/test-login', {});
  if (!(t.body && t.body.code === 200)) { console.log('login failed: ' + t.raw); process.exit(1); }
  const token = t.body.data.token;

  const p = await call('GET', '/membership/plans', null, token);
  const plans = (p.body && p.body.data && p.body.data.plans) || [];
  console.log('后端返回档位数: ' + plans.length);
  plans.forEach(function (x) {
    console.log('  ' + x.code + '  price=' + x.price + '  days=' + x.days + '  recommend=' + (x.recommend === true));
  });

  const codes = plans.map(function (x) { return x.code; });
  const need = ['MONTH', 'YEAR', 'LIFE'];
  const missing = need.filter(function (c) { return codes.indexOf(c) < 0; });
  console.log(missing.length ? '缺档位: ' + missing.join(',') : '三档齐全 OK');

  for (const c of need) {
    const r = await call('POST', '/membership/subscribe', { planCode: c }, token);
    const code = r.body && r.body.code;
    console.log('subscribe ' + c + ' -> http=' + r.status + ' code=' + code + ' ' + ((r.body && r.body.message) || ''));
  }
})();
