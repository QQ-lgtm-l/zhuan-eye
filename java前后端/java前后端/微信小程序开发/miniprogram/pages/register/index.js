Page({
  data: {
    name: "",
    tel: "",
    code: "",
    countdown: 0,
    sending: false,
    submitting: false,
    demoTip: "",
    nameFocused: false,
    telFocused: false,
    codeFocused: false,
  },

  onLoad(options) {
    if (options && options.phone) {
      this.setData({ tel: decodeURIComponent(options.phone).replace(/\D/g, "").slice(0, 11) });
    }
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

  onNameFocus() { this.setData({ nameFocused: true }); },
  onNameBlur() { this.setData({ nameFocused: false }); },

  onTelInput(e) {
    this.setData({ tel: e.detail.value.replace(/\D/g, "").slice(0, 11), demoTip: "" });
  },

  onTelFocus() { this.setData({ telFocused: true }); },
  onTelBlur() { this.setData({ telFocused: false }); },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.replace(/\D/g, "").slice(0, 6) });
  },

  onCodeFocus() { this.setData({ codeFocused: true }); },
  onCodeBlur() { this.setData({ codeFocused: false }); },

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

  // 与 Web 端一致：调用后端 /user/phone-code，演示模式自动回填验证码
  sendCode() {
    const tel = (this.data.tel || "").trim();
    if (this.data.countdown > 0 || this.data.sending) return;
    if (!/^1[3-9]\d{9}$/.test(tel)) {
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return;
    }

    this.setData({ sending: true, demoTip: "" });
    const app = getApp();

    wx.request({
      url: `${app.globalData.baseUrl}/user/phone-code`,
      method: "POST",
      header: { "Content-Type": "application/json" },
      data: { phone: tel },
      success: (res) => {
        const result = res.data || {};
        if (result.code == 0 && result.data) {
          const data = result.data;
          const tip = data.mock
            ? `演示模式：验证码 ${data.code} 已自动填入`
            : "验证码已发送，请查看短信";
          this.setData({
            code: data.mock ? String(data.code) : this.data.code,
            demoTip: tip,
          });
          this.startCountdown();
        } else {
          wx.showToast({ title: result.msg || "验证码发送失败", icon: "none" });
        }
      },
      fail: () => wx.showToast({ title: "网络请求失败，请检查后端服务", icon: "none" }),
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
      wx.showToast({ title: "请输入6位验证码", icon: "none" });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    wx.showLoading({ title: "注册中..." });
    const app = getApp();

    wx.request({
      url: `${app.globalData.baseUrl}/user/quick-register`,
      method: "POST",
      header: { "Content-Type": "application/json" },
      data: { name, phone: tel, code },
      success: (res) => {
        wx.hideLoading();
        const result = res.data || {};
        if (result.code == 0 && result.data) {
          const data = result.data;
          wx.showModal({
            title: "注册成功",
            content: `手机号：${data.tel || tel}\n账号：${data.username}\n初始密码：${data.password || "123456"}\n默认职位：${data.role || "现场施工人员"}，管理员可在后台调整。`,
            showCancel: false,
            confirmText: "去登录",
            success: () => {
              wx.reLaunch({ url: `/pages/login/index?p=${encodeURIComponent(data.tel || tel)}` });
            },
          });
        } else {
          wx.showToast({ title: result.msg || "注册失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败，请检查后端服务", icon: "none" });
      },
      complete: () => this.setData({ submitting: false }),
    });
  },

  goToLogin() {
    wx.reLaunch({ url: "/pages/login/index" });
  },
});
