// app.js — 今夜树屋全局入口
//
// 启动白屏修正（原版 bug）：
//   原版 onLaunch 直接 auth.ensureLogin()，而 auth 内部读 getApp().globalData，
//   但 App() 构造期间 getApp() 返回 undefined → TypeError → 启动就挂。
//   现在：配置全部收进 utils/config.js，登录延迟到 onShow（此时 getApp() 已就绪）。
//
// 登录流程与 request 模式复用自 ai-watermark-miniprogram：wx.login → code 换 token → 本地缓存
var config = require('./utils/config.js')
var auth = require('./utils/auth.js')

App({
  globalData: {
    token: null,
    openid: null,
    userInfo: null,

    // 配置从 utils/config.js 单一来源读取（分 develop/trial/release 环境）
    env: config.ENV,
    baseUrl: config.baseUrl,
    mockFallback: config.mockFallback,
    apiPaths: config.apiPaths
  },

  onLaunch: function () {
    console.log('[app] 启动 env=' + config.ENV + ' baseUrl=' + config.baseUrl)
    // 注意：这里不要碰 getApp()，也不要发请求，避免启动阶段异常
  },

  onShow: function () {
    // getApp() 此时已就绪，安全做静默登录
    if (this._loginStarted) return
    this._loginStarted = true

    auth.ensureLogin().catch(function (err) {
      console.warn('[app] 静默登录失败（后端未启动时页面会走本地兜底）：', err && (err.errMsg || err.message))
    })
  },

  onError: function (msg) {
    // 全局错误兜底：开发环境打到控制台，方便定位启动问题
    console.error('[app] 未捕获异常：', msg)
  },

  // 统一提示
  showToast: function (title, icon) {
    wx.showToast({ title: title, icon: icon || 'none', duration: 2000 })
  },

  showLoading: function (title) {
    wx.showLoading({ title: title || '加载中…', mask: true })
  },

  hideLoading: function () {
    wx.hideLoading()
  }
})
