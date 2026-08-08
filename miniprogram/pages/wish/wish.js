// pages/wish/wish.js — 许愿池（模块 D）
// 接口：POST /wish/mokugyo/tap, /wish/create, /wish/close; GET /wish/mine
// 单页双 tab：木鱼 / 许愿池
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')

// 分类（与 API 规范 category 枚举对齐）
const CATEGORIES = [
  { code: 'study',  label: '学业', emoji: '📚' },
  { code: 'career', label: '事业', emoji: '💼' },
  { code: 'love',   label: '爱情', emoji: '💕' },
  { code: 'health', label: '健康', emoji: '🍀' },
  { code: 'other',  label: '其他', emoji: '✨' }
]

// 状态 → 文案 / 样式类（WXML 不能调 .toLowerCase()，必须在 JS 预算）
const WISH_STATUS_MAP = {
  OPEN:     { text: '许愿中',   cls: 'status-open' },
  ACHIEVED: { text: '✨ 已实现', cls: 'status-achieved' },
  CLOSED:   { text: '已放下',   cls: 'status-closed' }
}

const FALLBACK_WISHES = [
  {
    wishId: 'W-20260728-0001',
    category: 'love',
    content: '希望我能学会好好爱自己',
    status: 'OPEN',
    tapCount: 28,
    expectHint: '还有 6 个月',
    canClose: true
  },
  {
    wishId: 'W-20260720-0001',
    category: 'career',
    content: '希望面试顺利，offer 多多',
    status: 'ACHIEVED',
    tapCount: 100,
    expectHint: null,
    blessing: '月光女神听到了你的愿望，悄悄为你种下了一颗种子。',
    canClose: false
  }
]

Page({
  data: {
    activeTab: 'mokugyo',   // 'mokugyo' | 'pool'
    coinBalance: 0,

    // 木鱼状态
    tapAnimating: false,
    merit: 0,
    todayLeft: 100,
    todayMax: 100,
    // 待上报的敲击次数（节流后批量上报）
    pendingTaps: 0,
    lastSyncAt: 0,
    isOnline: true,

    // 许愿池
    categories: CATEGORIES,
    selectedCategory: 'love',
    newContent: '',
    newExpect: null,
    newExpectText: '选个时间',   // WXML 不能调 Date.now()/Math.round，在 JS 预算
    wishes: [],
    loading: false
  },

  onLoad: function () {
    // 立即从本地缓存同步余额（0s 首屏可见）
    this.setData({ coinBalance: coin.getCached().balance })
    // 木鱼初始状态从本地缓存读
    const cached = wx.getStorageSync('mokugyo-state')
    if (cached) {
      this.setData({
        merit: cached.merit || 0,
        todayLeft: cached.todayLeft || 100
      })
    }
  },

  onShow: function () {
    const that = this
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })
    if (this.data.activeTab === 'pool') {
      this.loadWishes()
    }
  },

  // ====== Tab 切换 ======
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'pool') {
      this.loadWishes()
    }
  },

  // ====== 木鱼 ======
  onTap: function () {
    if (this.data.todayLeft <= 0) {
      wx.showToast({ title: '今日木鱼已达上限', icon: 'none' })
      return
    }
    // 视觉反馈：动效 + 计数
    this.setData({
      tapAnimating: true,
      merit: this.data.merit + 1,
      todayLeft: this.data.todayLeft - 1,
      pendingTaps: this.data.pendingTaps + 1
    })
    setTimeout(function () { this.setData({ tapAnimating: false }) }.bind(this), 200)

    // 节流：每 10 次或 1.5 秒后批量上报
    if (this.data.pendingTaps >= 10 || (Date.now() - this.data.lastSyncAt) > 1500) {
      this.syncTaps()
    }
  },

  // 页面隐藏时强制同步一次
  onHide: function () {
    if (this.data.pendingTaps > 0) {
      this.syncTaps()
    }
  },

  syncTaps: function () {
    if (this.data.pendingTaps <= 0) return
    const that = this
    const count = this.data.pendingTaps

    // 本地乐观更新
    this.setData({ pendingTaps: 0, lastSyncAt: Date.now() })
    wx.setStorageSync('mokugyo-state', {
      merit: this.data.merit,
      todayLeft: this.data.todayLeft
    })

    request.post(config.apiPaths.wishMokugyoTap, { count: count }, { quiet: true })
      .then(function (data) {
        // 服务端为准
        if (data && typeof data.totalMerit === 'number') {
          that.setData({ merit: data.totalMerit })
        }
        if (data && typeof data.todayLeft === 'number') {
          that.setData({ todayLeft: data.todayLeft })
        }
        if (data && data.coinReward && data.coinReward > 0) {
          coin.addLocal(data.coinReward)
          that.setData({ coinBalance: that.data.coinBalance + data.coinReward })
          wx.showToast({ title: '+' + data.coinReward + ' 月光币 🪙', icon: 'none' })
        }
        wx.setStorageSync('mokugyo-state', {
          merit: that.data.merit,
          todayLeft: that.data.todayLeft
        })
      })
      .catch(function (err) {
        console.warn('木鱼上报失败（本地累计保留）：', err)
        if (err && err.code === 42901) {
          wx.showToast({ title: err.message || '今日木鱼已达上限', icon: 'none' })
          // 服务端说满了 → 回滚到 0
          that.setData({ todayLeft: 0 })
        }
      })
  },

  // ====== 许愿池 ======
  /** 给列表补上 WXML 需要的展示字段（状态文案 / 样式类） */
  decorateWishes: function (list) {
    return (list || []).map(function (w) {
      var st = WISH_STATUS_MAP[w.status] || WISH_STATUS_MAP.OPEN
      w.statusText = st.text
      w.statusClass = st.cls
      return w
    })
  },

  loadWishes: function () {
    const that = this
    this.setData({ loading: true })

    request.get(config.apiPaths.wishMine, {}, { quiet: true })
      .then(function (data) {
        // 兼容 data 是 list 或 {list: ...}
        const list = Array.isArray(data) ? data : (data.list || [])
        that.setData({ wishes: that.decorateWishes(list), loading: false })
      })
      .catch(function (err) {
        console.warn('[wish] 愿望拉取失败，本地兜底：', err && (err.errMsg || err.message))
        that.setData({ wishes: that.decorateWishes(FALLBACK_WISHES), loading: false })
      })
  },

  onSelectCategory: function (e) {
    this.setData({ selectedCategory: e.currentTarget.dataset.code })
  },

  onNewContentInput: function (e) {
    this.setData({ newContent: e.detail.value })
  },

  onPickExpect: function () {
    const that = this
    wx.showActionSheet({
      itemList: ['一周后', '一个月后', '三个月后', '半年后', '一年后'],
      success: function (res) {
        const days = [7, 30, 90, 180, 365][res.tapIndex]
        const ts = Date.now() + days * 86400000
        that.setData({
          newExpect: ts,
          newExpectText: '已选 · ' + days + ' 天后'
        })
      }
    })
  },

  onSubmit: function () {
    const that = this
    if (!this.data.newContent.trim()) {
      wx.showToast({ title: '愿望不能是空的', icon: 'none' })
      return
    }
    request.post(config.apiPaths.wishCreate, {
      category: this.data.selectedCategory,
      content: this.data.newContent.trim(),
      expectAt: this.data.newExpect,
      publicToWall: false
    }, { quiet: true })
      .then(function (wish) {
        wx.showToast({ title: '愿望已许下 🌙', icon: 'none' })
        that.setData({ newContent: '', newExpect: null, newExpectText: '选个时间' })
        that.loadWishes()
      })
      .catch(function (err) {
        console.warn('[wish] 许愿接口失败，本地演示：', err && (err.errMsg || err.message))
        const mock = {
          wishId: 'W-LOCAL-' + Date.now(),
          category: that.data.selectedCategory,
          content: that.data.newContent.trim(),
          status: 'OPEN',
          tapCount: 0,
          expectHint: that.data.newExpect ? '还有 ' + Math.round((that.data.newExpect - Date.now()) / 86400000) + ' 天' : null,
          canClose: true
        }
        that.setData({
          wishes: that.decorateWishes([mock].concat(that.data.wishes)),
          newContent: '',
          newExpect: null,
          newExpectText: '选个时间'
        })
        wx.showToast({ title: '已许愿（本地演示）', icon: 'none' })
      })
  },

  onCloseWish: function (e) {
    const that = this
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['愿望成真了 ✨', '主动放下 🍃'],
      success: function (res) {
        const achieved = res.tapIndex === 0
        that.doClose(id, achieved)
      }
    })
  },

  doClose: function (id, achieved) {
    const that = this
    request.post(config.apiPaths.wishClose, {
      wishId: id,
      achieved: achieved,
      aiBlessing: true
    }, { quiet: true })
      .then(function (data) {
        wx.showToast({
          title: achieved ? '✨ 愿望成真' : '🍃 放下也很好',
          icon: 'none'
        })
        that.loadWishes()
      })
      .catch(function (err) {
        console.warn('[wish] 结愿失败，本地兜底：', err && (err.errMsg || err.message))
        const list = that.data.wishes.map(function (w) {
          if (w.wishId === id) {
            w.status = achieved ? 'ACHIEVED' : 'CLOSED'
            w.blessing = '月光女神听到了你的愿望，悄悄为你种下了一颗种子。'
            w.canClose = false
          }
          return w
        })
        that.setData({ wishes: that.decorateWishes(list) })
      })
  },

  onShareAppMessage: function () {
    return { title: '今晚，我许了一个愿望 🕯', path: '/pages/wish/wish' }
  }
})
