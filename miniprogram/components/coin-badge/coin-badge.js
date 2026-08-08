// components/coin-badge/coin-badge.js
// 月光币角标：🌙 x 数量，点击跳"我的"页
Component({
  properties: {
    // 余额
    balance: { type: Number, value: 0 },
    // 尺寸：normal | small
    size: { type: String, value: 'normal' }
  },

  methods: {
    onTap: function () {
      wx.switchTab({ url: '/pages/user/user' })
      this.triggerEvent('tap')
    }
  }
})
