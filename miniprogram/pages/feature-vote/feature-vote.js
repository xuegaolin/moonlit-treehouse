// pages/feature-vote/feature-vote.js — 功能投票（v1.5）
//
// 用户可以：
//   1. 看全站建议（按票数倒序）
//   2. 提新建议
//   3. 投票 / 取消票
//   4. 看自己提的
const config = require('../../utils/config.js')
const request = require('../../utils/request.js')

Page({
  data: {
    activeTab: 'list',
    list: [],
    mine: [],
    loading: false,
    page: 0,
    hasMore: true,

    // 提交弹层
    showCreate: false,
    newTitle: '',
    newDesc: '',
    submitting: false
  },

  onLoad: function () {
    this._loadList(true)
  },

  onPullDownRefresh: function () {
    var that = this
    this.setData({ page: 0, hasMore: true })
    this._loadList(true).then(function () {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom: function () {
    if (this.data.activeTab === 'list' && this.data.hasMore && !this.data.loading) {
      this._loadList(false)
    }
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'mine' && this.data.mine.length === 0) {
      this._loadMine()
    }
  },

  _loadList: function (reset) {
    var that = this
    if (this.data.loading) return Promise.resolve()
    this.setData({ loading: true })
    var page = reset ? 0 : this.data.page
    return request.get(config.apiPaths.featureList, { page: page, size: 20 }, { quiet: true })
      .then(function (data) {
        var arr = Array.isArray(data) ? data : []
        var merged = reset ? arr : that.data.list.concat(arr)
        that.setData({
          list: merged,
          page: page + 1,
          hasMore: arr.length >= 20,
          loading: false
        })
      })
      .catch(function (err) {
        console.warn('[feature-vote] 列表加载失败：', err)
        that.setData({ loading: false })
      })
  },

  _loadMine: function () {
    var that = this
    request.get(config.apiPaths.featureMine, { page: 0, size: 50 }, { quiet: true })
      .then(function (data) {
        that.setData({ mine: Array.isArray(data) ? data : [] })
      })
      .catch(function (err) {
        console.warn('[feature-vote] 我的加载失败：', err)
      })
  },

  // ====== 投票 / 取消票 ======
  onVote: function (e) {
    var id = e.currentTarget.dataset.id
    var that = this
    request.post(config.apiPaths.featureVote + '/' + id, {}, { quiet: true })
      .then(function (updated) {
        // 同步更新两条列表
        that._patchItem(id, updated, 'list')
        that._patchItem(id, updated, 'mine')
        wx.showToast({
          title: updated.voted ? '已投上' : '已取消',
          icon: 'none'
        })
      })
      .catch(function (err) {
        console.warn('[feature-vote] 投票失败：', err)
        var msg = (err && err.message) || '操作失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
  },

  _patchItem: function (id, updated, key) {
    var arr = this.data[key].map(function (item) {
      if (item.id === id) {
        return Object.assign({}, item, {
          voted: updated.voted,
          voteCount: updated.voteCount,
          status: updated.status
        })
      }
      return item
    })
    var patch = {}
    patch[key] = arr
    this.setData(patch)
  },

  // ====== 提交建议 ======
  onCreate: function () {
    this.setData({ showCreate: true, newTitle: '', newDesc: '', submitting: false })
  },

  onCloseCreate: function () {
    if (this.data.submitting) return
    this.setData({ showCreate: false })
  },

  onTitleInput: function (e) {
    this.setData({ newTitle: e.detail.value })
  },

  onDescInput: function (e) {
    this.setData({ newDesc: e.detail.value })
  },

  get canSubmit() {
    var t = (this.data.newTitle || '').trim()
    var d = (this.data.newDesc || '').trim()
    return t.length > 0 && d.length > 0 && !this.data.submitting
  },

  onSubmitCreate: function () {
    if (!this.canSubmit) {
      wx.showToast({ title: '标题和描述都要填', icon: 'none' })
      return
    }
    var that = this
    this.setData({ submitting: true })
    request.post(config.apiPaths.featureCreate, {
      title: this.data.newTitle.trim(),
      description: this.data.newDesc.trim()
    }, { quiet: true })
      .then(function (vo) {
        that.setData({ submitting: false, showCreate: false })
        wx.showToast({ title: '已提交', icon: 'success' })
        // 把自己提的塞到 mine 头部
        var mine = that.data.mine.slice()
        mine.unshift(vo)
        that.setData({ mine: mine })
        // 切到"我提的"
        that.setData({ activeTab: 'mine' })
      })
      .catch(function (err) {
        console.warn('[feature-vote] 提交失败：', err)
        that.setData({ submitting: false })
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' })
      })
  },

  // 状态文案映射
  statusText: function (s) {
    if (s === 'OPEN') return '待评估'
    if (s === 'PLANNED') return '规划中'
    if (s === 'DONE') return '已上线'
    if (s === 'REJECTED') return '暂不做'
    return s || '—'
  }
})
