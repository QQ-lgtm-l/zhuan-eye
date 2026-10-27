Page({
  data: {
    userInfo: null,
    detectItems: [],
    hasDetectPermission: false
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
    this.setData({ userInfo });
    this.initDetectItems(userInfo.role);
  },

  initDetectItems(role) {
    const allItems = [
      { id: 'img', name: '图像检测', icon: '📷', desc: '上传图片进行安全隐患识别', color: '#0D47A1' },
      { id: 'batch', name: '批量检测', icon: '🖼️', desc: '同时检测多张图片', color: '#43A047' },
      { id: 'video', name: '视频检测', icon: '🎬', desc: '上传视频进行帧级检测', color: '#FB8C00' },
      { id: 'camera', name: '摄像检测', icon: '📹', desc: '实时摄像头检测', color: '#E53935' },
    ];
    const allowedRoles = ['管理员', '项目经理', '专职安全员', '巡检员'];
    const hasPermission = allowedRoles.includes(role);
    this.setData({
      detectItems: hasPermission ? allItems : [],
      hasDetectPermission: hasPermission
    });
  },

  navigateTo(e) {
    const id = e.currentTarget.dataset.id;
    const paths = {
      img: '/pages/imgDetect/index',
      batch: '/pages/batchDetect/index',
      video: '/pages/videoDetect/index',
      camera: '/pages/cameraDetect/index',
    };
    wx.navigateTo({ url: paths[id] });
  }
});