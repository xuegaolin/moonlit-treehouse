// pages/letter-detail/letter-detail.js — 深夜信箱 · 信件详情
// 路径参数：?id=L-yyyyMMdd-NNNN
//
// WXML 关键约束（原版踩过的坑）：
//   1. 条件指令只有 wx:if / wx:elif / wx:else，没有 wx:else-if（写了直接编译报错）
//   2. 插值里不能调方法：{{formatFullDate(x)}} / {{x.toLowerCase()}} 都无效
//      → 所有展示文案必须在 JS 里算好塞进 data
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')

// 状态 → 文案 / 样式类
var STATUS_MAP = {
  PENDING: { text: '待送达', cls: 'status-pending' },
  DELIVERED: { text: '已送达', cls: 'status-delivered' },
  REPLIED: { text: '已回信', cls: 'status-replied' },
  CANCELLED: { text: '已撤回', cls: 'status-cancelled' }
}

// AI 人格 → 文案
var PERSONA_MAP = {
  SISTER: '温柔姐姐',
  BESTIE: '毒舌闺蜜',
  PROF: '心理咨询师',
  BUDDHA: '佛系开导',
  IDOL: '偶像鼓励'
}

Page({
  data: {
    letterId: '',
    detail: null,
    loading: true,

    // ↓↓ WXML 只读这些预计算字段，不做任何方法调用
    statusText: '',
    statusClass: '',
    deliverAtText: '',
    deliveredAtText: '',
    personaText: '',
    showReply: false,

    // 信封 emoji 映射（对象取值 WXML 支持）
    envelopeEmoji: {
      default: '✉️',
      kraft: '📜',
      sakura: '🌸'
    }
  },

  onLoad: function (options) {
    var id = options && options.id
    if (!id) {
      // 没带参数：不再强制退出，展示"找不到"态，避免 toast + navigateBack 竞态
      this.setData({ loading: false, detail: null })
      return
    }
    this.setData({ letterId: id })
    this.loadDetail(id)
  },

  loadDetail: function (letterId) {
    var that = this
    request
      .get(config.apiPaths.letterDetail, { letterId: letterId }, { quiet: true })
      .then(function (data) {
        that.applyDetail(data)
      })
      .catch(function (err) {
        console.warn('[letter-detail] 详情拉取失败，本地兜底：', err && (err.errMsg || err.message))
        that.applyDetail(that.buildMockDetail(letterId))
      })
  },

  /** 统一入口：写 detail 的同时算好所有展示字段 */
  applyDetail: function (detail) {
    if (!detail) {
      this.setData({ detail: null, loading: false })
      return
    }

    var st = STATUS_MAP[detail.status] || { text: '未知', cls: 'status-pending' }
    var hasReply =
      !!detail.aiReply &&
      (detail.status === 'DELIVERED' || detail.status === 'REPLIED')

    this.setData({
      detail: detail,
      loading: false,
      statusText: st.text,
      statusClass: st.cls,
      deliverAtText: this.formatFullDate(detail.deliverAt),
      deliveredAtText: this.formatFullDate(detail.deliveredAt),
      personaText: PERSONA_MAP[detail.aiPersona] || '',
      showReply: hasReply
    })
  },

  buildMockDetail: function (letterId) {
    var isPending = letterId.indexOf('L-20260720') === 0
    return {
      letterId: letterId,
      status: isPending ? 'PENDING' : 'DELIVERED',
      receiverType: isPending ? 'missed_one' : 'self_future',
      content: isPending
        ? '如果你看到这封信，我已经决定放下了。\n\n其实没有什么特别想说的，就是想把这件事好好告别一次。\n\n希望未来的我能好好生活。'
        : '其实我也不知道想写什么，就是想跟未来的你说一声：我还在坚持。\n\n这十几天发生了很多事，有好的也有不好的。但我没放弃。\n\n未来的我，你好吗？',
      envelopeCode: isPending ? 'kraft' : 'sakura',
      aiPersona: isPending ? null : 'SISTER',
      aiReply: isPending
        ? null
        : '亲爱的你：\n\n看到这封信的时候我笑了——你居然真的撑下来了。\n\n这十几天你一定很辛苦吧，没关系，我都看到了。\n\n现在的你，已经比写信那天更勇敢了。\n\n继续走，别回头。',
      deliverAt: isPending ? Date.now() + 86400000 * 30 : Date.now() - 86400000 * 2,
      deliveredAt: isPending ? null : Date.now() - 86400000 * 2,
      canShare: !isPending,
      deliverHint: isPending ? '29 天后送达' : '已送达'
    }
  },

  // 立即投递（仅 PENDING 状态可点）
  onDeliverNow: function () {
    var that = this
    if (!this.data.detail || this.data.detail.status !== 'PENDING') return

    wx.showModal({
      title: '现在就想看？',
      content: '这封信会立刻送达，但意味着不会再等到原计划的时间。确定吗？',
      confirmText: '立即送达',
      success: function (res) {
        if (res.confirm) that.doDeliverNow()
      }
    })
  },

  doDeliverNow: function () {
    var that = this
    var id = this.data.letterId

    request
      .post(config.apiPaths.letterDeliverNow + '?letterId=' + id, {}, { quiet: true })
      .then(function (data) {
        wx.showToast({ title: '已送达', icon: 'none' })
        that.applyDetail(data)
      })
      .catch(function (err) {
        console.warn('[letter-detail] 立即投递失败，本地兜底：', err && (err.errMsg || err.message))
        var d = Object.assign({}, that.data.detail, {
          status: 'DELIVERED',
          deliveredAt: Date.now(),
          deliverHint: '已送达',
          canShare: true
        })
        that.applyDetail(d)
        wx.showToast({ title: '已送达（本地）', icon: 'none' })
      })
  },

  // 分享到漂流墙
  onShareToWall: function () {
    if (!this.data.detail || !this.data.detail.canShare) {
      wx.showToast({ title: '此信未启用公开', icon: 'none' })
      return
    }
    wx.showToast({ title: '分享到漂流墙开发中', icon: 'none' })
    // TODO(v1.x): 调 /bottle/publish 把这封信内容（脱敏）发到漂流墙
  },

  // 撤回
  onCancel: function () {
    var that = this
    if (!this.data.detail || this.data.detail.status !== 'PENDING') return

    wx.showModal({
      title: '撤回这封信？',
      content: '撤回后信会消失，不再送达。',
      confirmText: '撤回',
      confirmColor: '#FF6B81',
      success: function (res) {
        if (!res.confirm) return
        request
          .post(config.apiPaths.letterCancel + '?letterId=' + that.data.letterId, {}, { quiet: true })
          .then(function () {
            wx.showToast({ title: '已撤回', icon: 'none' })
            setTimeout(function () { wx.navigateBack() }, 800)
          })
          .catch(function () {
            wx.showToast({ title: '已撤回（本地）', icon: 'none' })
            setTimeout(function () { wx.navigateBack() }, 800)
          })
      }
    })
  },

  // 保存到图片（用 canvas 合成信件图）
  onSaveImage: function () {
    wx.showToast({ title: '保存图片开发中', icon: 'none' })
  },

  onBack: function () {
    var pages = getCurrentPages()
    if (pages && pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/home/home' })
    }
  },

  /** 时间戳 → 2026年8月1日 22:00（供 JS 内部调用，WXML 不可直接调） */
  formatFullDate: function (ts) {
    if (!ts) return ''
    var d = new Date(ts)
    return (
      d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
    )
  },

  onShareAppMessage: function () {
    var d = this.data.detail
    if (!d) return { title: '深夜信箱', path: '/pages/letter/letter' }
    return {
      title: '我收到了一封 ' + d.deliverHint + ' 的信 ✉️',
      path: '/pages/letter/letter'
    }
  }
})
