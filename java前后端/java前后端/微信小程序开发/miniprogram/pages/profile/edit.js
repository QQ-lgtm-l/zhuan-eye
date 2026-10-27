Page({
  data: {
    avatarUrl: '',
    sexOptions: ['男', '女'],
    form: {
      id: '',
      username: '',
      password: '',
      name: '',
      sex: '',
      email: '',
      tel: '',
      role: '',
      avatar: ''
    }
  },

  onLoad() {
    this.loadUserInfo();
  },

  resolveAvatar(avatar) {
    if (!avatar) return '';
    if (avatar.indexOf('http') === 0) return avatar;
    const app = getApp();
    return avatar.indexOf('/') === 0 ? `${app.globalData.baseUrl}${avatar}` : avatar;
  },

  loadUserInfo() {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const userInfo = app.globalData.userInfo;

    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }

    wx.request({
      url: `${baseUrl}/user/${userInfo.username}`,
      method: 'GET',
      success: (res) => {
        const result = res.data;
        if (result.code === '0') {
          const data = result.data;
          const role = data.role || '';
          this.setData({
            avatarUrl: this.resolveAvatar(data.avatar),
            form: {
              id: data.id,
              username: data.username,
              password: '',
              name: data.name || '',
              sex: data.sex || '',
              email: data.email || '',
              tel: data.tel || '',
              role: role,
              avatar: data.avatar || ''
            }
          });
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadAvatar(tempFilePath);
      },
      fail: () => {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  uploadAvatar(filePath) {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    wx.showLoading({ title: '上传中...' });
    wx.uploadFile({
      url: `${baseUrl}/files/upload`,
      filePath: filePath,
      name: 'file',
      success: (res) => {
        wx.hideLoading();
        try {
          const result = JSON.parse(res.data);
          if (result.code === '0') {
            this.setData({
              'form.avatar': result.data,
              avatarUrl: this.resolveAvatar(result.data)
            });
            wx.showToast({ title: '上传成功', icon: 'success' });
          } else {
            wx.showToast({ title: result.msg || '上传失败', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  onPasswordInput(e) {
    this.setData({ 'form.password': e.detail.value });
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onSexChange(e) {
    const options = ['男', '女'];
    this.setData({ 'form.sex': options[e.detail.value] });
  },

  onEmailInput(e) {
    this.setData({ 'form.email': e.detail.value });
  },

  onTelInput(e) {
    this.setData({ 'form.tel': e.detail.value });
  },

  submit() {
    const form = this.data.form;
    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (form.password && !/^(?=.*[A-Za-z])(?=.*\d)\S{6,30}$/.test(form.password)) {
      wx.showToast({ title: '密码需 6-30 位且含字母和数字', icon: 'none' });
      return;
    }
    if (form.tel && !/^1[3-9]\d{9}$/.test(form.tel)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    const payload = { ...form };
    if (!payload.password) delete payload.password;

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: `${baseUrl}/user/update`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: payload,
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === '0') {
          wx.showToast({ title: '修改成功', icon: 'success' });
          setTimeout(() => {
            app.globalData.userInfo = {
              ...app.globalData.userInfo,
              ...payload,
              password: undefined
            };
            wx.navigateBack();
          }, 1200);
        } else {
          wx.showToast({ title: result.msg || '修改失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  }
});
