// utils/auth.js — 微信登录流程封装
// 模式复用 ai-watermark-miniprogram：wx.login → code 换 token → 本地缓存
//
// 关键修正（原版启动白屏原因）：
//   原版在模块里用 getApp().globalData.baseUrl，而 app.js 的 onLaunch 阶段
//   getApp() 还是 undefined → TypeError → 启动直接挂。
//   现在统一从 utils/config.js 读配置，不依赖 getApp() 是否就绪。

var config = require('./config.js')

var TOKEN_KEY = 'token'
var OPENID_KEY = 'openid'

// 内存缓存（避免每次 getStorageSync）
var _token = null
var _openid = null

// 并发登录去重：多个页面同时触发只发一次请求
var _loginPromise = null

// 登录失败冷却：后端没起时避免每个请求都重试 wx.login（8 个页面 = 8 次无效请求）
var _lastFailAt = 0
var FAIL_COOLDOWN_MS = 5000

/** 把 token 同步进 globalData（getApp() 可用时才写，不可用就跳过） */
function syncToGlobal(token, openid) {
  try {
    var app = getApp()
    if (app && app.globalData) {
      app.globalData.token = token
      app.globalData.openid = openid
    }
  } catch (e) {
    // onLaunch 阶段 getApp() 不可用，忽略即可，内存缓存已经生效
  }
}


/** 保存登录结果到内存 + 本地缓存 + globalData */
function saveLoginResult(data) {
  _token = data.token
  _openid = data.openid
  wx.setStorageSync(TOKEN_KEY, data.token)
  wx.setStorageSync(OPENID_KEY, data.openid)
  syncToGlobal(data.token, data.openid)
  return data
}

/**
 * 开发环境降级登录：调 /wechat/test-login 免 code 签发 token。
 *
 * 用途：本地还没配真实 appid/secret 时，/wechat/login 返回 40101 invalid appid，
 * 拿不到 token 会导致所有业务接口 401。此时自动走后端 dev 后门。
 * 前置条件：后端 spring.profiles.active=dev（否则返回 403 生产环境禁止测试登录）。
 */
function testLoginFallback() {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: config.baseUrl + config.apiPaths.testLogin,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {},
      timeout: 10000,
      success: function (res) {
        var body = res.data || {}
        if (res.statusCode === 200 && body.code === 200 && body.data) {
          console.warn(
            '[auth] 已降级为开发测试登录（/wechat/test-login）。' +
            '真实登录不可用，通常是 application.yml 里 wechat.appid/secret 仍是占位符。'
          )
          resolve(saveLoginResult(body.data))
        } else {
          reject(new Error(body.message || ('测试登录失败 HTTP ' + res.statusCode)))
        }
      },
      fail: function (err) { reject(err) }
    })
  })
}

/**
 * 静默登录：wx.login 拿 code → POST /wechat/login → 缓存 token + openid
 * @returns {Promise<{token:string, openid:string, isNewUser:boolean}>}
 */
function login() {
  // 已有在飞的请求，直接复用
  if (_loginPromise) return _loginPromise

  // 刚失败过（后端未启动），冷却期内直接返回失败，不再打无效请求
  if (_lastFailAt && Date.now() - _lastFailAt < FAIL_COOLDOWN_MS) {
    return Promise.reject(new Error('登录冷却中（后端可能未启动）'))
  }

  // dev 模式直接走后门 test-login，不再跑 wx.login → /wechat/login 串行双请求
  // （后者必然拿不到真实 token——appid/secret 是占位符、调微信 jscode2session 必 40101）
  // 节省 2-5s 首屏。生产环境 devTestLogin=false 仍走真 wx.login 流程。
  if (config.devTestLogin) {
    _loginPromise = testLoginFallback()
    _loginPromise.then(
      function () { _loginPromise = null; _lastFailAt = 0 },
      function () { _loginPromise = null; _lastFailAt = Date.now() }
    )
    return _loginPromise
  }

  _loginPromise = new Promise(function (resolve, reject) {
    wx.login({
      success: function (loginRes) {
        if (!loginRes.code) {
          if (config.devTestLogin) {
            testLoginFallback().then(resolve, reject)
            return
          }
          reject(new Error('wx.login 未返回 code'))
          return
        }

        wx.request({
          url: config.baseUrl + config.apiPaths.login,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { code: loginRes.code },
          timeout: 10000,
          success: function (res) {
            var body = res.data || {}
            if (res.statusCode === 200 && body.code === 200 && body.data) {
              var data = saveLoginResult(body.data)
              console.log('[auth] 登录成功 openid=', data.openid, '新用户=', data.isNewUser)
              resolve(data)
            } else {
              // 真实登录失败（最常见：appid 是占位符 → 40101 invalid appid）
              // 开发环境自动降级走后端 dev 后门，避免全站 401
              if (config.devTestLogin) {
                console.warn(
                  '[auth] /wechat/login 失败：' + (body.message || res.statusCode) +
                  '，尝试降级测试登录'
                )
                testLoginFallback().then(resolve, function (e2) {
                  reject(new Error(
                    (body.message || '登录失败') + '；测试登录也失败：' + (e2 && e2.message || e2)
                  ))
                })
                return
              }
              reject(new Error(body.message || ('登录失败 HTTP ' + res.statusCode)))
            }
          },
          fail: function (err) {
            reject(err)
          }
        })
      },
      // wx.login 自身失败（DevTools 未登录微信账号 / 用户拒绝授权）
      fail: function (err) {
        if (config.devTestLogin) {
          console.warn('[auth] wx.login 失败，尝试降级测试登录：', err && err.errMsg)
          testLoginFallback().then(resolve, reject)
          return
        }
        reject(err)
      }
    })
  })

  // 无论成败都释放锁，失败时记录时间进入冷却
  _loginPromise.then(
    function () {
      _loginPromise = null
      _lastFailAt = 0
    },
    function () {
      _loginPromise = null
      _lastFailAt = Date.now()
    }
  )

  return _loginPromise
}

/**
 * 确保已登录：内存 → 本地缓存 → wx.login
 * @returns {Promise<string>} token
 */
function ensureLogin() {
  if (_token) return Promise.resolve(_token)

  var token = wx.getStorageSync(TOKEN_KEY)
  var openid = wx.getStorageSync(OPENID_KEY)
  if (token && openid) {
    _token = token
    _openid = openid
    syncToGlobal(token, openid)
    return Promise.resolve(token)
  }

  return login().then(function (data) {
    return data.token
  })
}

/** 强制重登（token 失效时用）：清缓存后重新 wx.login */
function forceLogin() {
  _token = null
  _openid = null
  _loginPromise = null
  _lastFailAt = 0   // 主动重登绕过冷却
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(OPENID_KEY)
  syncToGlobal(null, null)
  return login().then(function (data) {
    return data.token
  })
}

/** 当前 token（可能为 null） */
function getToken() {
  if (_token) return _token
  _token = wx.getStorageSync(TOKEN_KEY) || null
  return _token
}

/** 当前 openid（可能为 null） */
function getOpenid() {
  if (_openid) return _openid
  _openid = wx.getStorageSync(OPENID_KEY) || null
  return _openid
}

function isLoggedIn() {
  return !!getToken()
}

module.exports = {
  login: login,
  ensureLogin: ensureLogin,
  forceLogin: forceLogin,
  getToken: getToken,
  getOpenid: getOpenid,
  isLoggedIn: isLoggedIn
}
