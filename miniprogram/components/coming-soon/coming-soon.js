// components/coming-soon/coming-soon.js
// 未上线模块的统一占位组件
Component({
  properties: {
    // 模块 emoji
    icon: { type: String, value: '🚧' },
    // 模块名
    title: { type: String, value: '神秘模块' },
    // 模块简介（一句话卖点）
    desc: { type: String, value: '' },
    // 预计上线版本/时间文案
    eta: { type: String, value: '' }
  },

  methods: {
    goHome: function () {
      wx.switchTab({ url: '/pages/home/home' })
    },
    notifyMe: function () {
      // TODO(v1.x)：接订阅消息 wx.requestSubscribeMessage，上线时提醒
      wx.showToast({ title: '好哒，上线第一时间告诉你 🌙', icon: 'none' })
    }
  }
})
