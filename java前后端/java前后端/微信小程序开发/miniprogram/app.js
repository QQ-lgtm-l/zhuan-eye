App({
  globalData: {
    // 开发者工具可用 127.0.0.1；手机预览/真机调试改成电脑局域网 IP
    baseUrl: "http://10.101.249.41:9999",
    // baseUrl:"http://127.0.0.1:9999",
    userInfo: null,
    config: null,
    ws: null,
    wsConnected: false,
    wsConnecting: false,
  },

  onNewMessageCallback: null,

  onLaunch: function () {
    this.loadUserInfo();
  },

  onShow: function () {
    if (this.isLoggedIn()) {
      this.connectWebSocket();
    }
  },

  onHide: function () {
  },

  loadUserInfo: function () {
    const userInfo = wx.getStorageSync("userInfo");
    if (userInfo && userInfo.id) {
      this.globalData.userInfo = userInfo;
    }
  },

  setUserInfo: function (userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync("userInfo", userInfo);
    this.updateUnreadBadge();
    setTimeout(() => {
      this.connectWebSocket();
    }, 500);
  },

  connectWebSocket: function () {
    if (!this.isLoggedIn()) return;
    
    if (this.globalData.ws && this.globalData.wsConnected) {
      return;
    }

    if (this.globalData.wsConnecting) {
      return;
    }

    this.globalData.wsConnecting = true;
    const userId = this.globalData.userInfo.username;
    const wsUrl = `ws://127.0.0.1:9999/ws/message`;

    this.globalData.ws = wx.connectSocket({
      url: wsUrl,
      success: () => {
        console.log("WebSocket连接请求已发送");
      },
      fail: (err) => {
        console.error("WebSocket连接失败:", err);
        this.globalData.wsConnecting = false;
        setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      }
    });

    this.globalData.ws.onOpen(() => {
      console.log("WebSocket连接成功");
      this.globalData.wsConnected = true;
      this.globalData.wsConnecting = false;
      // 发送纯字符串register消息（后端按字符串处理，不是JSON对象）
      this.globalData.ws.send({
        data: 'register:' + userId,
        success: () => {
          console.log("用户注册成功:", userId);
        }
      });
    });

    this.globalData.ws.onMessage((res) => {
      console.log("收到WebSocket消息:", res.data);
      try {
        const message = JSON.parse(res.data);
        if (message.type === "new_message") {
          this.handleNewMessage(message);
        }
      } catch (e) {
        console.error("解析WebSocket消息失败:", e);
      }
    });

    this.globalData.ws.onClose(() => {
      console.log("WebSocket连接关闭");
      this.globalData.wsConnected = false;
      this.globalData.wsConnecting = false;
      setTimeout(() => {
        if (this.isLoggedIn()) {
          this.connectWebSocket();
        }
      }, 5000);
    });

    this.globalData.ws.onError((err) => {
      console.error("WebSocket错误:", err);
      this.globalData.wsConnected = false;
      this.globalData.wsConnecting = false;
      setTimeout(() => {
        if (this.isLoggedIn()) {
          this.connectWebSocket();
        }
      }, 5000);
    });
  },

  closeWebSocket: function () {
    if (this.globalData.ws) {
      this.globalData.ws.close();
      this.globalData.ws = null;
      this.globalData.wsConnected = false;
    }
  },

  handleNewMessage: function (message) {
    wx.showModal({
      title: message.title || '安全预警',
      content: message.content || '',
      showCancel: true,
      cancelText: '稍后处理',
      confirmText: '立即查看',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/messages/index',
            success: () => {
              console.log('跳转到消息页面');
            }
          });
        }
      }
    });

    this.updateUnreadBadge();

    if (this.onNewMessageCallback) {
      this.onNewMessageCallback(message);
    }
  },

  setOnNewMessageCallback: function (callback) {
    this.onNewMessageCallback = callback;
  },

  updateUnreadBadge: function () {
    if (!this.isLoggedIn()) return;
    const userId = this.globalData.userInfo.username;
    wx.request({
      url: `${this.globalData.baseUrl}/message/${userId}/unreadCount`,
      method: "GET",
      success: (res) => {
        const result = res.data;
        if (result.code === "0") {
          const count = result.data?.count || 0;
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

  clearUserInfo: function () {
    this.globalData.userInfo = null;
    wx.removeStorageSync("userInfo");
    this.closeWebSocket();
  },

  isLoggedIn: function () {
    return this.globalData.userInfo && this.globalData.userInfo.id;
  },

  isManager: function () {
    return this.globalData.userInfo && this.globalData.userInfo.isManager;
  },

  getOpenid: function () {
    if (this.isLoggedIn()) {
      return this.globalData.userInfo.user.openid || "";
    }
    return "";
  },

  checkLogin: function (callback) {
    if (this.isLoggedIn()) {
      callback && callback(true);
    } else {
      wx.reLaunch({ url: "/pages/login/index" });
      callback && callback(false);
    }
  },
});
