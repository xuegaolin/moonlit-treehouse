/**
 * trace-error.js — 打一个接口，抓出它在后端日志里新产生的异常栈
 *
 * 用法: node tools/trace-error.js <METHOD> <path> [jsonBody] [logFile]
 * 例:   node tools/trace-error.js POST /wish/mokugyo/tap {} D:\clawd_workspace\boot6.log\n *
 * 为什么需要:
 *   spring-boot:run 的日志是滚动追加的，手动 grep 会被后续输出冲掉。
 *   这个脚本先记录日志文件长度，打完接口再只读增量部分，精准定位。
 */
const http = require('http')
const fs = require('fs')
const { URL } = require('url')

const BASE = process.env.TH_BASE || 'http://192.168.0.188:8081/api/v1'
const method = (process.argv[2] || 'POST').toUpperCase()
const apiPath = process.argv[3] || '/wish/mokugyo/tap'
const bodyStr = process.argv[4] || '{}'
const logFile = process.argv[5] || 'D:\\clawd_workspace\\boot6.log'\n\nfunction req(m, p, body, token) {\n  return new Promise(resolve => {
    const u = new URL(BASE + p)
    const payload = body ? JSON.stringify(body) : null
    const headers = {}
    if (payload) {
      headers['Content-Type'] = 'application/json; charset=utf-8'
      headers['Content-Length'] = Buffer.byteLength(payload, 'utf8')
    }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: m, headers, timeout: 20000
    }, res => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', d => raw += d)
      res.on('end', () => {
        let j = null
        try { j = JSON.parse(raw) } catch (e) {}
        resolve({ http: res.statusCode, json: j, raw })
      })
    })
    r.on('error', e => resolve({ http: 0, raw: 'NETERR ' + e.message }))
    r.on('timeout', () => { r.destroy(); resolve({ http: 0, raw: 'TIMEOUT' }) })
    if (payload) r.write(payload)
    r.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

;(async () => {
  const login = await req('POST', '/wechat/test-login', {})
  const token = login.json && login.json.data && login.json.data.token
  if (!token) {
    console.log('拿不到 token: ' + login.raw.slice(0, 200))
    process.exit(1)
  }

  let offset = 0
  try { offset = fs.statSync(logFile).size } catch (e) {
    console.log('日志文件不存在: ' + logFile)
  }

  console.log('打 ' + method + ' ' + apiPath + '  body=' + bodyStr)
  const r = await req(method, apiPath, JSON.parse(bodyStr), token)
  console.log('http=' + r.http + '  resp=' + (r.raw || '').slice(0, 250))

  await sleep(2500)

  let delta = ''
  try {
    const fd = fs.openSync(logFile, 'r')
    const size = fs.statSync(logFile).size
    if (size > offset) {
      const buf = Buffer.alloc(size - offset)
      fs.readSync(fd, buf, 0, buf.length, offset)
      delta = buf.toString('utf8')
    }
    fs.closeSync(fd)
  } catch (e) {
    console.log('读日志失败: ' + e.message)
  }

  if (!delta.trim()) {
    console.log('\n日志无新增内容（可能异常没被记录，或日志路径不对）')
    return
  }

  console.log('\n===== 日志增量中的关键行 =====')
  const keep = /Caused by|Unknown column|SQL Error|at com\.treehouse|Exception:|ERROR/
  const lines = delta.split(/\r?\n/).filter(l => keep.test(l))
  const seen = {}
  lines.forEach(l => {
    const t = l.trim()
    if (seen[t]) return
    seen[t] = 1
    console.log('  ' + t)
  })
  if (!lines.length) console.log('  (无匹配，下面是原始增量前 1500 字符)\n' + delta.slice(0, 1500))
})()
