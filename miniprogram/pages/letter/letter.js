// pages/letter/letter.js — 深夜信箱（模块 A）
// 单页双 tab：写信 + 我的信箱
// 接口：POST /letter/create, GET /letter/mine
// 后端未连通时自动降级为本地 mock，保证页面可演示
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')
const subscribe = require('../../utils/subscribe.js')

// 收信人选项（与 API 规范 receiverType 枚举对齐）
const RECEIVER_OPTIONS = [
  { code: 'self_future', label: '未来的我', desc: '给未来的自己写信' },
  { code: 'self_now',    label: '现在的我',  desc: '立即送达，像写日记' },
  { code: 'missed_one',  label: '错过的人',  desc: '给那个没在一起的人' },
  { code: 'stranger',    label: '陌生人',    desc: '写给树屋里的另一个' }
]

// AI 人设
const AI_PERSONAS = [
  { code: 'SISTER', label: '温柔姐姐' },
  { code: 'BESTIE', label: '毒舌闺蜜' },
  { code: 'PROF',   label: '心理咨询师' },
  { code: 'BUDDHA', label: '佛系开导' },
  { code: 'STAR',   label: '偶像鼓励' }
]

// 信封样式
const ENVELOPES = [
  { code: 'default', label: '默认', emoji: '✉️' },
  { code: 'kraft',   label: '牛皮纸', emoji: '📜' },
  { code: 'sakura',  label: '樱花粉', emoji: '🌸' }
]

// 状态 → 文案 / 样式类（WXML 不能调 .toLowerCase()，必须在 JS 预算）
const LETTER_STATUS_MAP = {
  PENDING:   { text: '待送',   cls: 'status-pending' },
  DELIVERED: { text: '已送达', cls: 'status-delivered' },
  REPLIED:   { text: '已回信', cls: 'status-replied' },
  CANCELLED: { text: '已撕回', cls: 'status-cancelled' }
}

// 本地 mock 信箱（接口失败时兜底）
function buildMockLetters() {
  const now = Date.now()
  return [
    {
      letterId: 'L-20260728-0001',
      status: 'DELIVERED',
      receiverType: 'self_future',
      deliverAt: now - 86400000 * 2,
      hasReply: true,
      envelopeCode: 'sakura',
      summary: '其实我也不知道想写什么，就是想跟未来的你说一声：我还在坚持。',
      createdAt: now - 86400000 * 10
    },
    {
      letterId: 'L-20260720-0001',
      status: 'PENDING',
      receiverType: 'missed_one',
      deliverAt: now + 86400000 * 30,
      hasReply: false,
      envelopeCode: 'kraft',
      summary: '如果你看到这封信，我已经决定放下了。',
      createdAt: now - 86400000 * 11
    }
  ]
}

Page({
  data: {
    // tab 切换
    activeTab: 'write',   // 'write' | 'inbox'

    // 写信表单
    receivers: RECEIVER_OPTIONS,
    selectedReceiver: 'self_future',

    envelopes: ENVELOPES,
    selectedEnvelope: 'default',

    content: '',
    contentMax: 1000,

    deliverAt: null,        // 选中的送达时间戳
    deliverAtText: '',      // 友好展示
    deliverPresets: [       // 预设时间
      { label: '明天 22:00', hours: null },
      { label: '一周后',    hours: null },
      { label: '一个月后',  hours: null },
      { label: '一年后',    hours: null }
    ],

    // AI 回信
    aiEnabled: false,
    aiPersonas: AI_PERSONAS,
    selectedPersona: 'SISTER',

    submitting: false,
    coinBalance: 0,

    // 信箱列表
    letters: [],
    statusFilter: 'ALL',  // ALL | PENDING | DELIVERED
    loading: false,

    // 订阅消息（banner）
    subscribedCount: 0,     // 已授权待投递的信件数
    showSubscribeBanner: false
  },

  onLoad: function () {
    this.initPresets()
  },

  onShow: function () {
    // 立即从本地缓存同步余额（0s 首屏可见）
    this.setData({ coinBalance: coin.getCached().balance })
    const that = this
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })
    if (this.data.activeTab === 'inbox') {
      this.loadLetters()
    }
  },

  // 初始化预设时间
  initPresets: function () {
    const now = new Date()
    const presets = [
      { label: '明天 22:00',     ts: this.futureTime(now, 1, 22) },
      { label: '一周后今天',     ts: this.futureTime(now, 7, 22) },
      { label: '一个月后今天',   ts: this.futureTime(now, 30, 22) },
      { label: '一年后今天',     ts: this.futureTime(now, 365, 22) }
    ]
    this.setData({ deliverPresets: presets.map(function (p) {
      return { label: p.label, hours: p.ts }
    }) })
  },

  futureTime: function (base, addDays, hour) {
    const d = new Date(base.getTime() + addDays * 86400000)
    d.setHours(hour, 0, 0, 0)
    return d.getTime()
  },

  // ===== Tab 切换 =====
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'inbox') {
      this.loadLetters()
    }
  },

  // ===== 表单操作 =====
  onSelectReceiver: function (e) {
    this.setData({ selectedReceiver: e.currentTarget.dataset.code })
  },

  onSelectEnvelope: function (e) {
    this.setData({ selectedEnvelope: e.currentTarget.dataset.code })
  },

  onContentInput: function (e) {
    this.setData({ content: e.detail.value })
  },

  onSelectDeliver: function (e) {
    const ts = parseInt(e.currentTarget.dataset.ts, 10)
    this.setData({
      deliverAt: ts,
      deliverAtText: this.formatDate(ts)
    })
  },

  // 自定义时间（用 wx picker 选日期+时间）
  onPickCustomDeliver: function () {
    const that = this
    wx.showActionSheet({
      itemList: ['选日期', '选时间'],
      success: function (res) {
        if (res.tapIndex === 0) {
          that.pickDate()
        } else {
          that.pickTime()
        }
      }
    })
  },

  pickDate: function () {
    const that = this
    const now = new Date()
    wx.showActionSheet({
      itemList: ['明天', '一周后', '一个月后', '一年后'],
      success: function (res) {
        const days = [1, 7, 30, 365][res.tapIndex]
        const ts = that.futureTime(now, days, 22)
        that.setData({ deliverAt: ts, deliverAtText: that.formatDate(ts) })
      }
    })
  },

  pickTime: function () {
    const that = this
    const cur = this.data.deliverAt || (Date.now() + 86400000)
    const d = new Date(cur)
    const hours = ['20:00', '22:00', '00:00', '02:00']
    wx.showActionSheet({
      itemList: hours,
      success: function (res) {
        const [h, m] = hours[res.tapIndex].split(':').map(function (x) { return parseInt(x, 10) })
        d.setHours(h, m, 0, 0)
        const ts = d.getTime()
        // 不能选过去
        if (ts < Date.now() + 5 * 60 * 1000) {
          wx.showToast({ title: '请选 5 分钟之后', icon: 'none' })
          return
        }
        that.setData({ deliverAt: ts, deliverAtText: that.formatDate(ts) })
      }
    })
  },

  onToggleAI: function (e) {
    this.setData({ aiEnabled: e.detail.value })
  },

  onSelectPersona: function (e) {
    this.setData({ selectedPersona: e.currentTarget.dataset.code })
  },

  formatDate: function (ts) {
    if (!ts) return '请选择送达时间'
    const d = new Date(ts)
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
  },

  // ===== 提交 =====
  onSubmit: function () {
    const that = this
    if (this.data.submitting) return

    // 校验
    if (!this.data.content.trim()) {
      wx.showToast({ title: '信不能是空的', icon: 'none' })
      return
    }
    if (this.data.content.length > this.data.contentMax) {
      wx.showToast({ title: '正文最多 ' + this.data.contentMax + ' 字', icon: 'none' })
      return
    }
    if (this.data.selectedReceiver !== 'self_now' && !this.data.deliverAt) {
      wx.showToast({ title: '请选择送达时间', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    const payload = {
      receiverType: this.data.selectedReceiver,
      deliverAt: this.data.deliverAt || Date.now(),
      content: this.data.content.trim(),
      envelopeCode: this.data.selectedEnvelope,
      aiEnabled: this.data.aiEnabled,
      aiPersona: this.data.aiEnabled ? this.data.selectedPersona : null,
      publicToWall: false
    }

    request.post(config.apiPaths.letterCreate, payload, { quiet: true })
      .then(function (letter) {
        that.onSubmitted(letter, false)
      })
      .catch(function (err) {
        console.warn('写信接口失败，本地演示：', err)
        const mock = {
          letterId: 'L-' + that.formatDateShort() + '-' + String(Math.floor(Math.random() * 9999 + 1)).padStart(4, '0'),
          status: payload.receiverType === 'self_now' ? 'DELIVERED' : 'PENDING',
          receiverType: payload.receiverType,
          deliverAt: payload.deliverAt,
          hasReply: false,
          envelopeCode: payload.envelopeCode,
          summary: payload.content.substring(0, 60),
          createdAt: Date.now()
        }
        that.onSubmitted(mock, true)
      })
      .finally(function () {
        that.setData({ submitting: false })
      })
  },

  onSubmitted: function (letter, isMock) {
    const that = this
    // 重置表单
    this.setData({
      content: '',
      deliverAt: null,
      deliverAtText: '',
      aiEnabled: false
    })
    wx.showToast({
      title: isMock ? '信已封存（本地演示）' : '信已封存，等待送达 🌙',
      icon: 'none'
    })
    // 写完信后弹订阅授权（仅 PENDING 且非本地演示）—— 失败不阻断
    if (!isMock && letter && letter.status === 'PENDING' && letter.letterId) {
      that.tryAskSubscribe(letter.letterId)
    }
    // 跳到信箱 tab
    setTimeout(function () {
      that.setData({ activeTab: 'inbox' })
      that.loadLetters()
    }, 600)
  },

  /**
   * 写完信后弹订阅授权（仅 PENDING 信）。
   * 1 年后送达：push_token 30 天过期，后端会标 EXPIRED，这里是 forwaarning。
   */
  tryAskSubscribe: function (letterId) {
    const that = this
    // 动态取 template_id（dev 场景下后端返回空，走 NO_TEMPLATE 静默）
    // 简化：暂时写死一个 dev 默认，以后有真 template_id 改成读 /letter/admin 或环境变量
    var templateId = '' // dev 场景：暂为空，requestSubscribe 会静默走 NO_TEMPLATE
    if (that.data.deliverAt && (that.data.deliverAt - Date.now()) > 30 * 86400000) {
      // > 30 天的信 -> 先提示 30 天有效期
      wx.showModal({
        title: '到了能通知你吗？',
        content: '订阅消息有效期 30 天。这封信 N+ 天后才会到，到时可能无法推送。',
        confirmText: '试试授权',
        success: function (r) {
          if (r.confirm) {
            subscribe.requestSubscribe(letterId, templateId).then(function (res) {
              var t = subscribe.buildResultToast(res)
              if (t.toast) wx.showToast({ title: t.toast, icon: 'none' })
              that.loadLetters()
            })
          }
        }
      })
      return
    }
    // <= 30 天：直接静默试授权，不弹中间提示
    subscribe.requestSubscribe(letterId, templateId).then(function (res) {
      var t = subscribe.buildResultToast(res)
      if (t.toast) wx.showToast({ title: t.toast, icon: 'none' })
      that.loadLetters()
    })
  },

  formatDateShort: function () {
    const d = new Date()
    return '' + d.getFullYear() +
      ('0' + (d.getMonth() + 1)).slice(-2) +
      ('0' + d.getDate()).slice(-2)
  },

  // ===== 信箱列表 =====
  /** 给列表补上 WXML 需要的展示字段（WXML 不支持 .toLowerCase() / 方法调用） */
  decorateLetters: function (list) {
    var that = this
    return (list || []).map(function (it) {
      var st = LETTER_STATUS_MAP[it.status] || LETTER_STATUS_MAP.PENDING
      it.statusText = st.text
      it.statusClass = st.cls
      it.deliverAtText = that.formatDate(it.deliverAt)
      return it
    })
  },

  loadLetters: function () {
    const that = this
    this.setData({ loading: true })

    const status = this.data.statusFilter === 'ALL' ? '' : this.data.statusFilter
    request.get(config.apiPaths.letterMine, {
      status: status,
      page: 0,
      size: 50
    }, { quiet: true })
      .then(function (data) {
        that.setData({
          letters: that.decorateLetters(data.list || []),
          loading: false
        })
        that.refreshSubscribeBanner()
      })
      .catch(function (err) {
        console.warn('[letter] 信箱拉取失败，本地兜底：', err && (err.errMsg || err.message))
        that.setData({ letters: that.decorateLetters(buildMockLetters()), loading: false })
      })
  },

  /**
   * 顶 banner：统计 “待投 + 已订阅通知” 的信件数。
   * 异步静默：调 subscribe.getSubscribeStatus 各查（限制 5 条最新 PENDING），
   * 不存在则 banner 隐藏。
   */
  refreshSubscribeBanner: function () {
    const that = this
    var pending = (this.data.letters || []).filter(function (l) { return l.status === 'PENDING' })
    if (pending.length === 0) {
      that.setData({ subscribedCount: 0, showSubscribeBanner: false })
      return
    }
    // 只查前 5 条（限制接口调用）
    var top5 = pending.slice(0, 5)
    Promise.all(top5.map(function (l) {
      return subscribe.getSubscribeStatus(l.letterId)
    })).then(function (results) {
      var n = 0
      for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].subscribed && results[i].status === 'PENDING') n++
      }
      that.setData({ subscribedCount: n, showSubscribeBanner: n > 0 })
    }).catch(function () {
      // 静默，不影响主列表
      that.setData({ subscribedCount: 0, showSubscribeBanner: false })
    })
  },

  onFilter: function (e) {
    const f = e.currentTarget.dataset.filter
    this.setData({ statusFilter: f })
    this.loadLetters()
  },

  // 点击信件 → 详情
  onOpenLetter: function (e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/letter-detail/letter-detail?id=' + id })
  },

  // 长按撤回
  onLongPressLetter: function (e) {
    const that = this
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    if (status !== 'PENDING') return

    wx.showActionSheet({
      itemList: ['撤回这封信'],
      success: function (res) {
        if (res.tapIndex === 0) {
          that.cancelLetter(id)
        }
      }
    })
  },

  cancelLetter: function (letterId) {
    const that = this
    request.post(config.apiPaths.letterCancel + '?letterId=' + letterId, {}, { quiet: true })
      .then(function () {
        wx.showToast({ title: '已撤回', icon: 'none' })
        that.loadLetters()
      })
      .catch(function () {
        // 本地也允许撤回
        const list = that.data.letters.map(function (l) {
          if (l.letterId === letterId) l.status = 'CANCELED'
          return l
        })
        that.setData({ letters: list })
        wx.showToast({ title: '已撤回（本地）', icon: 'none' })
      })
  },

  onShareAppMessage: function () {
    return { title: '给未来的自己写封信 📮', path: '/pages/letter/letter' }
  }
})
