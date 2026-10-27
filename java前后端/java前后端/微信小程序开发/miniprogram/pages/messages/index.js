Page({
  data: {
    userInfo: null,
    messages: [],
    activeTab: 'all',
    tabs: [
      { id: 'all', name: '全部' },
      { id: 'unread', name: '未读' },
      { id: 'read', name: '已读' }
    ],
    filteredMessages: [],
    badgeCounts: {},
    showDetail: false,
    detailData: {},
    isLoading: false,
    unreadCount: 0
  },

  onLoad() {
    this.loadUserInfo();
    this.loadMessages();
  },

  onShow() {
    this.loadUserInfo();
    this.loadMessages();
    this.updateUnreadCount();
    this.registerMessageCallback();
  },

  onHide() {
    this.unregisterMessageCallback();
  },

  registerMessageCallback() {
    const app = getApp();
    app.setOnNewMessageCallback((message) => {
      console.log("消息页面收到推送:", message);
      this.loadMessages();
      this.updateUnreadCount();
    });
  },

  unregisterMessageCallback() {
    const app = getApp();
    app.setOnNewMessageCallback(null);
  },

  loadUserInfo() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    this.setData({ userInfo });
  },

  loadMessages() {
    this.setData({ isLoading: true });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const userId = this.data.userInfo ? this.data.userInfo.username : '';

    if (!userId) {
      this.setData({ isLoading: false });
      return;
    }

    wx.request({
      url: `${baseUrl}/message/${userId}`,
      method: "GET",
      success: (res) => {
        const result = res.data;
        console.log('消息列表响应:', result);
        if (result.code === "0") {
          const messages = result.data || [];
          this.setData({ messages });
          this.updateFilteredMessages();
          this.updateBadgeCounts();
        }
        this.setData({ isLoading: false });
      },
      fail: (err) => {
        console.error('消息列表请求失败:', err);
        this.setData({ isLoading: false });
      }
    });
  },

  updateUnreadCount() {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const userId = this.data.userInfo ? this.data.userInfo.username : '';

    if (!userId) return;

    wx.request({
      url: `${baseUrl}/message/${userId}/unreadCount`,
      method: "GET",
      success: (res) => {
        const result = res.data;
        if (result.code === "0") {
          const count = result.data?.count || 0;
          this.setData({ unreadCount: count });
          if (count > 0) {
            wx.setTabBarBadge({
              index: 3,
              text: String(count)
            });
          } else {
            wx.removeTabBarBadge({
              index: 3
            });
          }
        }
      }
    });
  },

  switchTab(e) {
    const tabId = e.currentTarget.dataset.id;
    this.setData({ activeTab: tabId });
    this.updateFilteredMessages();
  },

  updateFilteredMessages() {
    const { activeTab, messages } = this.data;
    let filteredMessages = [];
    if (activeTab === 'all') {
      filteredMessages = messages;
    } else if (activeTab === 'unread') {
      filteredMessages = messages.filter(msg => msg.isRead === 0);
    } else if (activeTab === 'read') {
      filteredMessages = messages.filter(msg => msg.isRead === 1);
    }
    this.setData({ filteredMessages });
  },

  updateBadgeCounts() {
    const { messages, tabs } = this.data;
    const badgeCounts = {};
    const unreadCount = messages.filter(m => m.isRead === 0).length;
    badgeCounts['unread'] = unreadCount;
    badgeCounts['read'] = messages.filter(m => m.isRead === 1).length;
    this.setData({ badgeCounts, unreadCount });
  },

  viewDetail(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      detailData: item,
      showDetail: true
    });
    this.markRead(item.id);
  },

  markRead(id) {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/message/${id}/read`,
      method: "POST",
      success: (res) => {
        const result = res.data;
        if (result.code === "0") {
          const messages = this.data.messages.map(msg => {
            if (msg.id === id) {
              return { ...msg, isRead: 1 };
            }
            return msg;
          });
          this.setData({ messages });
          this.updateFilteredMessages();
          this.updateBadgeCounts();
          this.updateUnreadCount();
        }
      }
    });
  },

  markAllRead() {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const userId = this.data.userInfo ? this.data.userInfo.username : '';

    if (!userId) return;

    wx.request({
      url: `${baseUrl}/message/${userId}/readAll`,
      method: "POST",
      success: (res) => {
        const result = res.data;
        if (result.code === "0") {
          const messages = this.data.messages.map(msg => ({ ...msg, isRead: 1 }));
          this.setData({ messages, unreadCount: 0 });
          this.updateFilteredMessages();
          this.updateBadgeCounts();
          wx.removeTabBarBadge({
            index: 3
          });
          wx.showToast({ title: '已全部标记为已读', icon: 'success' });
        }
      }
    });
  },

  deleteMessage(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？删除后您将不再看到这条消息，但其他用户仍可查看。',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          const baseUrl = app.globalData.baseUrl;

          wx.request({
            url: `${baseUrl}/message/${id}`,
            method: "DELETE",
            success: (res) => {
              const result = res.data;
              if (result.code === "0") {
                const messages = this.data.messages.filter(msg => msg.id !== id);
                this.setData({ messages });
                this.updateFilteredMessages();
                this.updateBadgeCounts();
                this.updateUnreadCount();
                wx.showToast({ title: '删除成功', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有消息吗？清空后您将不再看到所有消息，但其他用户仍可查看。',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          const baseUrl = app.globalData.baseUrl;
          const userId = this.data.userInfo ? this.data.userInfo.username : '';

          if (!userId) return;

          wx.request({
            url: `${baseUrl}/message/${userId}/clear`,
            method: "DELETE",
            success: (res) => {
              const result = res.data;
              if (result.code === "0") {
                this.setData({ messages: [], filteredMessages: [], unreadCount: 0 });
                this.updateBadgeCounts();
                wx.removeTabBarBadge({
                  index: 3
                });
                wx.showToast({ title: '清空成功', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },

  closeDetail() {
    this.setData({ showDetail: false, detailData: {} });
  },

  goToWorkOrder() {
    const { detailData } = this.data;
    this.setData({ showDetail: false });
    const app = getApp();
    if (detailData && detailData.workOrderId) {
      app.globalData.targetWorkOrderId = detailData.workOrderId;
      console.log('设置目标工单ID:', detailData.workOrderId);
    }
    wx.navigateTo({
      url: '/pages/workOrder/index',
      success: () => {
        console.log('跳转到工单页面成功');
      },
      fail: (err) => {
        console.error('跳转到工单页面失败:', err);
      }
    });
  }
});