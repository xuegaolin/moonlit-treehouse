// 检查 feed 返回的种子数据（UTF-8 安全输出）
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
  const t = await call('POST', '/wechat/test-login', {});
  const token = t.body.data.token;
  const feed = await call('GET', '/bottle/feed?page=0&size=30', null, token);
  const d = feed.body.data;
  const list = d.list || [];

  const lines = [];
  lines.push('total=' + d.total + '  返回 ' + list.length + ' 条');
  lines.push('');
  lines.push('warm | isMine | warmed | tags                  | 内容');
  lines.push('-----|--------|--------|-----------------------|--------------------------------');
  list.forEach(function (b) {
    lines.push(
      String(b.warmCount).padStart(4) + ' | ' +
      String(b.isMine).padEnd(6) + ' | ' +
      String(b.warmed).padEnd(6) + ' | ' +
      (b.tags || []).join(',').padEnd(21).slice(0, 21) + ' | ' +
      (b.content || '').slice(0, 30)
    );
  });

  const mine = list.filter(function (b) { return b.isMine; }).length;
  const warmed = list.filter(function (b) { return b.warmed; }).length;
  const canWarm = list.filter(function (b) { return !b.isMine && !b.warmed; }).length;
  lines.push('');
  lines.push('=== 按钮三态分布 ===');
  lines.push('  你的心事（isMine）  : ' + mine);
  lines.push('  已温暖 ✓（warmed）  : ' + warmed);
  lines.push('  可温暖 ›            : ' + canWarm);

  const out = lines.join(String.fromCharCode(10));
  fs.writeFileSync('D:/clawd_workspace/_feed_check.txt', out, 'utf8');
  console.log('written to _feed_check.txt');
})();
