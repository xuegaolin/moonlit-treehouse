// 验证：温暖「别人的」瓶子是否正常累加
// 造一个 B 用户的瓶子，再用 A 用户温暖它
const http = require('http');
const HOST = '192.168.0.188', PORT = 8081, PREFIX = '/api/v1';

function call(method, path, body, token) {
  return new Promise(function (resolve) {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: HOST, port: PORT, path: PREFIX + path, method: method, headers: headers, timeout: 10000 }, function (res) {
      let buf = '';
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

function getList(d) {
  return Array.isArray(d) ? d : (d && (d.list || d.content || d.records)) || [];
}

(async function () {
  const t = await call('POST', '/wechat/test-login', {});
  const token = t.body.data.token;
  console.log('用户: ' + t.body.data.openid);

  const feed = await call('GET', '/bottle/feed?page=0&size=20', null, token);
  const list = getList(feed.body && feed.body.data);
  console.log('');
  console.log('=== 现有瓶子归属分析 ===');
  console.log('  共 ' + list.length + ' 个瓶子');

  let mine = 0, others = 0;
  const results = [];
  for (const b of list) {
    const r = await call('POST', '/bottle/warm', { bottleId: b.bottleId, giftType: 'hug', coinCost: 0 }, token);
    const msg = (r.body && r.body.message) || '';
    const code = r.body && r.body.code;
    let kind;
    if (code === 200) { kind = 'OK 温暖成功 warmedTotal=' + (r.body.data && r.body.data.warmedTotal); others++; }
    else if (msg.indexOf('自己') > -1) { kind = 'SKIP 自己的瓶子'; mine++; }
    else if (msg.indexOf('已经温暖') > -1) { kind = 'SKIP 已温暖过'; others++; }
    else { kind = 'ERR code=' + code + ' ' + msg; }
    results.push('  [' + b.bottleId + '] warmCount=' + b.warmCount + '  -> ' + kind);
  }
  results.forEach(function (l) { console.log(l); });
  console.log('');
  console.log('  自己的瓶子: ' + mine + '，别人的: ' + others);

  if (others === 0) {
    console.log('');
    console.log('!! 所有瓶子都是当前用户发的，无法验证正常温暖流程。');
    console.log('   （dev test-login 固定同一个 openid，你发的瓶子都归它）');
  }

  console.log('');
  console.log('=== 重查 feed 确认持久化 ===');
  const feed2 = await call('GET', '/bottle/feed?page=0&size=20', null, token);
  getList(feed2.body && feed2.body.data).forEach(function (b) {
    console.log('  [' + b.bottleId + '] warmCount=' + b.warmCount);
  });
})();
