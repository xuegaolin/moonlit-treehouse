// 复现 tarot/three-cards 的 50001，尝试不同参数组合定位
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

  L.push('=== 先确认 tarot/daily 正常 ===');
  const daily = await call('POST', '/tarot/daily', {}, token);
  L.push('  code=' + (daily.body && daily.body.code) + '  ' + ((daily.body && daily.body.message) || ''));
  if (daily.body && daily.body.data) {
    const d = daily.body.data;
    L.push('  data keys: ' + Object.keys(d).join(', '));
    if (d.cards) L.push('  cards 数: ' + d.cards.length);
  }

  L.push('');
  L.push('=== three-cards 各种参数组合 ===');
  const variants = [
    ['无参数', {}],
    ['question', { question: '我该换工作吗' }],
    ['question+空', { question: '' }],
    ['缺 question', { q: 'x' }],
    ['question 长', { question: '这是一个比较长的问题'.repeat(3) }]
  ];
  for (const [label, body] of variants) {
    const r = await call('POST', '/tarot/three-cards', body, token);
    L.push('  [' + label + '] code=' + (r.body && r.body.code) + '  ' + ((r.body && r.body.message) || ''));
    if (r.body && r.body.data) {
      L.push('      data keys: ' + Object.keys(r.body.data).join(', '));
    }
    if (r.body && r.body.traceId) L.push('      traceId: ' + r.body.traceId);
  }

  L.push('');
  L.push('=== 检查塔罗牌库数据量（50001 常见原因：牌库空）===');
  const unlock = await call('POST', '/tarot/unlock', { readingId: 'x' }, token);
  L.push('  /tarot/unlock 试探: code=' + (unlock.body && unlock.body.code) + '  ' + ((unlock.body && unlock.body.message) || ''));

  fs.writeFileSync('D:/clawd_workspace/_tarot3.txt', L.join(NL), 'utf8');
  console.log('written to _tarot3.txt');
})();
