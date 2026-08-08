// 复现「点了温暖但还显示 0 人温暖过」
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

(async function () {
  const t = await call('POST', '/wechat/test-login', {});
  const token = t.body && t.body.data && t.body.data.token;
  if (!token) { console.log('login failed:', t.raw); process.exit(1); }
  console.log('token ok, openid=' + t.body.data.openid);

  console.log('');
  console.log('=== 1. GET /bottle/feed 看真实字段 ===');
  const feed = await call('GET', '/bottle/feed?page=0&size=5', null, token);
  console.log('  HTTP ' + feed.status + ' code=' + (feed.body && feed.body.code));
  const d = feed.body && feed.body.data;
  const list = Array.isArray(d) ? d : (d && (d.list || d.content || d.records));
  console.log('  data 顶层类型: ' + (Array.isArray(d) ? 'Array' : typeof d));
  if (d && !Array.isArray(d)) console.log('  data keys: ' + Object.keys(d).join(', '));
  console.log('  条数: ' + (list ? list.length : 0));
  if (list && list.length) {
    console.log('  首条完整字段:');
    console.log('    ' + JSON.stringify(list[0]));
    console.log('  >>> 关键: warmCount = ' + list[0].warmCount + '  (类型 ' + typeof list[0].warmCount + ')');
  } else {
    console.log('  !! feed 为空，前端会走 mock 数据（mock 里 warmCount 是 28/64/132）');
    console.log('  raw: ' + feed.raw.slice(0, 400));
  }

  if (!list || !list.length) { process.exit(0); }

  const target = list.find(function (b) { return b.warmCount === 0 || b.warmCount === undefined; }) || list[0];
  const bid = target.bottleId || target.bottleNo || target.id;
  console.log('');
  console.log('=== 2. POST /bottle/warm  bottleId=' + bid + ' ===');
  const w = await call('POST', '/bottle/warm', { bottleId: bid, giftType: 'hug', coinCost: 0 }, token);
  console.log('  HTTP ' + w.status + ' code=' + (w.body && w.body.code) + '  ' + (w.body && w.body.message));
  console.log('  data: ' + JSON.stringify(w.body && w.body.data));

  console.log('');
  console.log('=== 3. 再 GET /bottle/feed 看有没有持久化 ===');
  const feed2 = await call('GET', '/bottle/feed?page=0&size=5', null, token);
  const d2 = feed2.body && feed2.body.data;
  const list2 = Array.isArray(d2) ? d2 : (d2 && (d2.list || d2.content || d2.records));
  const after = list2 && list2.find(function (b) { return (b.bottleId || b.bottleNo || b.id) === bid; });
  console.log('  同一瓶子 warmCount = ' + (after ? after.warmCount : 'NOT FOUND'));
  console.log('');
  console.log('=== 判定 ===');
  if (w.body && w.body.code === 200) {
    console.log('  warm 接口成功，返回 warmedTotal=' + (w.body.data && w.body.data.warmedTotal));
    console.log('  feed 重查 warmCount=' + (after ? after.warmCount : '?'));
    if (after && after.warmCount > 0) console.log('  -> 后端正常，问题在前端展示');
    else console.log('  -> 后端 feed 没返回累加值！');
  } else {
    console.log('  warm 接口失败 -> 前端 catch 分支做了本地 +1，但刷新后被 feed 覆盖回 0');
  }
})();
