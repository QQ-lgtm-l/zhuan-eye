Page({
  data: {
    name: "",
    tel: "",
    code: "",
    role: "现场施工人员",
    roleIndex: 4,
    roleOpen: false,
    roleOptions: ["项目经理", "专职安全员", "巡检员", "施工班组长", "现场施工人员"],
    countdown: 0,
    sending: false,
    submitting: false,
    demoTip: "",
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onTelInput(e) {
    this.setData({ tel: e.detail.value, demoTip: "" });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  toggleRole() {
    this.setData({ roleOpen: !this.data.roleOpen });
  },

  closeRole() {
    this.setData({ roleOpen: false });
  },

  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role, roleOpen: false });
  },

  startCountdown() {
    if (this.timer) clearInterval(this.timer);
    this.setData({ countdown: 60 });
    this.timer = setInterval(() => {
      const next = this.data.countdown - 1;
      this.setData({ countdown: next > 0 ? next : 0 });
      if (next <= 0) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  },

  sendCode() {
    const tel = (this.data.tel || "").trim();
    if (this.data.countdown > 0 || this.data.sending) return;
    if (!/^1[3-9]\d{9}$/.test(tel)) {
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return;
    }
    this.setData({ sending: true });
    const app = getApp();
    wx.request({
      url: `${app.globalData.baseUrl}/user/phone-code`,
      method: "POST",
      data: { phone: tel },
      success: (res) => {
        const result = res.data || {};
        if (result.code == 0 && result.data) {
          this.setData({
            code: result.data.code,
            demoTip: result.data.message || `演示模式：验证码 ${result.data.code} 已自动填入`,
          });
          this.startCountdown();
        } else {
          wx.showToast({ title: result.msg || "验证码发送失败", icon: "none" });
        }
      },
      fail: () => wx.showToast({ title: "网络请求失败", icon: "none" }),
      complete: () => this.setData({ sending: false }),
    });
  },

  doRegister() {
    const name = (this.data.name || "").trim();
    const tel = (this.data.tel || "").trim();
    const code = (this.data.code || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(tel)) {
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      wx.showToast({ title: "请输入 6 位验证码", icon: "none" });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: "注册中..." });
    const app = getApp();
    wx.request({
      url: `${app.globalData.baseUrl}/user/quick-register`,
      method: "POST",
      data: { name, phone: tel, code, role: this.data.role },
      success: (res) => {
        const result = res.data || {};
        if (result.code == 0 && result.data) {
          const { username, password, role } = result.data;
          wx.hideLoading();
          wx.showModal({
            title: "注册成功",
            content: `账号：${username}\n初始密码：${password}\n职位：${role}\n登录后请在个人中心修改密码。`,
            showCancel: false,
            confirmText: "去登录",
            success: () => {
              wx.reLaunch({ url: `/pages/login/index?u=${encodeURIComponent(username)}&r=${encodeURIComponent(role)}` });
            },
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: result.msg || "注册失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败", icon: "none" });
      },
      complete: () => this.setData({ submitting: false }),
    });
  },

  goToLogin() {
    wx.reLaunch({ url: "/pages/login/index" });
  },
});
