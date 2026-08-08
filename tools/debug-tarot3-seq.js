// 隔离测试：连续调 three-cards，看是否第 2 次开始才失败（readingNo 冲突）
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
  const t = await call('POST', '/wechat/test-login', {});
  const token = t.body.data.token;

  L.push('=== daily 连续 3 次（对照组）===');
  for (let i = 1; i <= 3; i++) {
    const r = await call('POST', '/tarot/daily', {}, token);
    L.push('  #' + i + '  code=' + (r.body && r.body.code) +
           '  readingId=' + (r.body && r.body.data && r.body.data.readingId) +
           '  ' + ((r.body && r.body.message) || ''));
  }

  L.push('');
  L.push('=== three-cards 连续 3 次（实验组）===');
  for (let i = 1; i <= 3; i++) {
    const r = await call('POST', '/tarot/three-cards', { question: 'test' + i }, token);
    L.push('  #' + i + '  code=' + (r.body && r.body.code) +
           '  readingId=' + (r.body && r.body.data && r.body.data.readingId) +
           '  ' + ((r.body && r.body.message) || '') +
           '  traceId=' + (r.body && r.body.traceId));
  }

  fs.writeFileSync('D:/clawd_workspace/_t3seq.txt', L.join(NL), 'utf8');
  console.log('written to _t3seq.txt');
})();
