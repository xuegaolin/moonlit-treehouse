// pages/settings/settings.js — 设置页（v1.5）
//
// 模块：
//   1. 隐私与实名（微信一键实名）
//   2. 社交开关（付费 + 实名双重门控）
//   3. 其他配置项
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')

Page({
  data: {
    loading: true,
    privacy: {
      realNameVerified: false,
      chatEnabled: false,
      friendEnabled: false,
      chatHistoryKeepDays: 7,
      isMember: false,
      memberExpireAt: null
    },
    // 聊天记录保存档位
    keepOptions: [
      { days: 7, label: '7 天', cost: 0, monthly: false },
      { days: 30, label: '30 天', cost: 5, monthly: false },
      { days: 90, label: '90 天', cost: 15, monthly: false },
      { days: -1, label: '永久', cost: 50, monthly: true }
    ],
    buildId: '2026-08-08',
    // 是否展开社交提示（只在用户点击时才显示）
    showChatHint: false,
    showFriendHint: false,
    // 下拉框相关
    showKeepPicker: false,
    keepPickerIndex: 0,
    currentKeepText: '7 天'
  },

  onLoad: function () {
    this._loadPrivacy()
  },

  onShow: function () {
    this._loadPrivacy()
  },

  // 拉取隐私设置
  _loadPrivacy: function () {
    var that = this
    if (!this.data.loading) {
      // 静默刷新，不切 loading
    }
    request.get(config.apiPaths.userPrivacy, {}, { quiet: true })
      .then(function (data) {
        // 计算当前保存时长的文本
        var currentText = that.getKeepText(data.chatHistoryKeepDays)
        var keepIndex = that.getKeepIndex(data.chatHistoryKeepDays)
        
        that.setData({ 
          privacy: data, 
          loading: false,
          realNameVerified: !!(data && data.realNameVerified),
          currentKeepText: currentText,
          keepPickerIndex: keepIndex
        })
      })
      .catch(function (err) {
        console.warn('[settings] 隐私加载失败:', err)
        that.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  // 获取保存时长显示文本
  getKeepText: function (days) {
    var options = this.data.keepOptions
    for (var i = 0; i < options.length; i++) {
      if (options[i].days === days) {
        return options[i].label
      }
    }
    return '7 天'
  },

  // 获取保存时长索引
  getKeepIndex: function (days) {
    var options = this.data.keepOptions
    for (var i = 0; i < options.length; i++) {
      if (options[i].days === days) {
        return i
      }
    }
    return 0
  },

  // ====== 社交开关 ======
  onToggleChat: function (e) {
    var value = e.detail.value
    var p = this.data.privacy
    if (value && (!p.isMember || !p.realNameVerified)) {
      this.setData({ showChatHint: true })
      this.onMemberRequired()
      return
    }
    this.setData({ showChatHint: false })
    this._updatePrivacy({ chatEnabled: value })
  },

  onToggleFriend: function (e) {
    var value = e.detail.value
    var p = this.data.privacy
    if (value && (!p.isMember || !p.realNameVerified)) {
      this.setData({ showFriendHint: true })
      this.onMemberRequired()
      return
    }
    this.setData({ showFriendHint: false })
    this._updatePrivacy({ friendEnabled: value })
  },

  // ====== 聊天记录保存期 ======
  showKeepPicker: function () {
    this.setData({ showKeepPicker: true })
  },

  hideKeepPicker: function () {
    this.setData({ showKeepPicker: false })
  },

  onKeepChange: function (e) {
    var index = parseInt(e.detail.value)
    var selectedOption = this.data.keepOptions[index]
    var cost = selectedOption.cost
    var isMember = this.data.privacy.isMember

    if (!isMember && selectedOption.days !== 7) {
      this.onMemberRequired()
      return
    }

    var that = this
    if (cost > 0) {
      wx.showModal({
        title: '确认开通',
        content: '切换到该档位将消耗 ' + cost + ' 月光币' + (selectedOption.monthly ? '/月' : '') + '，是否继续？',
        confirmText: '确定',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) {
            that._updateKeepDays(selectedOption.days, index, selectedOption.label)
          }
        }
      })
    } else {
      this._updateKeepDays(selectedOption.days, index, selectedOption.label)
    }
  },

  _updateKeepDays: function (days, index, label) {
    var that = this
    this._updatePrivacy({ chatHistoryKeepDays: days })
      .then(function () {
        that.setData({
          keepPickerIndex: index,
          currentKeepText: label
        })
      })
  },

  // 调用 PUT /user/privacy
  _updatePrivacy: function (patch) {
    var that = this
    return request.put(config.apiPaths.userPrivacy, patch, { quiet: true })
      .then(function (data) {
        that.setData({ privacy: data })
        var title = ''
        if (patch.chatEnabled === true) title = '聊天已开放'
        else if (patch.chatEnabled === false) title = '聊天已关闭'
        else if (patch.friendEnabled === true) title = '加好友已开放'
        else if (patch.friendEnabled === false) title = '加好友已关闭'
        else if (patch.chatHistoryKeepDays !== undefined) title = '已切换到' + that.getKeepText(patch.chatHistoryKeepDays)
        if (title) wx.showToast({ title: title, icon: 'none' })
      })
      .catch(function (err) {
        console.warn('[settings] 隐私更新失败:', err)
        var msg = (err && err.message) || '更新失败'
        if (err && err.code === 40301) {
          // 业务拒绝（会员/实名不足）
        }
        wx.showToast({ title: msg, icon: 'none' })
      })
  },

  // ====== 提示：需要会员/实名 ======
  onMemberRequired: function () {
    var that = this
    var p = this.data.privacy
    if (!p.isMember && !p.realNameVerified) {
      wx.showModal({
        title: '需要开通会员 + 完成实名',
        content: '社交功能仅对已完成实名的会员开放',
        confirmText: '去开通',
        cancelText: '再想想',
        success: function (res) {
          if (res.confirm) that.goMember()
        }
      })
    } else if (!p.isMember) {
      wx.showModal({
        title: '需要开通会员',
        content: '社交功能仅对会员开放',
        confirmText: '去开通',
        cancelText: '再想想',
        success: function (res) {
          if (res.confirm) that.goMember()
        }
      })
    } else if (!p.realNameVerified) {
      this.onRealNameTip()
    }
  },

  onRealNameTip: function () {
    var that = this
    wx.showModal({
      title: '微信实名认证',
      content: '根据相关法规，开放聊天功能需要先完成实名认证。我们将获取你的手机号用于身份核验。',
      confirmText: '去认证',
      cancelText: '稍后',
      success: function (res) {
        if (res.confirm) {
          // 不做任何事，用户点击下面按钮
        }
      }
    })
  },

  // ====== 测试认证 ======
  doRealNameVerify: function () {
    var that = this
    wx.showLoading({ title: '认证中...' })
    
    // 测试模式：直接调用后端接口
    request.post(config.apiPaths.realNameVerify, { code: 'test_code' })
      .then(function (data) {
        wx.hideLoading()
        wx.showToast({ 
          title: '认证成功！', 
          icon: 'success' 
        })
        that.setData({ 
          privacy: data,
          realNameVerified: true
        })
      })
      .catch(function (err) {
        wx.hideLoading()
        console.error('[settings] 实名失败:', err)
        wx.showToast({ 
          title: (err && err.message) || '认证失败', 
          icon: 'none' 
        })
      })
  },

  // ====== 微信实名 ======
  getPhoneNumber: function (e) {
    var that = this
    console.log('[settings] 获取手机号回调 e.detail:', JSON.stringify(e.detail, null, 2))
    console.log('[settings] e.detail.code:', e.detail.code)
    console.log('[settings] e.detail.errMsg:', e.detail.errMsg)
    
    if (e.detail.errMsg && e.detail.errMsg.indexOf('ok') !== -1) {
      // 用户同意了
      wx.showLoading({ title: '认证中...' })
      
      // 测试模式：直接调用后端接口，不传 code 也没关系
      request.post(config.apiPaths.realNameVerify, { code: 'test_code' })
        .then(function (data) {
          wx.hideLoading()
          wx.showToast({ 
            title: '认证成功！', 
            icon: 'success' 
          })
          that.setData({ 
            privacy: data,
            realNameVerified: true
          })
        })
        .catch(function (err) {
          wx.hideLoading()
          console.error('[settings] 实名失败:', err)
          wx.showToast({ 
            title: (err && err.message) || '认证失败', 
            icon: 'none' 
          })
        })
      
    } else {
      // 用户拒绝或取消
      wx.showToast({ 
        title: '认证取消', 
        icon: 'none' 
      })
    }
  },

  // 取消实名（测试用）
  cancelRealName: function () {
    var that = this
    wx.showModal({
      title: '取消实名认证',
      content: '确定要取消实名认证吗？测试用功能',
      confirmText: '取消实名',
      cancelText: '算了',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' })
          request.post(config.apiPaths.realNameCancel, {})
            .then(function (data) {
              wx.hideLoading()
              wx.showToast({ 
                title: '已取消实名', 
                icon: 'none' 
              })
              that.setData({ 
                privacy: data,
                realNameVerified: false
              })
            })
            .catch(function (err) {
              wx.hideLoading()
              wx.showToast({ 
                title: '操作失败', 
                icon: 'none' 
              })
            })
        }
      }
    })
  },

  // ====== 跳转 ======
  goChatList: function () {
    wx.navigateTo({ url: '/pages/chat-list/chat-list' })
  },

  goFeatureVote: function () {
    wx.navigateTo({ url: '/pages/feature-vote/feature-vote' })
  },

  goMember: function () {
    wx.switchTab({ url: '/pages/user/user' })
  },

  onAgreement: function () {
    wx.showModal({
      title: '用户协议与隐私政策',
      content: '发布内容即视为同意：1. 实名认证与微信账号绑定；2. 内容可能被 AI + 人工审核；3. 违规将被封号。',
      showCancel: false,
      confirmText: '我已阅读'
    })
  }
})
