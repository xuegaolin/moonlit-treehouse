// pages/home/home.js — 树屋首页：签到 + 5 模块入口 + 月光币
const coin = require('../../utils/coin.js')
const checkin = require('../../utils/checkin.js')
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')

Page({
  data: {
    greeting: '晚上好',
    coinBalance: 0,
    checkedToday: false,
    streakDays: 0,
    todayReward: 3,
    calendar: [],
    checkinLoading: false,
    showCheckinResult: false,
    checkinResult: null,
    // 权限相关
    canUseChat: false,
    chatEnabled: false,
    friendEnabled: false,
    modules: [
      {
        icon: '🪑',
        title: '摆烂许可证',
        desc: '今天，你有权利什么都不做',
        path: '/pages/bailan/bailan',
        ready: true
      },
      {
        icon: '📮',
        title: '深夜信箱',
        desc: '给未来的自己写一封信，AI 帮你回信',
        path: '/pages/letter/letter',
        ready: true
      },
      {
        icon: '🔮',
        title: '塔罗盲盒',
        desc: '今天的运势，藏在牌背后',
        path: '/pages/tarot/tarot',
        ready: true
      },
      {
        icon: '🕯',
        title: '许愿池',
        desc: '敲一下木鱼，功德 +1',
        path: '/pages/wish/wish',
        ready: true
      },
      {
        icon: '💌',
        title: '漂流墙',
        desc: '看看别人的深夜心事',
        path: '/pages/bottle/bottle',
        ready: true
      }
    ]
  },

  onLoad: function () {
    this.setData({ greeting: this.buildGreeting() })
    var cs = checkin.getCached()
    this.setData({
      checkedToday: cs.checkedToday,
      streakDays: cs.streakDays,
      todayReward: cs.todayReward,
      calendar: checkin.buildCalendar(cs.recentDates, 7)
    })
  },

  onShow: function () {
    this.setData({
      coinBalance: coin.getCached().balance,
      avatar: wx.getStorageSync('avatar') || ''
    })
    const that = this
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })
    this.refreshCheckin()
    this.refreshPrivacy()
  },

  // 刷新隐私状态（判断是否可以使用聊天）
  refreshPrivacy: function () {
    const that = this
    request.get(config.apiPaths.userPrivacy, {}, { quiet: true })
      .then(function (data) {
        var canChat = data.isMember && data.realNameVerified
        that.setData({
          canUseChat: canChat,
          chatEnabled: data.chatEnabled,
          friendEnabled: data.friendEnabled
        })
      })
      .catch(function (err) {
        console.warn('[home] 刷新隐私状态失败:', err)
      })
  },

  refreshCheckin: function () {
    const that = this
    var cs = checkin.getCached()
    that.setData({
      checkedToday: cs.checkedToday,
      streakDays: cs.streakDays,
      todayReward: cs.todayReward,
      calendar: checkin.buildCalendar(cs.recentDates, 7)
    })
    checkin.syncStatus().then(function (s) {
      that.setData({
        checkedToday: s.checkedToday,
        streakDays: s.streakDays,
        todayReward: s.todayReward,
        calendar: checkin.buildCalendar(s.recentDates, 7)
      })
    })
  },

  onTapCheckin: function () {
    if (this.data.checkedToday || this.data.checkinLoading) {
      return
    }
    const that = this
    this.setData({ checkinLoading: true })
    checkin
      .doCheckin()
      .then(function (data) {
        that.setData({
          checkinLoading: false,
          checkedToday: true,
          streakDays: (data && data.streakDays) || 1,
          coinBalance: coin.getCached().balance,
          checkinResult: data,
          showCheckinResult: true
        })
        that.refreshCheckin()
        wx.vibrateShort({ type: 'light' })
      })
      .catch(function (err) {
        that.setData({ checkinLoading: false })
        const msg = (err && (err.message || err.errMsg)) || '签到失败，稍后再试'
        if (msg.indexOf('已经签到') >= 0) {
          that.setData({ checkedToday: true })
        }
        wx.showToast({ title: msg, icon: 'none' })
      })
  },

  onCloseCheckinResult: function () {
    this.setData({ showCheckinResult: false })
  },

  noop: function () { },

  // 跳转到消息列表
  goChatList: function () {
    if (!this.data.canUseChat) {
      wx.showModal({
        title: '需要会员 + 实名',
        content: '社交功能仅对已完成实名认证的会员开放',
        confirmText: '去开通',
        cancelText: '再想想',
        success: function (res) {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' })
          }
        }
      })
      return
    }
    wx.navigateTo({ url: '/pages/chat-list/chat-list' })
  },

  // 跳转到好友列表
  goFriendList: function () {
    if (!this.data.canUseChat) {
      wx.showModal({
        title: '需要会员 + 实名',
        content: '社交功能仅对已完成实名认证的会员开放',
        confirmText: '去开通',
        cancelText: '再想想',
        success: function (res) {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' })
          }
        }
      })
      return
    }
    wx.navigateTo({ url: '/pages/chat-friends/chat-friends' })
  },

  buildGreeting: function () {
    const hour = new Date().getHours()
    if (hour >= 22 || hour < 2) return '夜深了，来树屋躲一躲'
    if (hour >= 2 && hour < 6) return '这么晚还没睡呀'
    if (hour >= 6 && hour < 12) return '早上好，今晚见'
    if (hour >= 12 && hour < 18) return '下午好，攒点情绪晚上聊'
    return '晚上好，欢迎回到树屋'
  },

  onShareAppMessage: function () {
    return {
      title: '白天在人间打拼，晚上来树屋躲一躲 🌙',
      path: '/pages/home/home'
    }
  }
})
