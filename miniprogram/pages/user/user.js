// pages/user/user.js — 我的：资料 / 月光币 / 会员入口 / 我的证书
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const coin = require('../../utils/coin.js')
const upload = require('../../utils/upload.js')

Page({
  data: {
    openid: '',
    openidShort: '未登录',   // WXML 不能调 substring，在 JS 预算
    nickname: '',
    avatar: '',
    wallet: { balance: 0, todayEarned: 0, todayLimit: 100 },
    memberExpireAt: null,
    // 会员套餐（接口拉取失败时的兜底静态档，与后端 MembershipService 一致）
    plans: [
      { code: 'MONTH', price: 19, days: 30, label: '月卡', daysText: '30 天' },
      { code: 'YEAR', price: 128, days: 365, label: '年卡', daysText: '365 天', recommend: true },
      { code: 'LIFE', price: 388, days: 999999, label: '永久卡', daysText: '永久有效' }
    ]
  },

  onShow: function () {
    // 立即从本地缓存同步钱包 + 资料（0s 首屏可见，不等网络）
    var localOpenid = auth.getOpenid() || ''
    this.setData({
      wallet: coin.getCached(),
      openid: localOpenid,
      openidShort: this.shortenOpenid(localOpenid),
      nickname: wx.getStorageSync('nickname') || '树屋夜行者',
      avatar: wx.getStorageSync('avatar') || ''
    })
    this.loadProfile()
    this.loadPlans()
  },

  /** openid 截短展示（WXML 不支持方法调用，必须在这里算） */
  shortenOpenid: function (openid) {
    if (!openid) return '未登录'
    return openid.length > 12 ? openid.substring(0, 12) + '…' : openid
  },

  // 加载用户资料（GET /user/profile）
  loadProfile: function () {
    const that = this
    var localAvatar = wx.getStorageSync('avatar') || ''
    var localNickname = wx.getStorageSync('nickname') || ''

    request.get(config.apiPaths.userProfile, {}, { quiet: true })
      .then(function (data) {
        that.setData({
          openid: data.openid || '',
          openidShort: that.shortenOpenid(data.openid),
          nickname: localNickname || data.nickname || '树屋夜行者',
          avatar: localAvatar || data.avatar || '',
          memberExpireAt: data.memberExpireAt
        })
      })
      .catch(function (err) {
        console.warn('[user] 资料拉取失败，展示本地缓存：', err && (err.errMsg || err.message))
        var oid = auth.getOpenid() || ''
        that.setData({
          openid: oid,
          openidShort: that.shortenOpenid(oid),
          nickname: localNickname || '树屋夜行者',
          avatar: localAvatar || ''
        })
      })

    // 月光币
    coin.syncWallet().then(function (wallet) {
      that.setData({ wallet: wallet })
    })
  },

  /** 套餐档位中文名（WXML 不支持方法调用/映射，必须在 JS 里算） */
  planLabel: function (code) {
    if (code === 'MONTH') return '月卡'
    if (code === 'YEAR') return '年卡'
    if (code === 'LIFE') return '永久卡'
    return code || '套餐'
  },

  /** 有效期文案：LIFE 后端给 999999 天，不能直接展示数字 */
  planDaysText: function (p) {
    if (!p) return ''
    if (p.code === 'LIFE' || (p.days && p.days >= 36500)) return '永久有效'
    return (p.days || 0) + ' 天'
  },

  // 加载会员套餐（GET /membership/plans）
  loadPlans: function () {
    const that = this
    request.get(config.apiPaths.membershipPlans, {}, { quiet: true })
      .then(function (data) {
        if (data && data.plans && data.plans.length) {
          // 后端三档全展示：MONTH / YEAR / LIFE
          const plans = data.plans.map(function (p) {
            return {
              code: p.code,
              price: p.price,
              days: p.days,
              recommend: !!p.recommend,
              label: that.planLabel(p.code),
              daysText: that.planDaysText(p)
            }
          })
          that.setData({ plans: plans })
        }
      })
      .catch(function () { /* 用默认静态档 */ })
  },

  // 选择头像（微信官方 chooseAvatar 能力）
  onChooseAvatar: function (e) {
    const tmpPath = e.detail.avatarUrl
    const that = this

    // 1. 先本地预览（临时路径，立即可见）
    this.setData({ avatar: tmpPath })

    // 2. 上传到服务器换取持久 URL（临时路径重启即失效，必须上传）
    request.uploadFile(config.apiPaths.uploadImage, tmpPath, { bizType: 'avatar' }, { quiet: true })
      .then(function (data) {
        if (data && data.url) {
          // context-path=/api/v1 下，ResourceHandler 实际映射到 /api/v1/uploads/**
          const url = upload.resolveUrl(data.url)
          that.setData({ avatar: url })
          wx.setStorageSync('avatar', url)
          that.saveProfile()
        } else {
          wx.setStorageSync('avatar', tmpPath)
          that.saveProfile()
        }
      })
      .catch(function (err) {
        // 兜底：上传失败也存临时路径，至少本次会话可见
        console.warn('头像上传失败，降级为本地临时路径：', err)
        wx.setStorageSync('avatar', tmpPath)
        that.saveProfile()
      })
  },

  onNicknameChange: function (e) {
    this.setData({ nickname: e.detail.value })
    wx.setStorageSync('nickname', e.detail.value)
  },

  onNicknameBlur: function () {
    this.saveProfile()
  },

  // 保存资料（POST /user/update-profile）
  saveProfile: function () {
    request.post(config.apiPaths.updateProfile, {
      nickname: this.data.nickname,
      avatar: this.data.avatar
    }, { quiet: true }).catch(function (err) {
      console.warn('资料保存失败：', err)
    })
  },

  // 开通会员（POST /membership/subscribe → 微信支付参数）
  onSubscribe: function (e) {
    const planCode = e.currentTarget.dataset.code

    request.post(config.apiPaths.membershipSubscribe, { planCode: planCode }, { quiet: true })
      .then(function (data) {
        if (data && data.wxPayParams) {
          // 后端接入微信支付后走真实支付
          wx.requestPayment(Object.assign({}, data.wxPayParams, {
            success: function () {
              wx.showToast({ title: '欢迎成为月光会员 ✨', icon: 'none' })
            },
            fail: function () {}
          }))
        } else {
          wx.showToast({ title: (data && data.tip) || '支付接入中，敬请期待', icon: 'none' })
        }
      })
      .catch(function () {
        wx.showToast({ title: '会员开通即将上线', icon: 'none' })
      })
  },

  // 我的证书 → 摆烂页（历史记录在其中查看）
  goMyLicenses: function () {
    wx.navigateTo({ url: '/pages/bailan/bailan' })
  },

  // 设置
  goSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  // 功能投票
  goFeatureVote: function () {
    wx.navigateTo({ url: '/pages/feature-vote/feature-vote' })
  },

  onShareAppMessage: function () {
    return { title: '白天在人间打拼，晚上来树屋躲一躲 🌙', path: '/pages/home/home' }
  }
})
