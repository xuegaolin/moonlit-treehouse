/**
 * smoke-api.js — 今夜树屋后端接口回归
 *
 * 用法: node tools/smoke-api.js [baseUrl]
 * 默认: http://192.168.0.188:8081/api/v1
 *
 * 走 dev profile 的 /wechat/test-login 拿 token，然后打全部业务接口。
 * 退出码 0 = 全绿；非 0 = 有失败。
 */
const http = require('http')
const { URL } = require('url')

const BASE = process.argv[2] || 'http://192.168.0.188:8081/api/v1'

function req(method, path, body, token) {
  return new Promise(resolve => {
    const u = new URL(BASE + path)
    const payload = body ? JSON.stringify(body) : null
    const headers = {}
    if (payload) {
      headers['Content-Type'] = 'application/json; charset=utf-8'
      headers['Content-Length'] = Buffer.byteLength(payload, 'utf8')
    }
    if (token) headers['Authorization'] = 'Bearer ' + token

    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method, headers, timeout: 15000
    }, res => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', d => raw += d)
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(raw) } catch (e) {}
        resolve({ http: res.statusCode, json, raw })
      })
    })
    r.on('error', e => resolve({ http: 0, json: null, raw: 'NETERR ' + e.message }))
    r.on('timeout', () => { r.destroy(); resolve({ http: 0, json: null, raw: 'TIMEOUT' }) })
    if (payload) r.write(payload)
    r.end()
  })
}

const results = []
async function check(name, method, path, body, token, allowCodes) {
  const r = await req(method, path, body, token)
  const code = r.json ? r.json.code : null
  const ok = code === 200 || (allowCodes || []).indexOf(code) > -1
  results.push({ name, ok, code, http: r.http, msg: r.json ? r.json.message : r.raw.slice(0, 100) })
  const flag = ok ? 'PASS' : 'FAIL'
  console.log(
    flag.padEnd(5) + name.padEnd(26) +
    'http=' + String(r.http).padEnd(5) +
    'code=' + String(code).padEnd(8) +
    (r.json ? r.json.message : r.raw.slice(0, 80))
  )
  return r.json
}

;(async () => {
  console.log('BASE = ' + BASE)
  console.log('='.repeat(90))

  const login = await check('wechat/test-login', 'POST', '/wechat/test-login', {}, null)
  const token = login && login.data && login.data.token
  if (!token) {
    console.log('\n[ABORT] 拿不到 token，后续接口跳过')
    process.exit(1)
  }
  console.log('token = ' + token.slice(0, 40) + '...\n')

  // 读接口（路径已对照 Controller 源码校验，业务 Controller 在 module/ 包下）
  await check('coin/wallet',        'GET',  '/coin/wallet', null, token)
  await check('coin/logs',          'GET',  '/coin/logs?page=0&size=10', null, token)
  await check('user/profile',       'GET',  '/user/profile', null, token)
  await check('membership/plans',   'GET',  '/membership/plans', null, token)
  await check('bailan/mine',        'GET',  '/bailan/mine?page=0&size=10', null, token)
  await check('bailan/calendar',    'GET',  '/bailan/calendar?month=' + new Date().toISOString().slice(0, 7), null, token)
  await check('letter/mine',        'GET',  '/letter/mine?page=0&size=50', null, token)
  await check('wish/mine',          'GET',  '/wish/mine', null, token)
  await check('bottle/feed',        'GET',  '/bottle/feed?page=0&size=10&sort=latest', null, token)

  // ping 接口（各模块健康检查）
  await check('letter/ping',        'POST', '/letter/ping', {}, token)
  await check('tarot/ping',         'POST', '/tarot/ping', {}, token)
  await check('wish/ping',          'POST', '/wish/ping', {}, token)
  await check('bottle/ping',        'POST', '/bottle/ping', {}, token)

  // 写接口（业务码也算通过，只要不是 500）
  await check('mokugyo/tap',        'POST', '/wish/mokugyo/tap', {}, token, [40001, 40002, 42901])
  await check('bailan/generate',    'POST', '/bailan/generate', { type: 'daily', mood: 'tired', reason: '测试' }, token, [40001, 40002, 40901])
  await check('tarot/daily',        'POST', '/tarot/daily', {}, token, [40001, 40002, 40901])
  await check('bottle/publish',     'POST', '/bottle/publish', { content: '自动化回归测试投瓶', tags: ['治愈'] }, token, [40001, 40002])
  await check('wish/create',        'POST', '/wish/create', { category: 'study', content: '回归测试许愿' }, token, [40001, 40002])

  console.log('='.repeat(90))
  const pass = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok)
  console.log('PASS ' + pass + ' / ' + results.length)
  if (fail.length) {
    console.log('\nFAILED:')
    fail.forEach(f => console.log('  - ' + f.name + '  http=' + f.http + ' code=' + f.code + '  ' + f.msg))
    process.exit(1)
  }
  console.log('全部通过 ✓')
})()
