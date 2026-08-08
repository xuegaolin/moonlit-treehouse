// pages/tarot/tarot.js — 塔罗盲盒（模块 C）
// 接口：POST /tarot/daily, /tarot/three-cards, /tarot/unlock
// 单页双 tab：每日一抽 / 三牌阵
//
// 每日一抽改造（2026-08-07）：
//   - 状态机：未抽 → 抽牌中 → 结果（区分解锁/未解锁）
//   - 抽牌前必选心情（4 个 emoji，存到 question 字段复用）
//   - 抽牌音效（懒加载 + 静默失败）
//   - 分享卡（canvas 海报）
//   - 顶部显示连续打卡天数（复用 checkin 模块）
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')
const checkin = require('../../utils/checkin.js')
const tarotShare = require('../../utils/tarot-share.js')

// 78 张牌的本地数据（接口失败时用于演示）
const FALLBACK_DAILY = {
  readingId: 'T-LOCAL-DAILY',
  spreadType: 'DAILY',
  unlocked: false,
  unlockPrice: 990,
  shortInterpretation: '今天的太阳照进你心里：希望就在前方。',
  luckyColor: '#F5D76E',
  luckyNumber: 7,
  cards: [{
    cardId: 19, name: '太阳', nameEn: 'The Sun', position: 'upright',
    positionName: '正位', role: '今日指引',
    keywords: ['希望', '热情', '成功'],
    emoji: '☀️'
  }]
}

const FALLBACK_THREE = {
  readingId: 'T-LOCAL-THREE',
  spreadType: 'THREE_CARDS',
  unlocked: false,
  unlockPrice: 990,
  shortInterpretation: '从「愚者」走来，经过「命运之轮」，走向「太阳」。',
  luckyColor: '#6B5CE7',
  luckyNumber: 3,
  cards: [
    { cardId: 0, name: '愚者', nameEn: 'The Fool', position: 'upright', positionName: '正位', role: '过去', keywords: ['新开始', '自由'], emoji: '🃏' },
    { cardId: 10, name: '命运之轮', nameEn: 'Wheel of Fortune', position: 'reversed', positionName: '逆位', role: '现在', keywords: ['厄运', '停滞'], emoji: '🎡' },
    { cardId: 19, name: '太阳', nameEn: 'The Sun', position: 'upright', positionName: '正位', role: '未来', keywords: ['希望', '成功'], emoji: '☀️' }
  ]
}

const FALLBACK_FULL = {
  fullInterpretation:
    '今天的牌指向『希望』，意味着你心里那个隐隐的光，正在变成具体的形状。\n\n过去：你已经走过了很长的路，回头看会发现那些辛苦不是白费的。\n\n现在：你正处在一个转折的边缘，外部环境开始变得对你有利。\n\n未来：接下来 7 天会有让你欣慰的小事发生。\n\n建议：把注意力放在你『想要』的事上，而不是你『担心』的事上。',
  advice: [
    '深呼吸 3 次，给情绪一个落点',
    '今晚早点睡，明天再想',
    '找个朋友聊聊天，不必是 TA'
  ],
  songUrl: null
}

Page({
  data: {
    activeTab: 'daily',     // 'daily' | 'three'
    drawing: false,         // 抽牌中
    drawingTitle: '',       // 洗牌时给用户的提示
    reading: null,          // 当前占卜结果
    question: '',           // 三牌阵问题 / 每日一抽心情标签
    coinBalance: 0,
    unlocking: false,
    flipped: false,         // 牌是否已翻开（动效）
    cardAnimIndex: -1,      // 当前翻开的牌下标
    streakDays: 0,          // 连续打卡（顶部展示）

    // 心情选择（每日一抽）
    moods: [
      { code: 'calm',    label: '平静',  emoji: '🌿' },
      { code: 'anxious', label: '焦虑',  emoji: '🌧' },
      { code: 'hopeful', label: '期待',  emoji: '✨' },
      { code: 'lost',    label: '迷茫',  emoji: '🌫' }
    ],
    selectedMood: '',

    // 分享卡弹层
    showShareCard: false,

    // 历史弹层
    showHistory: false,
    historyList: [],
    historyLoading: false,
    historyPage: 0,
    historyHasMore: true,

    // 价格文案：WXML 不支持方法调用，必须在 JS 预算
    unlockPriceText: '9.90',
    unlockBtnText: '解锁完整解读 · ¥9.90',
    threeCardPriceText: '9.90'
  },

  onLoad: function () {
    // 加载音效（懒）
    this._initAudio()
    // 顶部连续打卡（失败静默）
    this._loadStreak()
    // 检查今日是否已抽：
    //  - 后端没有「仅查」接口，daily() 一调就抽
    //  - 用本地日期标记 + 本地缓存 readingId 作判断：
    //    今日已抽 → 调 daily（后端会返回原 reading）
    //    今日未抽 → 不调，让用户主动点
    this._bootstrapDaily()
  },

  _storageKey: function () { return 'tarot_daily_' + this._todayKey() },

  _todayKey: function () {
    var d = new Date()
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
  },

  _bootstrapDaily: function () {
    var that = this
    // 先仅查今日是否已抽（GET /tarot/today-check）—— 不触发抽牌
    request.get(config.apiPaths.tarotTodayCheck, {}, { quiet: true })
      .then(function (data) {
        if (data && data.hasRead) {
          // 已抽过 → 调 /daily 拿完整 reading（后端复用旧记录）
          return request.post(config.apiPaths.tarotDaily, {}, { quiet: true })
            .then(function (reading) {
              that.applyReading(reading, { drawing: false, flipped: true })
            })
        }
        // 未抽：保持未抽 UI，等用户主动点
      })
      .catch(function (err) {
        console.warn('[tarot] today-check 失败（保持未抽状态）：', err)
      })
  },

  onShow: function () {
    // 立即从本地缓存同步余额（0s 首屏可见）
    this.setData({ coinBalance: coin.getCached().balance })
    const that = this
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })
    // onShow 再刷一次打卡天数（用户在首页签了到，回到这里要更新）
    this._loadStreak()
  },

  // ====== 顶部条：连续打卡（复用 checkin 模块） ======
  _loadStreak: function () {
    var that = this
    // 先从本地缓存同步填（0s 首屏可见）
    var cached = checkin.getCached()
    if (cached && cached.streakDays) {
      that.setData({ streakDays: cached.streakDays })
    }
    // 再异步拉服务器最新（失败静默用缓存，不让 tople 隐藏）
    checkin.syncStatus().then(function (s) {
      that.setData({ streakDays: s.streakDays || 0 })
    })
  },

  // ====== 音效（懒加载 + 静默失败） ======
  _audioShuffle: null,
  _audioFlip: null,
  _initAudio: function () {
    var that = this
    try {
      // shuffle: 洗牌过程音
      this._audioShuffle = wx.createInnerAudioContext()
      this._audioShuffle.src = '/images/tarot-shuffle.wav'
      this._audioShuffle.loop = false
      this._audioShuffle.obeyMuteSwitch = true
      this._audioShuffle.onError(function () {
        console.warn('[tarot] shuffle 音效加载失败（占位文件可能未放）')
        that._audioShuffle = null
      })
      // flip: 翻牌短音
      this._audioFlip = wx.createInnerAudioContext()
      this._audioFlip.src = '/images/tarot-flip.wav'
      this._audioFlip.obeyMuteSwitch = true
      this._audioFlip.onError(function () {
        console.warn('[tarot] flip 音效加载失败')
        that._audioFlip = null
      })
    } catch (e) {
      console.warn('[tarot] 音频初始化异常：', e)
    }
  },
  _playShuffle: function () {
    if (this._audioShuffle) {
      try { this._audioShuffle.seek(0); this._audioShuffle.play() } catch (e) {}
    }
  },
  _playFlip: function () {
    if (this._audioFlip) {
      try { this._audioFlip.seek(0); this._audioFlip.play() } catch (e) {}
    }
  },
  onUnload: function () {
    if (this._audioShuffle) { try { this._audioShuffle.destroy() } catch (e) {} }
    if (this._audioFlip) { try { this._audioFlip.destroy() } catch (e) {} }
  },

  // ====== Tab 切换 ======
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab,
      reading: null,
      question: '',
      flipped: false,
      cardAnimIndex: -1,
      selectedMood: '',
      unlockPriceText: '9.90',
      unlockBtnText: '解锁完整解读 · ¥9.90'
    })
  },

  // ====== 心情选择（每日一抽） ======
  onSelectMood: function (e) {
    var code = e.currentTarget.dataset.code
    var mood = (this.data.moods.find(function (m) { return m.code === code }) || {}).label || ''
    this.setData({ selectedMood: code, question: mood })
  },

  // ====== 每日一抽：动作 ======
  onDrawDaily: function () {
    if (!this.data.selectedMood) {
      wx.showToast({ title: '先选一个心情', icon: 'none' })
      return
    }
    if (this.data.reading) {
      // 已抽过，不允许重复
      wx.showToast({ title: '今天已经抽过啦', icon: 'none' })
      return
    }
    var that = this
    this.setData({
      drawing: true,
      drawingTitle: '正在为你洗牌…',
      reading: null,
      flipped: false
    })
    this._playShuffle()

    // 把心情作为 question 传给后端（复用 question 字段，不改 DDL）
    var payload = { question: '心情：' + this.data.question }
    var that = this
    request.post(config.apiPaths.tarotDaily, payload, { quiet: true })
      .then(function (data) {
        // 记本地：今日已抽
        try {
          wx.setStorageSync(that._storageKey(), {
            date: that._todayKey(),
            readingId: data.readingId,
            reading: data
          })
        } catch (e) {}
        // 后端可能 1-3s 返回，期间给个动画感
        setTimeout(function () {
          that.applyReading(data, { drawing: false })
          that.setData({ drawingTitle: '' })
          // 翻牌：单张延迟 600ms
          setTimeout(function () {
            that.setData({ flipped: true })
            that._playFlip()
          }, 350)
        }, 600)
      })
      .catch(function (err) {
        console.warn('今日一抽接口失败，本地兜底：', err)
        // mock 不写本地缓存（避免误判"已抽过"）
        that.applyReading(FALLBACK_DAILY, { drawing: false })
        that.setData({ drawingTitle: '' })
        setTimeout(function () {
          that.setData({ flipped: true })
          that._playFlip()
        }, 350)
      })
  },

  // ====== 三牌阵 ======
  onQuestionInput: function (e) {
    this.setData({ question: e.detail.value })
  },

  onDrawThree: function () {
    var that = this
    this.setData({
      drawing: true,
      reading: null,
      flipped: false,
      cardAnimIndex: -1
    })
    this._playShuffle()

    var payload = this.data.question.trim() ? { question: this.data.question.trim() } : {}
    request.post(config.apiPaths.tarotThreeCards, payload, { quiet: true })
      .then(function (data) {
        that.applyReading(data, { drawing: false })
        that.flipCardsOneByOne(data.cards.length)
      })
      .catch(function (err) {
        console.warn('三牌阵接口失败，本地兜底：', err)
        that.applyReading(FALLBACK_THREE, { drawing: false })
        that.flipCardsOneByOne(3)
      })
  },

  // 翻牌动画：依次翻开每张
  flipCardsOneByOne: function (total) {
    var that = this
    var i = 0
    var interval = setInterval(function () {
      if (i >= total) {
        clearInterval(interval)
        that.setData({ flipped: true })
        that._playFlip()
        return
      }
      that.setData({ cardAnimIndex: i })
      that._playFlip()
      i++
    }, 350)
  },

  // ====== 解锁 ======
  onUnlock: function () {
    var that = this
    if (this.data.unlocking || !this.data.reading || this.data.reading.unlocked) return
    this.setData({ unlocking: true })

    request.post(config.apiPaths.tarotUnlock, {
      readingId: this.data.reading.readingId,
      orderId: 'MOCK-' + Date.now()
    }, { quiet: true })
      .then(function (data) {
        var merged = Object.assign({}, that.data.reading, data, { unlocked: true })
        that.applyReading(merged, { unlocking: false })
        wx.showToast({ title: '解读已解锁', icon: 'none' })
      })
      .catch(function (err) {
        console.warn('解锁接口失败，本地兜底：', err)
        var merged = Object.assign({}, that.data.reading, FALLBACK_FULL, { unlocked: true })
        that.applyReading(merged, { unlocking: false })
        wx.showToast({ title: '解读已解锁（本地）', icon: 'none' })
      })
  },

  // ====== 分享 ======
  onShare: function () {
    var r = this.data.reading
    if (!r || !r.cards || r.cards.length === 0) {
      return { title: '今夜树屋 · 塔罗盲盒', path: '/pages/tarot/tarot' }
    }
    var card = r.cards[0]
    return {
      title: '我抽到了「' + card.name + '」' + card.positionName + ' ✨',
      path: '/pages/tarot/tarot'
    }
  },
  onShareAppMessage: function () {
    return this.onShare()
  },

  // ====== 分享卡（canvas 海报） ======
  onShareTap: function () {
    var that = this
    if (!this.data.reading || !this.data.reading.cards || this.data.reading.cards.length === 0) {
      wx.showToast({ title: '还没抽牌', icon: 'none' })
      return
    }
    this.setData({ showShareCard: true })
    // 等 WXML 渲染 canvas 后再画
    setTimeout(function () {
      tarotShare.drawShareCard({
        canvasId: 'shareCanvas',
        reading: that.data.reading,
        activeTab: that.data.activeTab
      }).catch(function (err) {
        console.error('[tarot-share] 画卡失败：', err)
        wx.showToast({ title: '生成分享卡失败', icon: 'none' })
        that.setData({ showShareCard: false })
      })
    }, 100)
  },

  onSaveShareImage: function () {
    var that = this
    wx.showLoading({ title: '保存中…' })
    tarotShare.exportToAlbum('shareCanvas')
      .then(function () {
        wx.hideLoading()
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      })
      .catch(function (err) {
        wx.hideLoading()
        console.warn('[tarot-share] 保存失败：', err)
        wx.showToast({ title: '保存失败：' + (err && err.errMsg || '请授权相册'), icon: 'none' })
      })
  },

  onCloseShareCard: function () {
    this.setData({ showShareCard: false })
  },

  // ====== 历史 ======
  onOpenHistory: function () {
    this.setData({
      showHistory: true,
      historyList: [],
      historyPage: 0,
      historyHasMore: true
    })
    this._loadHistory()
  },

  onCloseHistory: function () {
    this.setData({ showHistory: false })
  },

  onLoadMoreHistory: function () {
    if (this.data.historyLoading || !this.data.historyHasMore) return
    this._loadHistory()
  },

  _loadHistory: function () {
    var that = this
    if (this.data.historyLoading) return
    this.setData({ historyLoading: true })
    var page = this.data.historyPage
    request.get(config.apiPaths.tarotHistory, { page: page, size: 20 }, { quiet: true })
      .then(function (list) {
        // request.js 已 unwrap R<T>，这里 list 就是 TarotHistoryItemVO[] 直接
        if (!Array.isArray(list)) list = []
        var merged = that.data.historyList.concat(list)
        that.setData({
          historyList: merged,
          historyLoading: false,
          historyPage: page + 1,
          historyHasMore: list.length >= 20
        })
      })
      .catch(function (err) {
        console.warn('[tarot] history 加载失败：', err)
        that.setData({ historyLoading: false })
      })
  },

  /**
   * 点击历史项 → 调 /tarot/daily 或调用 getById
   * MVP：只跳转 Tab + 提示（详情接口 v1.x 加 GET /tarot/{id}）
   */
  onViewHistoryItem: function (e) {
    var item = (e.currentTarget.dataset.item) || {}
    var that = this
    this.setData({ showHistory: false })
    wx.showModal({
      title: (item.spreadType === 'DAILY' ? '每日一抽' : '三牌阵') + ' · ' + (item.cardName || ''),
      content: (item.shortInterpretation || '') + '\n\n日期：' + (item.drawDate || '—'),
      confirmText: '复制短解读',
      cancelText: '知道了',
      success: function (r) {
        if (r.confirm && item.shortInterpretation) {
          wx.setClipboardData({ data: item.shortInterpretation })
        }
      }
    })
  },

  // 工具
  /**
   * 统一写 reading：同时算好 WXML 需要的价格文案
   * （WXML 不支持 {{formatPrice(x)}} 这类方法调用，会静默渲染为空）
   */
  applyReading: function (reading, extra) {
    var priceFen = (reading && reading.unlockPrice) || 990
    var priceText = this.formatPrice(priceFen)
    var patch = {
      reading: reading,
      unlockPriceText: priceText,
      unlockBtnText: '解锁完整解读 · ¥' + priceText
    }
    if (extra) Object.assign(patch, extra)
    this.setData(patch)
  },

  formatPrice: function (fen) {
    return (fen / 100).toFixed(1)
  }
})
