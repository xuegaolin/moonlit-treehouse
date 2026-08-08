// components/module-card/module-card.js
// 首页模块入口卡片

// tabBar 页面清单（与 app.json tabBar.list 保持一致）——跟 tabBar 页必须用 switchTab
const TAB_PAGES = ['/pages/home/home', '/pages/user/user']

Component({
  properties: {
    // 模块 emoji 图标
    icon: { type: String, value: '🌙' },
    // 模块名
    title: { type: String, value: '' },
    // 一句话描述
    desc: { type: String, value: '' },
    // 点击跳转路径
    path: { type: String, value: '' },
    // 是否已上线；false 时显示“敬请期待”角标
    ready: { type: Boolean, value: true }
  },

  methods: {
    onTap: function () {
      const path = this.data.path
      if (!path) return

      if (!this.data.ready) {
        wx.showToast({ title: '敬请期待 🌙', icon: 'none' })
        return
      }

      const isTab = TAB_PAGES.indexOf(path.split('?')[0]) >= 0
      const fail = function (err) {
        console.error('[module-card] 跳转失败 path=' + path, err)
        wx.showToast({ title: '页面暂时打不开', icon: 'none' })
      }

      if (isTab) {
        wx.switchTab({ url: path, fail: fail })
      } else {
        wx.navigateTo({ url: path, fail: fail })
      }

      this.triggerEvent('tap', { title: this.data.title })
    }
  }
})
