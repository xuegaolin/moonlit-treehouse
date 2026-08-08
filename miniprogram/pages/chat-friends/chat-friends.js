const config = require('../../utils/config.js');
const request = require('../../utils/request.js');

Page({
    data: {
        loading: true,
        friends: [],
        hasFriends: false
    },

    onLoad: function () {
        this.loadFriends();
    },

    onShow: function () {
        this.loadFriends();
    },

    loadFriends: function () {
        const that = this;
        this.setData({ loading: true });

        request.get(config.apiPaths.chatFriends, {}, { quiet: true })
            .then(function (friends) {
                that.setData({
                    friends: friends || [],
                    hasFriends: (friends || []).length > 0,
                    loading: false
                });
            })
            .catch(function (err) {
                console.warn('[chat-friends] 加载好友失败:', err);
                that.setData({ loading: false, friends: [], hasFriends: false });
            });
    },

    startChat: function (e) {
        const friend = e.currentTarget.dataset.friend;
        wx.navigateTo({
            url: '/pages/chat-detail/chat-detail?peerUserId=' + friend.userId + '&peerNickname=' + encodeURIComponent(friend.nickname || '匿名用户')
        });
    },

    onPullDownRefresh: function () {
        this.loadFriends();
        setTimeout(function () {
            wx.stopPullDownRefresh();
        }, 1000);
    }
});
