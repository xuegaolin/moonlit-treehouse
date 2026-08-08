// pages/bailan/bailan.js — 摆烂许可证（MVP 核心模块）
// 完整链路：领取 → Canvas 生成证书图 → 保存相册 / 分享
// 接口按 api-spec：POST /bailan/generate、GET /bailan/mine
// 后端未连通时自动降级为本地 mock 数据，保证页面可演示
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')
const coin = require('../../utils/coin.js')

// 本地 mock 理由库（与后端 REASON_POOL 同套文案；网络失败时兜底）
const MOCK_REASONS = {
  monday: [
    '根据《人间打工人保护法》第 3 章第 8 条：周一属于法定缓冲日，当事人有权拒绝一切无效努力。',
    '经月光委员会审定：周一空气含 emo 浓度超标，特批持证人今日躺平修养。'
  ],
  period: [
    '根据《小仙女特别保护法》第 1 条：生理期期间，宇宙自动为持证人免除一切社交与劳动义务。',
    '月光女神批示：特殊日子，特许摆烂，任何人不得催促、打扰、讲道理。'
  ],
  breakup: [
    '依据《失恋疗养法》：心脏维修期间，停工停学停社交，持证人今日合法摆烂。',
    '经鉴定：TA 不配。特发此证，准许持证人今日以眼泪和薯片为食，免于一切正经事。'
  ],
  no_reason: [
    '根据《躺平基本法》：摆烂不需要理由，本证即为理由。',
    '经全票通过：今天、此刻、这位持证人，什么都不做也完全 OK。'
  ]
}

Page({
  data: {
    // 摆烂类型选项（与 api-spec type 枚举对齐）
    types: [
      { code: 'monday', label: '周一续命' },
      { code: 'period', label: '姨妈假' },
      { code: 'breakup', label: '失恋疗养' },
      { code: 'no_reason', label: '无理由摆烂' }
    ],
    selectedType: 'no_reason',

    // 模板（MVP 仅 gov 免费；其余展示为"会员/付费解锁"占位）
    templates: [
      { code: 'gov', label: '政务红头风', free: true },
      { code: 'palace', label: '宫廷圣旨风', free: false },
      { code: 'cyber', label: '赛博朋克风', free: false },
      { code: 'handwrite', label: '手写便签风', free: false }
    ],
    selectedTemplate: 'gov',

    nickname: '',
    todayLicense: null,   // 今日已领取的许可证
    claiming: false,      // 领取中（防连点）
    coinBalance: 0,
    streakDays: 0,
    badges: [],
    myList: [],           // 历史证书记录
    showHistory: false
  },

  onLoad: function () {
    // 立即从本地缓存同步余额（0s 首屏可见）
    this.setData({ coinBalance: coin.getCached().balance })
    // 注意：onLoad 里 getApp() 虽然已就维，但仍做空值保护，避免异常路径下白屏
    let userInfo = null
    try {
      const app = getApp()
      userInfo = app && app.globalData ? app.globalData.userInfo : null
    } catch (e) {
      userInfo = null
    }
    this.setData({
      nickname: (userInfo && userInfo.nickname) || wx.getStorageSync('nickname') || '树屋夜行者'
    })
  },

  onShow: function () {
    this.refreshStatus()
  },

  // 拉取今日状态 + 历史记录（GET /bailan/mine）
  refreshStatus: function () {
    const that = this
    // 月光币
    coin.syncWallet().then(function (wallet) {
      that.setData({ coinBalance: wallet.balance })
    })

    request.get(config.apiPaths.bailanMine, { page: 0, size: 10 }, { quiet: true })
      .then(function (data) {
        const list = data.list || []
        const today = new Date().toDateString()
        const todayLicense = list.find(function (item) {
          return item.createdAt && new Date(item.createdAt).toDateString() === today
        }) || null

        that.setData({
          todayLicense: data.todayClaimed ? (todayLicense || that.data.todayLicense) : null,
          streakDays: data.streakDays || 0,
          badges: data.badges || [],
          myList: list
        })
        if (that.data.todayLicense) {
          that.drawCertificate(that.data.todayLicense)
        }
      })
      .catch(function (err) {
        console.warn('状态拉取失败（后端未启动？），本地模式运行：', err)
      })
  },

  // 选择摆烂类型
  onSelectType: function (e) {
    this.setData({ selectedType: e.currentTarget.dataset.code })
  },

  // 选择模板（付费模板提示）
  onSelectTemplate: function (e) {
    const code = e.currentTarget.dataset.code
    const tpl = this.data.templates.find(function (t) { return t.code === code })
    if (tpl && !tpl.free) {
      wx.showToast({ title: '高级模板，会员解锁 ✨', icon: 'none' })
      return
    }
    this.setData({ selectedTemplate: code })
  },

  onNicknameInput: function (e) {
    this.setData({ nickname: e.detail.value })
  },

  // 领取今日许可证
  onClaim: function () {
    if (this.data.claiming || this.data.todayLicense) return
    this.setData({ claiming: true })

    const that = this
    const payload = {
      type: this.data.selectedType,
      template: this.data.selectedTemplate,
      nickname: this.data.nickname,
      customReason: null
    }

    request.post(config.apiPaths.bailanGenerate, payload, { quiet: true })
      .then(function (license) {
        license.nickname = payload.nickname
        that.onClaimed(license, false)
      })
      .catch(function (err) {
        const code = err && err.code
        // 42901（今日已领）→ 弹提示 + 刷新状态
        if (code === 42901) {
          wx.showToast({ title: (err && err.message) || '今天已经领过啦', icon: 'none' })
          that.refreshStatus()
          return
        }
        // 40101（登录过期）→ 提示重进
        if (code === 40101) {
          wx.showToast({ title: '登录过期了，请重新进入', icon: 'none' })
          return
        }
        // 其他错误（网络 / 50001 / 50002）→ 不兑底 mock，不让用户以为成功
        // 仅提示 + 刷新状态
        console.warn('领取接口失败：', err)
        wx.showToast({ title: (err && err.message) || '领取失败，稍后再试', icon: 'none' })
        that.refreshStatus()
      })
      .finally(function () {
        that.setData({ claiming: false })
      })
  },

  // 领取成功（统一入口：接口成功 / mock）
  onClaimed: function (license, isMock) {
    // 月光币乐观更新
    if (license.coinReward > 0) {
      const wallet = coin.addLocal(license.coinReward)
      this.setData({ coinBalance: wallet.balance })
    }

    const myList = [license].concat(this.data.myList)
    this.setData({ todayLicense: license, myList: myList })

    this.drawCertificate(license)

    wx.showToast({
      title: isMock ? '许可证已签发（本地演示）' : ('许可证已签发 +' + (license.coinReward || 0) + ' 月光币'),
      icon: 'none'
    })
  },

  // 本地 mock 许可证（后端未启动时演示用）
  buildMockLicense: function (payload) {
    const pool = MOCK_REASONS[payload.type] || MOCK_REASONS.no_reason
    const reason = pool[Math.floor(Math.random() * pool.length)]
    const now = new Date()
    const ymd = '' + now.getFullYear()
      + ('0' + (now.getMonth() + 1)).slice(-2)
      + ('0' + now.getDate()).slice(-2)
    return {
      licenseId: 'B' + ymd + '00001',
      licenseNo: 'ML-' + ymd + '-' + ('000' + Math.floor(Math.random() * 9999 + 1)).slice(-4),
      licenseType: payload.type,
      templateCode: payload.template,
      reasonText: reason,
      coinReward: 5,
      createdAt: now.getTime(),
      nickname: payload.nickname,
      _mock: true
    }
  },

  // ===================== Canvas 证书绘制 =====================

  /**
   * 用 Canvas 2D 绘制证书
   * @param {Object} license { licenseNo, reasonText, createdAt, nickname }
   */
  drawCertificate: function (license) {
    const that = this
    const query = wx.createSelectorQuery().in(this)
    query.select('#certCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          console.warn('canvas 节点未就绪')
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2) || 2
        const W = res[0].width
        const H = res[0].height
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        // 1. 背景：深紫渐变 + 圆角
        const bg = ctx.createLinearGradient(0, 0, 0, H)
        bg.addColorStop(0, '#3D3663')
        bg.addColorStop(1, '#221E3D')
        ctx.fillStyle = bg
        that.roundRect(ctx, 0, 0, W, H, 14)
        ctx.fill()

        // 2. 金色内边框
        ctx.strokeStyle = '#F5D76E'
        ctx.lineWidth = 2
        that.roundRect(ctx, 10, 10, W - 20, H - 20, 10)
        ctx.stroke()

        // 3. 顶部月牙
        ctx.fillStyle = '#F5D76E'
        ctx.beginPath()
        ctx.arc(W / 2, 56, 18, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#3D3663'
        ctx.beginPath()
        ctx.arc(W / 2 + 8, 51, 15, 0, Math.PI * 2)
        ctx.fill()

        // 4. 标题
        ctx.textAlign = 'center'
        ctx.fillStyle = '#F5D76E'
        ctx.font = 'bold 26px serif'
        ctx.fillText('摆烂许可证', W / 2, 108)

        ctx.fillStyle = '#B9B3E8'
        ctx.font = '10px sans-serif'
        ctx.fillText('MOONLIT  BAILAN  LICENSE', W / 2, 128)

        // 5. 分隔线
        ctx.strokeStyle = 'rgba(245,215,110,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(40, 142)
        ctx.lineTo(W - 40, 142)
        ctx.stroke()

        // 6. 编号 & 持证人
        ctx.fillStyle = '#E8E6F5'
        ctx.font = '12px sans-serif'
        ctx.fillText('编号：' + (license.licenseNo || 'ML-XXXXXX-XXXX'), W / 2, 164)

        ctx.font = '14px sans-serif'
        ctx.fillText('持证人：' + (license.nickname || that.data.nickname || '树屋夜行者'), W / 2, 190)

        // 7. 正文理由（自动换行）
        ctx.fillStyle = '#D8D4F0'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'left'
        const dateStr = that.formatDate(license.createdAt)
        const body = '兹证明持证人于 ' + dateStr + ' 享有合法摆烂权利：' + (license.reasonText || '')
        that.wrapText(ctx, body, 36, 216, W - 72, 20, 5)

        // 8. 底部：日期 + 落款
        ctx.textAlign = 'center'
        ctx.fillStyle = '#9C97B8'
        ctx.font = '10px sans-serif'
        ctx.fillText('颁发日期：' + dateStr, W / 2, H - 56)
        ctx.fillText('今夜树屋 · 月光委员会 监制', W / 2, H - 36)

        // 9. 印章
        ctx.strokeStyle = '#FF6B81'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(W - 58, H - 58, 20, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#FF6B81'
        ctx.font = 'bold 16px serif'
        ctx.fillText('准', W - 58, H - 52)

        that.canvasNode = canvas
      })
  },

  // 圆角矩形路径
  roundRect: function (ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  },

  // 文本自动换行（逐字测量），返回最终 y
  wrapText: function (ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    let line = ''
    let lines = 0
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ctx.measureText(line + ch).width > maxWidth) {
        ctx.fillText(line, x, y)
        y += lineHeight
        line = ch
        lines++
        if (lines >= maxLines - 1) {
          // 最后一行，超长截断加省略号
          while (i < text.length && ctx.measureText(line + '…').width <= maxWidth) {
            line += text[i]
            i++
          }
          ctx.fillText(line + '…', x, y)
          return y
        }
      } else {
        line += ch
      }
    }
    if (line) ctx.fillText(line, x, y)
    return y
  },

  formatDate: function (ts) {
    const d = ts ? new Date(ts) : new Date()
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'
  },

  // 保存证书到相册
  onSaveImage: function () {
    const that = this
    if (!this.canvasNode) {
      wx.showToast({ title: '证书还没画好', icon: 'none' })
      return
    }

    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      success: function (res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: function () {
            wx.showToast({ title: '已存进相册，去炫耀吧', icon: 'none' })
          },
          fail: function (err) {
            // 三种 fail 要区别处理：
            // 1. 用户主动取消 → 什么都不提示
            // 2. 拒绝授权（永久）→ 引导去设置
            // 3. 其他真错误 → 轻提示
            var msg = (err && err.errMsg) || ''
            if (msg.indexOf('cancel') >= 0) {
              // 用户取消，静默不打扰
              return
            }
            if (msg.indexOf('auth') >= 0 || msg.indexOf('authorize') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '去设置里允许保存图片到相册',
                confirmText: '去设置',
                success: function (modalRes) {
                  if (modalRes.confirm) wx.openSetting()
                }
              })
              return
            }
            // 真错
            console.warn('[bailan] saveImageToPhotosAlbum fail:', err)
            wx.showToast({ title: '保存失败了，稍后再试', icon: 'none' })
          }
        })
      },
      fail: function () {
        wx.showToast({ title: '图片生成失败', icon: 'none' })
      }
    }, that)
  },

  // 分享朋友圈/好友
  onShareAppMessage: function () {
    const no = this.data.todayLicense ? this.data.todayLicense.licenseNo : ''
    return {
      title: no ? ('我领到了摆烂许可证 ' + no + '，今日合法摆烂！') : '快来领取你的今日摆烂许可证 🪑',
      path: '/pages/bailan/bailan'
    }
  },

  // 展开/收起历史记录
  toggleHistory: function () {
    this.setData({ showHistory: !this.data.showHistory })
  },

  // 点击历史记录 → 重新画到 canvas 上
  onViewHistory: function (e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    item.nickname = this.data.nickname
    this.setData({ todayLicense: item })
    this.drawCertificate(item)
    wx.pageScrollTo({ selector: '#certArea', duration: 200 })
  }
})
