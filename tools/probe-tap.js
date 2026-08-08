// 打木鱼接口 + 抓 boot5.log 增量堆栈
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '192.168.0.188';
const PORT = 8081;
const PREFIX = '/api/v1';
const LOG = path.join('D:', 'clawd_workspace', 'boot5.log');

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
      method: method, headers: headers, timeout: 20000
    }, function (res) {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { buf += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on('error', function (e) { resolve({ error: e.message }); });
    req.on('timeout', function () { req.destroy(); resolve({ error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function tailFrom(file, offset) {
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  if (size <= offset) return '';
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  return buf.toString('utf8');
}

(async function () {
  const login = await call('POST', '/wechat/test-login', {}, null);
  const token = login.json && login.json.data && login.json.data.token;
  if (!token) {
    console.log('LOGIN FAILED:', JSON.stringify(login));
    return;
  }
  console.log('login OK');

  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  const r = await call('POST', '/wish/mokugyo/tap', { count: 1 }, token);
  console.log('tap ->', JSON.stringify(r.json || r));

  await sleep(3500);
  const chunk = tailFrom(LOG, before);
  const lines = chunk.split(/\r?\n/);
  const re = /Caused by|Unknown column|cannot be null|Incorrect|Data truncat|NullPointer|LazyInitialization|no transaction|TransactionRequired|at com\.treehouse/;
  const hits = lines.filter(function (l) { return re.test(l); });
  console.log('--- exception lines ---');
  console.log(hits.length ? hits.slice(0, 25).join('\n') : '(none found; log grew ' + chunk.length + ' bytes)');
})();
