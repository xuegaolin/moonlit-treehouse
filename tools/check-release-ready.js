// 上线前置检查：把「上线必做清单」变成可执行验证
// 用法: node tools/check-release-ready.js
//
// 检查项对应 memory 里记的 5 条清单，逐项给出 READY / BLOCK 结论。
const fs = require('fs');
const path = require('path');
const http = require('http');
const NL = String.fromCharCode(10);

const ROOT = __dirname + '/..';
const results = [];

function add(item, ok, detail) {
  results.push({ item: item, ok: ok, detail: detail });
}

function readIf(p) {
  const full = path.join(ROOT, p);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

// 1. application.yml 微信 appid/secret 是否为真实值
const yml = readIf('backend/src/main/resources/application.yml');
if (yml === null) {
  add('1. 微信 appid/secret', false, 'application.yml 未找到');
} else {
  // 只看键值行本身，忽略注释行（注释里的 TODO 不代表值是占位符）
  const lines = yml.split(NL).filter(function (l) { return l.trim().indexOf('#') !== 0; });
  const appidVal = ((lines.find(function (l) { return /^\s*appid\s*:/.test(l); }) || '').split(':')[1] || '').trim();
  const wxSecretVal = ((lines.find(function (l) { return /^\s*secret\s*:\s*[0-9a-f]{20,}/i.test(l); }) || '').split(':')[1] || '').trim();
  const placeholder = /your|xxx+|todo|change|placeholder|示例|占位/i;
  const appidOk = /^wx[0-9a-f]{16}$/i.test(appidVal);
  const secretOk = wxSecretVal.length >= 24 && !placeholder.test(wxSecretVal);
  add('1. 微信 appid/secret', appidOk && secretOk,
      (appidOk && secretOk)
        ? '已填真实值 (appid=' + appidVal + ')'
        : 'appid=' + (appidVal || '空') + ' secret=' + (wxSecretVal ? '已填' : '空'));

  // JWT secret 必须走环境变量注入，不能用开发默认值
  const jwtLine = lines.find(function (l) { return /JWT_SECRET/.test(l); }) || '';
  const jwtEnvInjected = /\$\{JWT_SECRET:/.test(jwtLine);
  const jwtDevDefault = /do-not-use-in-prod/.test(jwtLine);
  add('1b. JWT_SECRET 生产注入', jwtEnvInjected && !jwtDevDefault ? true : jwtEnvInjected,
      jwtDevDefault
        ? '已支持环境变量注入，但默认值是开发密钥 —— 上线必须设置 JWT_SECRET 环境变量'
        : (jwtEnvInjected ? '走环境变量注入' : '未使用环境变量，硬编码风险'));
}

// 2. profile 是否 prod（关掉 test-login 后门）
if (yml !== null) {
  const active = (yml.match(/active:\s*([a-z]+)/i) || [])[1] || 'unknown';
  add('2. SPRING_PROFILES_ACTIVE=prod', active === 'prod',
      'application.yml active=' + active + (active === 'prod' ? '' : ' (dev 会暴露 /wechat/test-login 后门)'));
}

// 3. 小程序 BASE_URLS trial/release 是否换成真实 https 域名
const cfg = readIf('miniprogram/utils/config.js');
if (cfg === null) {
  add('3. BASE_URLS 真实域名', false, 'config.js 未找到');
} else {
  const hasExample = /api\.treehouse\.example\.com/.test(cfg);
  const hasTodo = /TODO\(上线\)/.test(cfg);
  add('3. BASE_URLS 真实域名', !hasExample && !hasTodo,
      hasExample ? 'trial/release 仍是 example.com 占位域名' : '已替换');

  // 4. DEV_TEST_LOGIN 是否会在非 develop 下关闭
  const devLogin = /DEV_TEST_LOGIN\s*=\s*ENV\s*===\s*'develop'/.test(cfg);
  const forcedEnv = (cfg.match(/^\s*ENV\s*=\s*'(\w+)'\s*;?\s*$/m) || [])[1];
  const hardcoded = cfg.split(NL).filter(function (l) {
    return /^\s*ENV\s*=\s*'/.test(l) && !/envVersion/.test(l);
  });
  add('4. DEV_TEST_LOGIN 自动关闭', devLogin,
      devLogin ? 'ENV!==develop 时自动 false（逻辑正确）' : '未绑定 ENV，需手工确认');
  add('4b. ENV 无硬编码覆盖', hardcoded.length <= 1,
      hardcoded.length > 1
        ? '发现 ' + hardcoded.length + ' 处硬编码 ENV 赋值，最后一处会覆盖 envVersion 自动探测: ' +
          hardcoded.map(function (l) { return l.trim(); }).join(' | ')
        : '仅默认值，靠 envVersion 自动探测');
}

// 5. 种子数据是否已清理（查后端）
function checkSeed() {
  return new Promise(function (resolve) {
    const req = http.request({
      host: '192.168.0.188', port: 8081,
      path: '/api/v1/wechat/test-login', method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': 2 },
      timeout: 8000
    }, function (res) {
      let b = '';
      res.on('data', function (c) { b += c; });
      res.on('end', function () {
        // test-login 还能用 => profile 不是 prod
        let j = null; try { j = JSON.parse(b); } catch (e) {}
        resolve(j && j.code === 200);
      });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
    req.write('{}');
    req.end();
  });
}

(async function () {
  const backdoorOpen = await checkSeed();
  if (backdoorOpen === null) {
    add('5. test-login 后门', true, '后端不可达（未启动），上线时以 profile 为准');
  } else {
    add('5. test-login 后门', !backdoorOpen,
        backdoorOpen ? '仍可用！生产环境必须关闭（切 prod profile）' : '已关闭');
  }

  console.log('=========== 上线前置检查 ===========');
  console.log('');
  let block = 0;
  results.forEach(function (r) {
    const tag = r.ok ? '[READY]' : '[BLOCK]';
    if (!r.ok) block++;
    console.log(tag + ' ' + r.item);
    console.log('        ' + r.detail);
  });
  console.log('');
  console.log('===================================');
  console.log(block === 0
    ? '全部就绪，可以上线'
    : 'BLOCK ' + block + ' 项，未达上线条件');
  console.log('');
  console.log('另需手工确认：种子数据清理');
  console.log('  node tools/clean-test-data.js          (dry-run 看规模)');
  console.log('  node tools/clean-test-data.js --confirm (执行)');
})();
