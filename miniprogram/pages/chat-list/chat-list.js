const config = require('../../utils/config.js');
const request = require('../../utils/request.js');

Page({
    data: {
        loading: true,
        sessions: [],
        hasSessions: false
    },

    onLoad: function () {
        this.loadSessions();
    },

    onShow: function () {
        this.loadSessions();
    },

    loadSessions: function () {
        const that = this;
        this.setData({ loading: true });

        request.get(config.apiPaths.chatSessions, {}, { quiet: true })
            .then(function (sessions) {
                that.setData({
                    sessions: sessions || [],
                    hasSessions: (sessions || []).length > 0,
                    loading: false
                });
            })
            .catch(function (err) {
                console.warn('[chat-list] 加载会话失败:', err);
                that.setData({ loading: false, sessions: [], hasSessions: false });
            });
    },

    goChat: function (e) {
        const session = e.currentTarget.dataset.session;
        wx.navigateTo({
            url: '/pages/chat-detail/chat-detail?peerUserId=' + session.peerUserId + '&peerNickname=' + encodeURIComponent(session.peerNickname || '匿名用户')
        });
    },

    goFriends: function () {
        wx.navigateTo({
            url: '/pages/chat-friends/chat-friends'
        });
    },

    onPullDownRefresh: function () {
        this.loadSessions();
        setTimeout(function () {
            wx.stopPullDownRefresh();
        }, 1000);
    }
});
