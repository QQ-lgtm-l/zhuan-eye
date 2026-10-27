Page({
  data: {
    userInfo: null,
    avatarUrl: '',
    menuItems: [
      { id: 'edit', name: '编辑资料', icon: '✏️', color: '#0D47A1' },
      { id: 'help', name: '帮助中心', icon: '❓', color: '#7E57C2' },
      { id: 'about', name: '关于我们', icon: 'ℹ️', color: '#00ACC1' }
    ],
    roleDesc: {
      '巡检员': '负责日常巡检，发现安全隐患',
      '项目经理': '负责重大隐患处理和整体协调',
      '专职安全员': '负责较大隐患处理和安全监督',
      '施工班组长': '负责较大隐患处理和班组管理',
      '现场施工人员': '负责一般隐患处理和日常施工',
      '管理员': '系统管理员',
      '普通用户': '普通用户'
    }
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    let avatarUrl = userInfo.avatar || '';
    if (avatarUrl && avatarUrl.indexOf('http') !== 0) {
      avatarUrl = avatarUrl.indexOf('/') === 0 ? `${app.globalData.baseUrl}${avatarUrl}` : avatarUrl;
    }
    this.setData({ userInfo, avatarUrl });
  },

  navigateTo(e) {
    const id = e.currentTarget.dataset.id;
    const paths = {
      edit: '/pages/profile/edit',
      help: '/pages/profile/help',
      about: '/pages/profile/about'
    };
    if (paths[id]) {
      wx.navigateTo({ url: paths[id] });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          const app = getApp();
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/index' });
        }
      }
    });
  }
});