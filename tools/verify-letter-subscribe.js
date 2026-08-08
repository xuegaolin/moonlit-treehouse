// tools/verify-letter-subscribe.js
// Verify subscribe message module (8/6) end-to-end
// 1. Boot temp instance (port 8087)
// 2. /letter/create PENDING letter
// 3. /letter/subscribe-grant writes push_token
// 4. /letter/subscribe-status returns PENDING
// 5. /letter/admin/set-template-id sets dev fake id
// 6. Force deliver_at past, /letter/scan-due triggers deliver
// 7. Log status after deliver (dev no real openid, push is mock)
// 8. Cross-user access returns subscribed=false
const { execSync, spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const NL = String.fromCharCode(10)
const BEARER = 'Bearer '

const ROOT = 'D:/clawd_workspace/projects/moonlit-treehouse/backend'
const PORT = 8087

function sh(c) {
  try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (e) { return 'ERR: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300) }
}

function req(opt, body) {
  return new Promise(function (r) {
    const q = http.request(opt, function (s) {
      let d = ''
      s.on('data', function (c) { d += c })
      s.on('end', function () { r({ status: s.statusCode, body: d }) })
    })
    q.on('error', function (e) { r({ status: 0, body: e.message }) })
    q.setTimeout(60000, function () { q.destroy(); r({ status: 0, body: 'timeout' }) })
    if (body) q.write(body)
    q.end()
  })
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

function post(path, tk, body) {
  const h = { 'Content-Type': 'application/json' }
  if (tk) h['Authorization'] = BEARER + tk
  const b = body ? JSON.stringify(body) : null
  if (b) h['Content-Length'] = Buffer.byteLength(b)
  else h['Content-Length'] = 0
  return req({ host: '127.0.0.1', port: PORT, path: '/api/v1' + path, method: 'POST', headers: h }, b)
}

function get(path, tk, qs) {
  const h = {}
  if (tk) h['Authorization'] = BEARER + tk
  const qstr = qs ? '?' + Object.keys(qs).map(function (k) { return k + '=' + encodeURIComponent(qs[k]) }).join('&') : ''
  return req({ host: '127.0.0.1', port: PORT, path: '/api/v1' + path + qstr, method: 'GET', headers: h })
}

function parseJSON(body) {
  try { return JSON.parse(body) } catch (e) { return null }
}

let total = 0, pass = 0
function check(label, cond) {
  total++
  if (cond) { pass++; console.log('  [PASS] ' + label) }
  else { console.log('  [FAIL] ' + label) }
}

;(async function () {
  const netstat = sh('netstat -ano -p TCP')
  netstat.split(NL).forEach(function (l) {
    if (l.indexOf(':' + PORT + ' ') >= 0 && l.indexOf('LISTENING') >= 0) {
      const pid = l.trim().split(/\s+/).pop()
      sh('taskkill /T /F /PID ' + pid)
    }
  })
  await sleep(1500)

  console.log('=== Boot temp instance (port ' + PORT + ') ===')
  let apiKey = ''
  try { apiKey = fs.readFileSync('D:/clawd_workspace/.credentials/ark-api-key.txt', 'utf8').trim() } catch (e) {}
  const env = Object.assign({}, process.env, {
    TREEHOUSE_AI_API_KEY: apiKey,
    NODE_NO_WARNINGS: '1'
  })
  const jvm = '-Dspring-boot.run.jvmArguments=-Dserver.port=' + PORT
  const child = spawn('mvn spring-boot:run ' + jvm, { cwd: ROOT, shell: true, env: env, stdio: ['ignore', 'pipe', 'pipe'] })
  let bootLog = ''
  child.stdout.on('data', function (d) { bootLog += d.toString() })
  child.stderr.on('data', function (d) { bootLog += d.toString() })

  let up = false
  for (let i = 0; i < 80; i++) {
    await sleep(2000)
    const h = await post('/letter/ping', null)
    if (h.status > 0) { up = true; break }
  }
  if (!up) {
    console.log('boot failed, last 2000 chars:')
    console.log(bootLog.slice(-2000))
    sh('taskkill /T /F /PID ' + child.pid)
    process.exit(1)
  }
  console.log('instance ready')

  console.log('')
  console.log('=== 1. PENDING letter + grant ===')
  const openid1 = 'test_sub_' + Date.now()
  const lg1 = await post('/wechat/test-login', null, { openid: openid1 })
  let tk1 = null
  try { tk1 = parseJSON(lg1.body).data.token } catch (e) {}
  if (!tk1) { console.log('login failed:', lg1.body.slice(0, 200)); process.exit(1) }
  console.log('user A logged in, openid=' + openid1)

  const deliverAt = Date.now() + 6 * 60 * 1000
  const cr = await post('/letter/create', tk1, {
    receiverType: 'self_future',
    deliverAt: deliverAt,
    content: 'Test subscribe message letter. Written on 8/6 verify.',
    envelopeCode: 'sakura',
    aiEnabled: false
  })
  let letterId = null
  try { letterId = parseJSON(cr.body).data.letterId } catch (e) {}
  check('create letter letterId=' + letterId, !!letterId)
  if (!letterId) { console.log('response:', cr.body.slice(0, 300)); process.exit(1) }

  const gr = await post('/letter/subscribe-grant', tk1, { letterId: letterId, pushToken: 'mock_push_token_for_' + letterId })
  console.log('  grant:', gr.body.slice(0, 200))
  const grantData = parseJSON(gr.body)
  check('grant 200', gr.status === 200)
  check('grant status=PENDING', grantData && grantData.data && grantData.data.status === 'PENDING')

  console.log('')
  console.log('=== 2. subscribe-status ===')
  const ss = await get('/letter/subscribe-status', tk1, { letterId: letterId })
  const ssData = parseJSON(ss.body)
  console.log('  status:', ss.body.slice(0, 200))
  check('status 200', ss.status === 200)
  check('subscribed=true', ssData && ssData.data && ssData.data.subscribed === true)
  check('status=PENDING', ssData && ssData.data && ssData.data.status === 'PENDING')
  check('expireAt set', ssData && ssData.data && !!ssData.data.expireAt)

  console.log('')
  console.log('=== 3. UK dedup (re-grant) ===')
  const gr2 = await post('/letter/subscribe-grant', tk1, { letterId: letterId, pushToken: 'another_push_token' })
  const gr2Data = parseJSON(gr2.body)
  check('re-grant 200', gr2.status === 200)
  check('re-grant still PENDING (no error)', gr2Data && gr2Data.data && gr2Data.data.status === 'PENDING')

  console.log('')
  console.log('=== 4. cross-user access ===')
  const openid2 = 'test_sub_other_' + Date.now()
  const lg2 = await post('/wechat/test-login', null, { openid: openid2 })
  const tk2 = parseJSON(lg2.body).data.token
  const ssOther = await get('/letter/subscribe-status', tk2, { letterId: letterId })
  check('cross-user 200', ssOther.status === 200)
  const ssOtherData = parseJSON(ssOther.body)
  console.log('  cross-user raw body:', ssOther.body)
  check('cross-user code=40401 (biz error)', ssOtherData && ssOtherData.code === 40401)
  check('cross-user data is null', ssOtherData && ssOtherData.data === null)

  console.log('')
  console.log('=== 5. deliver + push (dev mock) ===')
  const st = await post('/letter/admin/set-template-id', null, { templateId: 'DEV_FAKE_TEMPLATE_ID' })
  console.log('  set-template-id:', st.body.slice(0, 150))
  check('set-template-id 200', st.status === 200)

  // Force deliver_at past via SQL. Use single-quoted shell args; the SQL itself uses \\''
  // which mysql client interprets as escaped single quote.
  const mysqldll = 'E:\\mysql-5.7.39-winx64\\bin\\mysql.exe'
  const sqlBody = "UPDATE t_letter SET status='PENDING', deliver_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE letter_no = '" + letterId + "'; UPDATE t_letter_subscribe_log SET expire_at = DATE_ADD(NOW(), INTERVAL 29 DAY) WHERE letter_id = '" + letterId + "';"
  const sqlCmd = 'cmd /c "set MYSQL_PWD=root&& ' + mysqldll + ' -h 127.0.0.1 -P 3306 -u root treehouse -e ' + sqlBody + '"'
  try { console.log('  sql out:', sh(sqlCmd).substring(0, 200)) } catch (e) { console.log('  sql err:', e.message) }

  const scan = await post('/letter/scan-due', null, {})
  console.log('  scan-due:', scan.body.slice(0, 200))
  const scanData = parseJSON(scan.body)
  check('scan-due 200', scan.status === 200)
  check('delivered >= 1', scanData && scanData.data && scanData.data.delivered >= 1)

  const ss3 = await get('/letter/subscribe-status', tk1, { letterId: letterId })
  const ss3Data = parseJSON(ss3.body)
  console.log('  after-deliver status:', ss3.body.slice(0, 250))
  check('after-deliver subscribed=true', ss3Data && ss3Data.data && ss3Data.data.subscribed === true)
  check('after-deliver status PENDING (dev mock)',
    ss3Data && ss3Data.data && ss3Data.data.status === 'PENDING')

  console.log('')
  console.log('=== cleanup ===')
  sh('taskkill /T /F /PID ' + child.pid)
  for (let i = 0; i < 12; i++) {
    await sleep(1000)
    const o = sh('netstat -ano -p TCP')
    let busy = false
    o.split(NL).forEach(function (l) { if (l.indexOf(':' + PORT + ' ') >= 0 && l.indexOf('LISTENING') >= 0) busy = true })
    if (!busy) { console.log('port ' + PORT + ' released'); break }
  }

  console.log('')
  console.log('=== verdict ===')
  console.log('PASS: ' + pass + ' / TOTAL: ' + total)
  console.log(pass === total ? 'ALL PASS' : (pass + '/' + total + ' FAIL'))
  process.exit(pass === total ? 0 : 1)
})()
