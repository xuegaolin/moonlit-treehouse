// pages/bottle/bottle.js — 漂流墙（模块 E）
// 接口：POST /bottle/publish, /bottle/warm; GET /bottle/feed
// 单页双 tab：信息流 / 投递
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')

// 情绪标签
const TAGS = ['emo', '失恋', '焦虑', '孤独', '治愈', '工作', '生活', 'emo深夜', '想要倾诉']

// 礼物档
const GIFTS = [
  { code: 'hug',    label: '抱抱',  cost: 0,  emoji: '🤗' },
  { code: 'candy',  label: '一颗糖', cost: 6,  emoji: '🍬' },
  { code: 'candle', label: '一盏烛', cost: 8,  emoji: '🕯' }
]

// mock 瓶子（接口失败兜底）
const FALLBACK_BOTTLES = [
  {
    bottleId: 'B-20260730-0001',
    content: '加班到 11 点，地铁末班车也没了。坐在公交站发呆，突然想哭。',
    tags: ['emo', '工作'],
    anonymousId: '路人-A7B3',
    warmCount: 28,
    isMine: false,
    warmed: false,
    timeHint: '2 小时前'
  },
  {
    bottleId: 'B-20260730-0002',
    content: '今年毕业，第一份工作找不到满意的。爸妈问起来真的不知道怎么回答。',
    tags: ['焦虑', '工作'],
    anonymousId: '路人-K9X2',
    warmCount: 64,
    isMine: false,
    warmed: false,
    timeHint: '5 小时前'
  },
  {
    bottleId: 'B-20260729-0003',
    content: '又梦到 TA 了。醒来发现自己一个人。',
    tags: ['emo', '失恋'],
    anonymousId: '路人-Q4M8',
    warmCount: 132,
    isMine: false,
    warmed: false,
    timeHint: '昨天'
  }
]

Page({
  data: {
    activeTab: 'feed',
    sort: 'latest',    // latest | hot
    feedList: [],
    loading: false,
    page: 0,
    hasMore: true,

    // 发布
    newContent: '',
    selectedTags: [],
    // 标签选项（带 active 标记）—— WXML 不支持 indexOf，必须预算
    tagOptions: TAGS.map(function (n) { return { name: n, active: false } }),

    // 当前被温暖的瓶子 id（弹窗）
    warmTarget: null,
    coinBalance: 0
  },

  onShow: function () {
    // 立即从本地缓存同步余额（0s 首屏可见）
    this.setData({ coinBalance: coin.getCached().balance })
    const that = this
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })
    if (this.data.activeTab === 'feed' && this.data.feedList.length === 0) {
      this.loadFeed(true)
    }
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'feed' && this.data.feedList.length === 0) {
      this.loadFeed(true)
    }
  },

  // ============ 信息流 ============
  loadFeed: function (reset) {
    const that = this
    this.setData({ loading: true })

    const page = reset ? 0 : this.data.page
    const params = { sort: this.data.sort, page: page, size: 20 }

    request.get(config.apiPaths.bottleFeed, params, { quiet: true })
      .then(function (data) {
        const list = (data && data.list) || []
        const merged = reset ? list : that.data.feedList.concat(list)
        that.setData({
          feedList: merged,
          loading: false,
          page: page + 1,
          hasMore: list.length >= 20
        })
      })
      .catch(function (err) {
        console.warn('信息流拉取失败，本地兜底：', err)
        that.setData({
          feedList: reset ? FALLBACK_BOTTLES : that.data.feedList.concat(FALLBACK_BOTTLES),
          loading: false,
          hasMore: false
        })
      })
  },

  onPullRefresh: function () {
    this.setData({ page: 0, hasMore: true })
    this.loadFeed(true)
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadFeed(false)
    }
  },

  onSwitchSort: function (e) {
    const sort = e.currentTarget.dataset.sort
    if (sort === this.data.sort) return
    this.setData({ sort: sort, page: 0, hasMore: true })
    this.loadFeed(true)
  },

  // ============ 温暖 ============
  onWarm: function (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return

    // 双保险：WXML 已按 isMine/warmed 禁用按钮，这里再挡一层
    // （老数据没有这两个字段时仍走后端校验）
    const target = this.data.feedList.filter(function (b) { return b.bottleId === id })[0]
    if (target && target.isMine) {
      wx.showToast({ title: '这是你自己的心事哦', icon: 'none' })
      return
    }
    if (target && target.warmed) {
      wx.showToast({ title: '你已经温暖过这个瓶子啦', icon: 'none' })
      return
    }

    this.setData({ warmTarget: id })
  },

  closeWarm: function () {
    this.setData({ warmTarget: null })
  },

  onChooseGift: function (e) {
    const that = this
    const giftCode = e.currentTarget.dataset.gift
    const gift = GIFTS.find(function (g) { return g.code === giftCode })
    if (!gift) return

    // 余额校验
    if (that.data.coinBalance < gift.cost) {
      wx.showToast({ title: '月光币不足，去"我的"领证书', icon: 'none' })
      return
    }

    request.post(config.apiPaths.bottleWarm, {
      bottleId: that.data.warmTarget,
      giftType: giftCode,
      coinCost: gift.cost
    }, { quiet: true })
      .then(function (data) {
        // 乐观更新：+1 + 扣币
        const list = that.data.feedList.map(function (b) {
          if (b.bottleId === that.data.warmTarget) {
            b.warmCount = data.warmedTotal || (b.warmCount + 1)
            b.warmed = true   // 立即切成"已温暖 ✓"，不必等下次 feed
          }
          return b
        })
        that.setData({
          feedList: list,
          warmTarget: null,
          coinBalance: that.data.coinBalance - gift.cost
        })
        coin.addLocal(-gift.cost)
        wx.showToast({ title: gift.emoji + ' 温暖已送达', icon: 'none' })
      })
      .catch(function (err) {
        // 关键区分：业务拒绝 vs 网络失败
        //   业务拒绝（不能温暖自己 / 已温暖过 / 余额不足）→ 必须如实提示，
        //     绝不能本地 +1，否则刷新后被真实数据覆盖回去，用户以为功能坏了
        //   网络失败（err.offline，后端没起）→ 才做本地乐观更新
        if (!err || !err.offline) {
          console.warn('[bottle] 温暖被拒绝：', err && err.message)
          that.setData({ warmTarget: null })
          wx.showToast({
            title: (err && err.message) || '温暖失败',
            icon: 'none',
            duration: 2000
          })
          return
        }

        // 仅离线场景做本地乐观更新
        console.warn('[bottle] 网络不可用，本地乐观 +1：', err && err.message)
        const list = that.data.feedList.map(function (b) {
          if (b.bottleId === that.data.warmTarget) b.warmCount = (b.warmCount || 0) + 1
          return b
        })
        that.setData({
          feedList: list,
          warmTarget: null,
          coinBalance: that.data.coinBalance - gift.cost
        })
        coin.addLocal(-gift.cost)
        wx.showToast({ title: gift.emoji + ' 已温暖（离线，稍后同步）', icon: 'none' })
      })
  },

  // ============ 发布 ============
  onNewContentInput: function (e) {
    this.setData({ newContent: e.detail.value })
  },

  onToggleTag: function (e) {
    const tag = e.currentTarget.dataset.tag
    const cur = this.data.selectedTags.slice()
    const idx = cur.indexOf(tag)
    if (idx > -1) {
      cur.splice(idx, 1)
    } else {
      if (cur.length >= 3) {
        wx.showToast({ title: '最多选 3 个标签', icon: 'none' })
        return
      }
      cur.push(tag)
    }
    this.setData({ selectedTags: cur, tagOptions: this.buildTagOptions(cur) })
  },

  /**
   * 标签选项 → 带 active 标记的对象数组
   * WXML 不支持 selectedTags.indexOf(item)，必须在 JS 里算好
   */
  buildTagOptions: function (selected) {
    var sel = selected || []
    return TAGS.map(function (name) {
      return { name: name, active: sel.indexOf(name) > -1 }
    })
  },

  onSubmit: function () {
    const that = this
    const content = this.data.newContent.trim()
    if (!content) {
      wx.showToast({ title: '心事不能是空的', icon: 'none' })
      return
    }

    request.post(config.apiPaths.bottlePublish, {
      content: content,
      tags: this.data.selectedTags
    }, { quiet: true })
      .then(function (bottle) {
        wx.showToast({ title: '瓶子已漂流 🌊', icon: 'none' })
        that.setData({ newContent: '', selectedTags: [], tagOptions: that.buildTagOptions([]) })
        // 切回信息流并刷新
        that.setData({ activeTab: 'feed', feedList: [], page: 0 })
        that.loadFeed(true)
      })
      .catch(function (err) {
        console.warn('发布接口失败，本地演示：', err)
        const mock = {
          bottleId: 'B-LOCAL-' + Date.now(),
          content: content,
          tags: that.data.selectedTags,
          anonymousId: '路人-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          warmCount: 0,
          timeHint: '刚刚'
        }
        that.setData({
          feedList: [mock].concat(that.data.feedList),
          newContent: '',
          selectedTags: [],
          tagOptions: that.buildTagOptions([]),
          activeTab: 'feed'
        })
        wx.showToast({ title: '已漂流（本地）', icon: 'none' })
      })
  },

  onShareAppMessage: function () {
    return { title: '来看看深夜的心事 💌', path: '/pages/bottle/bottle' }
  }
})
