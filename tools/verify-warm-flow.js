// 验证：温暖一个高热度瓶子，数字应该 +1 而不是跳水
const http = require('http');
const fs = require('fs');

function call(method, path, body, token) {
  return new Promise(function (resolve) {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ host: '192.168.0.188', port: 8081, path: '/api/v1' + path, method: method, headers: headers, timeout: 10000 }, function (res) {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { buf += c; });
      res.on('end', function () {
        let j = null; try { j = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, body: j });
      });
    });
    req.on('error', function (e) { resolve({ status: 0, err: e.message }); });
    if (data) req.write(data);
    req.end();
  });
}

(async function () {
  const L = [];
  const t = await call('POST', '/wechat/test-login', {});
  const token = t.body.data.token;

  const feed = await call('GET', '/bottle/feed?page=0&size=30&sort=hot', null, token);
  const list = (feed.body.data && feed.body.data.list) || [];
  const target = list.filter(function (b) { return !b.isMine && !b.warmed; })
                     .sort(function (a, b) { return b.warmCount - a.warmCount; })[0];

  if (!target) { L.push('no warmable bottle'); }
  else {
    L.push('=== 温暖前 ===');
    L.push('  bottleId  : ' + target.bottleId);
    L.push('  warmCount : ' + target.warmCount);
    L.push('  isMine    : ' + target.isMine + '   warmed: ' + target.warmed);

    const w = await call('POST', '/bottle/warm', { bottleId: target.bottleId, giftType: 'candy', coinCost: 6 }, token);
    L.push('');
    L.push('=== POST /bottle/warm ===');
    L.push('  code        : ' + (w.body && w.body.code) + '  ' + ((w.body && w.body.message) || ''));
    L.push('  warmedTotal : ' + (w.body && w.body.data && w.body.data.warmedTotal));

    const feed2 = await call('GET', '/bottle/feed?page=0&size=30&sort=hot', null, token);
    const after = ((feed2.body.data && feed2.body.data.list) || [])
      .filter(function (b) { return b.bottleId === target.bottleId; })[0];
    L.push('');
    L.push('=== 温暖后重查 feed ===');
    L.push('  warmCount : ' + (after && after.warmCount));
    L.push('  warmed    : ' + (after && after.warmed) + '  <- 应为 true（按钮变"已温暖 ✓"）');

    L.push('');
    L.push('=== 判定 ===');
    const expect = target.warmCount + 1;
    const actual = after && after.warmCount;
    L.push('  期望 ' + target.warmCount + ' + 1 = ' + expect + '，实际 ' + actual);
    L.push(actual === expect ? '  OK 数字正确 +1，没有跳水' : '  FAIL 数字异常！');
    L.push((after && after.warmed) ? '  OK warmed 已置 true' : '  FAIL warmed 未更新');

    // 重复温暖应被拒
    const w2 = await call('POST', '/bottle/warm', { bottleId: target.bottleId, giftType: 'hug', coinCost: 0 }, token);
    L.push('');
    L.push('=== 重复温暖（幂等校验）===');
    L.push('  code=' + (w2.body && w2.body.code) + '  ' + ((w2.body && w2.body.message) || ''));
    L.push((w2.body && w2.body.code !== 200) ? '  OK 正确拒绝' : '  FAIL 竟然允许重复温暖');
  }

  fs.writeFileSync('D:/clawd_workspace/_warm_check.txt', L.join(String.fromCharCode(10)), 'utf8');
  console.log('written to _warm_check.txt');
})();
