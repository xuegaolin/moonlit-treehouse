const config = require('../../utils/config.js');
const request = require('../../utils/request.js');

Page({
    data: {
        peerUserId: null,
        peerNickname: '匿名用户',
        loading: true,
        messages: [],
        inputText: '',
        sending: false,
        scrollTop: 0
    },

    onLoad: function (options) {
        const peerUserId = options.peerUserId ? parseInt(options.peerUserId) : null;
        const peerNickname = options.peerNickname ? decodeURIComponent(options.peerNickname) : '匿名用户';

        this.setData({
            peerUserId: peerUserId,
            peerNickname: peerNickname
        });

        wx.setNavigationBarTitle({
            title: peerNickname
        });

        this.loadHistory();
    },

    onShow: function () {
        if (this.data.peerUserId) {
            request.put(config.apiPaths.chatMarkRead + '/' + this.data.peerUserId, {}, { quiet: true })
                .catch(function (err) {
                    console.warn('[chat-detail] 标记已读失败:', err);
                });
        }
    },

    loadHistory: function () {
        const that = this;
        if (!this.data.peerUserId) return;

        this.setData({ loading: true });

        request.get(config.apiPaths.chatHistory, {
            peerUserId: this.data.peerUserId,
            page: 0,
            size: 50
        }, { quiet: true })
            .then(function (messages) {
                that.setData({
                    messages: messages || [],
                    loading: false
                });
                that.scrollToBottom();
            })
            .catch(function (err) {
                console.warn('[chat-detail] 加载历史失败:', err);
                that.setData({ loading: false, messages: [] });
            });
    },

    onInput: function (e) {
        this.setData({ inputText: e.detail.value });
    },

    onSend: function () {
        const text = this.data.inputText.trim();
        if (!text || this.data.sending || !this.data.peerUserId) return;

        const that = this;
        this.setData({ sending: true });

        const tempId = 'temp_' + Date.now();
        const tempMsg = {
            id: tempId,
            fromUserId: 0,
            toUserId: this.data.peerUserId,
            content: text,
            msgType: 'TEXT',
            createTime: new Date().toISOString(),
            isMe: true,
            sending: true
        };

        const newMessages = this.data.messages.concat([tempMsg]);
        this.setData({
            messages: newMessages,
            inputText: ''
        });
        this.scrollToBottom();

        request.post(config.apiPaths.chatSend, {
            peerUserId: this.data.peerUserId,
            content: text
        })
            .then(function (msg) {
                const updatedMessages = newMessages.map(function (m) {
                    return m.id === tempId ? { ...msg, isMe: true, sending: false } : m;
                });
                that.setData({
                    messages: updatedMessages,
                    sending: false
                });
                that.scrollToBottom();
            })
            .catch(function (err) {
                console.warn('[chat-detail] 发送失败:', err);
                wx.showToast({ title: '发送失败', icon: 'none' });
                const updatedMessages = newMessages.filter(function (m) {
                    return m.id !== tempId;
                });
                that.setData({
                    messages: updatedMessages,
                    sending: false,
                    inputText: text
                });
            });
    },

    scrollToBottom: function () {
        setTimeout(function () {
            wx.createSelectorQuery()
                .select('#scroll-area')
                .boundingClientRect()
                .select('#scroll-area')
                .scrollOffset()
                .exec(function (res) {
                    if (res[0] && res[1]) {
                        wx.pageScrollTo({
                            scrollTop: 99999,
                            duration: 300
                        });
                    }
                });
        }, 100);
    },

    formatTime: function (timeStr) {
        if (!timeStr) return '';
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';

        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return month + '-' + day + ' ' + hour + ':' + minute;
    }
});
