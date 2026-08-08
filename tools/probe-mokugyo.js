// 抓木鱼接口的服务端异常（读日志增量）
const http = require('http');
const fs = require('fs');

const HOST = '192.168.0.188';
const PORT = 8081;
const PREFIX = '/api/v1';
const LOG = 'D:\\clawd_workspace\\boot4.log';\n\nfunction call(method, path, body, token) {\n  return new Promise((resolve) => {
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(
      { host: HOST, port: PORT, path: PREFIX + path, method: method, headers: headers, timeout: 20000 },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
          catch (e) { resolve({ status: res.statusCode, raw: buf }); }
        });
      }
    );
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const login = await call('POST', '/wechat/test-login', {}, null);
  const token = login.json && login.json.data && login.json.data.token;
  if (!token) {
    console.log('no token:', JSON.stringify(login));
    return;
  }

  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  const r = await call('POST', '/wish/mokugyo/tap', { count: 1 }, token);
  console.log('tap resp:', JSON.stringify(r.json || r));

  await sleep(3000);
  const after = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  console.log('log size', before, '->', after);

  if (after > before) {
    const fd = fs.openSync(LOG, 'r');
    const buf = Buffer.alloc(after - before);
    fs.readSync(fd, buf, 0, buf.length, before);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split(/\r?\n/);
    const re = /Caused by|Unknown column|doesn't|cannot be null|Incorrect|Data truncat|at com\.treehouse/;
    const hit = lines.filter((l) => re.test(l));
    console.log('--- server exception ---');
    console.log(hit.slice(0, 20).join('\n') || '(no matching lines)');
  } else {
    console.log('(log did not grow)');
  }
})();
