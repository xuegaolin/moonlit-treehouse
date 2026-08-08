// utils/coin.js — 月光币本地缓存 + 服务端同步
// 使用方式：页面 onShow 调 syncWallet() 拉最新；获得奖励后调 addLocal() 做乐观更新
//
// 关键修正：不依赖 getApp()（原版 getApp().globalData 在早期调用会 TypeError）
var config = require('./config.js')
var request = require('./request.js')

var CACHE_KEY = 'coin_wallet'
var DEFAULT_WALLET = { balance: 0, todayEarned: 0, todayLimit: 100 }

// 请求节流：多个页面 onShow 连续触发时，2 秒内复用同一次请求，避免打爆后端
var THROTTLE_MS = 2000
var _inflight = null
var _lastAt = 0

/**
 * 读本地缓存的钱包
 * @returns {{balance:number, todayEarned:number, todayLimit:number}}
 */
function getCached() {
  var w = wx.getStorageSync(CACHE_KEY)
  if (!w || typeof w.balance !== 'number') {
    return Object.assign({}, DEFAULT_WALLET)
  }
  return w
}

/** 写本地缓存 */
function setCached(wallet) {
  wx.setStorageSync(CACHE_KEY, wallet)
}

/**
 * 从服务端同步钱包（GET /coin/wallet）
 * - 2 秒内的重复调用直接复用在飞的请求（页面切换时避免重复打接口）
 * - 失败（含后端未启动）时静默返回本地缓存，绝不 reject —— 页面可以放心 .then()
 * @param {boolean} [force] 传 true 跳过节流强制刷新（如领奖后）
 * @returns {Promise<{balance:number, todayEarned:number, todayLimit:number}>}
 */
function syncWallet(force) {
  var now = Date.now()
  if (!force && _inflight && now - _lastAt < THROTTLE_MS) {
    return _inflight
  }

  _lastAt = now
  _inflight = request
    .get(config.apiPaths.coinWallet, {}, { quiet: true })
    .then(function (data) {
      var wallet = {
        balance: (data && data.balance) || 0,
        todayEarned: (data && data.todayEarned) || 0,
        todayLimit: (data && data.todayLimit) || 100
      }
      setCached(wallet)
      return wallet
    })
    .catch(function (err) {
      console.warn('[coin] 钱包同步失败，用缓存兜底：', err && (err.errMsg || err.message))
      return getCached()
    })

  return _inflight
}

/**
 * 乐观增加余额（领奖后立即更新 UI，不等服务端回包）
 * @param {number} delta 正数
 * @returns 更新后的钱包
 */
function addLocal(delta) {
  var wallet = getCached()
  wallet.balance += delta
  wallet.todayEarned += delta
  setCached(wallet)
  return wallet
}

module.exports = {
  getCached: getCached,
  setCached: setCached,
  syncWallet: syncWallet,
  addLocal: addLocal
}
