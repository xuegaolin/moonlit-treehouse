// utils/checkin.js — 签到 / 连续天数 / 勋章
//
// 设计原则（沿用 coin.js 的成熟模式）：
//   1. 不依赖 getApp()，早期调用不会 TypeError
//   2. 请求节流：多页面 onShow 连续触发时复用在飞请求
//   3. 状态查询失败静默回落本地缓存，绝不 reject —— 页面可以放心 .then()
//   4. 签到动作（有副作用）不做静默兜底，必须把错误交给页面处理
var config = require('./config.js')
var request = require('./request.js')
var coin = require('./coin.js')

var CACHE_KEY = 'checkin_status'
var THROTTLE_MS = 2000

var DEFAULT_STATUS = {
  checkedToday: false,
  streakDays: 0,
  maxStreak: 0,
  totalDays: 0,
  todayReward: 3,
  recentDates: [],
  medals: [],
  lastCheckinDate: ''
}

var _inflight = null
var _lastAt = 0

/** 读本地缓存的签到状态 */
function getCached() {
  var s = wx.getStorageSync(CACHE_KEY)
  if (!s || typeof s.checkedToday !== 'boolean') {
    return JSON.parse(JSON.stringify(DEFAULT_STATUS))
  }
  // 验证日期：如果缓存的 checkedToday 是 true，必须是今天签到的才保留
  if (s.checkedToday && !isToday(s.lastCheckinDate)) {
    s.checkedToday = false
  }
  return s
}

/** 判断日期是否是今天 */
function isToday(dateStr) {
  if (!dateStr) return false
  var today = new Date()
  var y = today.getFullYear()
  var m = today.getMonth() + 1
  var d = today.getDate()
  var todayStr = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d)
  return dateStr === todayStr
}

function setCached(status) {
  wx.setStorageSync(CACHE_KEY, status)
}

/**
 * 同步签到状态（GET /checkin/status）。
 * 失败时静默返回缓存，不 reject。
 *
 * @param {boolean} [force] true 跳过节流强制刷新（签到成功后用）
 */
function syncStatus(force) {
  var now = Date.now()
  if (!force && _inflight && now - _lastAt < THROTTLE_MS) {
    return _inflight
  }
  _lastAt = now
  _inflight = request
    .get(config.apiPaths.checkinStatus, {}, { quiet: true })
    .then(function (data) {
      var s = {
        checkedToday: !!(data && data.checkedToday),
        streakDays: (data && data.streakDays) || 0,
        maxStreak: (data && data.maxStreak) || 0,
        totalDays: (data && data.totalDays) || 0,
        todayReward: (data && data.todayReward) || 3,
        recentDates: (data && data.recentDates) || [],
        medals: (data && data.medals) || [],
        lastCheckinDate: (data && data.checkedToday) ? getTodayStr() : (s && s.lastCheckinDate) || ''
      }
      setCached(s)
      return s
    })
    .catch(function (err) {
      console.warn('[checkin] 状态同步失败，用缓存兜底：', err && (err.errMsg || err.message))
      return getCached()
    })
  return _inflight
}

/**
 * 执行签到（POST /checkin/do）。
 *
 * 与 syncStatus 不同：这是有副作用的动作，失败必须让页面知道
 * （比如"今天已经签到过啦"要弹给用户看），所以不做静默兜底。
 *
 * @returns {Promise<Object>} 签到结果 { streakDays, coinReward, newMedals, encourage, ... }
 */
function getTodayStr() {
  var d = new Date()
  var y = d.getFullYear()
  var m = d.getMonth() + 1
  var day = d.getDate()
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
}

function doCheckin() {
  return request.post(config.apiPaths.checkinDo, {}).then(function (data) {
    // 乐观更新：立即标记今天已签到
    var c = getCached()
    c.checkedToday = true
    c.lastCheckinDate = getTodayStr()
    setCached(c)
    // 乐观更新月光币余额，省一次 wallet 请求
    if (data && data.coinReward) {
      coin.addLocal(data.coinReward)
    }
    // 签到成功后强制刷新状态缓存
    syncStatus(true)
    return data
  })
}

/** 勋章墙（GET /checkin/medals） */
function getMedals() {
  return request
    .get(config.apiPaths.checkinMedals, {}, { quiet: true })
    .then(function (data) {
      return (data && data.medals) || []
    })
    .catch(function () {
      var c = getCached()
      return c.medals || []
    })
}

/**
 * 生成近 N 天的日历格子数据，供 WXML 直接渲染。
 *
 * 后端只返回签到过的日期字符串数组，前端补齐空缺日期并标注状态。
 * 放在 utils 里而不是页面里，因为首页和个人页都要用。
 *
 * @param {string[]} recentDates 形如 ["2026-08-01","2026-08-03"]
 * @param {number} [days] 展示天数，默认 7
 */
function buildCalendar(recentDates, days) {
  var n = days || 7
  var set = {}
  for (var i = 0; i < (recentDates || []).length; i++) {
    set[recentDates[i]] = true
  }
  var out = []
  var today = new Date()
  for (var k = n - 1; k >= 0; k--) {
    var d = new Date(today.getTime() - k * 86400000)
    var y = d.getFullYear()
    var m = d.getMonth() + 1
    var day = d.getDate()
    var key = y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
    out.push({
      date: key,
      label: day + '',
      checked: !!set[key],
      isToday: k === 0
    })
  }
  return out
}

module.exports = {
  getCached: getCached,
  setCached: setCached,
  syncStatus: syncStatus,
  doCheckin: doCheckin,
  getMedals: getMedals,
  buildCalendar: buildCalendar
}
