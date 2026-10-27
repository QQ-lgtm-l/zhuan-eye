Page({
  data: {
    username: "",
    password: "",
    showPassword: false,
    rememberPassword: false,
    isLogging: false,
    selectedRole: "现场施工人员",
    selectedRoleIndex: 4,
    usernameFocused: false,
    passwordFocused: false,
    roleOptions: [
      { value: "管理员", label: "管理员" },
      { value: "项目经理", label: "项目经理" },
      { value: "专职安全员", label: "专职安全员" },
      { value: "施工班组长", label: "施工班组长" },
      { value: "现场施工人员", label: "现场施工人员" },
    ],
    roleNames: [],
  },

  onLoad(options) {
    this.checkLogin();
    this.loadRememberedPassword();
    // 注册页带回的账号，优先级高于记住的账号
    if (options && options.u) {
      this.setData({ username: decodeURIComponent(options.u) });
    }
    if (options && options.r) {
      const role = decodeURIComponent(options.r);
      if (this.data.roleOptions.some((item) => item.value === role)) {
        this.setData({ selectedRole: role });
      }
    }
    this.initRoleNames();
  },

  initRoleNames() {
    const names = this.data.roleOptions.map(item => item.label);
    this.setData({ roleNames: names });
  },

  checkLogin() {
    const userInfo = wx.getStorageSync("userInfo");
    if (userInfo && userInfo.user && userInfo.user.openid) {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },

  loadRememberedPassword() {
    const remembered = wx.getStorageSync("rememberedLogin");
    if (remembered) {
      this.setData({
        username: remembered.username || "",
        password: remembered.password || "",
        rememberPassword: true,
      });
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onUsernameFocus() {
    this.setData({ usernameFocused: true });
  },

  onUsernameBlur() {
    this.setData({ usernameFocused: false });
  },

  onPasswordFocus() {
    this.setData({ passwordFocused: true });
  },

  onPasswordBlur() {
    this.setData({ passwordFocused: false });
  },

  togglePassword() {
    console.log("togglePassword clicked, current showPassword:", this.data.showPassword);
    this.setData({ showPassword: !this.data.showPassword });
    console.log("togglePassword after, showPassword:", this.data.showPassword);
  },

  onUnload() {
    this.setData = function () {};
  },

  toggleRemember() {
    this.setData({ rememberPassword: !this.data.rememberPassword });
  },

  onRoleChange(e) {
    const index = e.detail.value;
    const role = this.data.roleOptions[index];
    this.setData({
      selectedRole: role.value,
      selectedRoleIndex: Number(index),
    });
  },

  doAccountLogin() {
    const { username, password, rememberPassword } = this.data;

    if (!username) {
      wx.showToast({ title: "请输入用户名", icon: "none" });
      return;
    }

    if (!password) {
      wx.showToast({ title: "请输入密码", icon: "none" });
      return;
    }

    this.setData({ isLogging: true });
    wx.showLoading({ title: "登录中..." });

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/user/login`,
      method: "POST",
      data: {
        username: username,
        password: password,
      },
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0") {
          const userInfo = result.data;
          app.setUserInfo(userInfo);

          if (rememberPassword) {
            wx.setStorageSync("rememberedLogin", { username, password });
          } else {
            wx.removeStorageSync("rememberedLogin");
          }

          wx.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            wx.reLaunch({ url: "/pages/index/index" });
          }, 1000);
        } else {
          wx.showToast({ title: result.msg || "登录失败", icon: "none" });
        }
        this.setData({ isLogging: false });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败", icon: "none" });
        this.setData({ isLogging: false });
      },
    });
  },

  goToRegister() {
    wx.navigateTo({ url: "/pages/register/index" });
  },
});