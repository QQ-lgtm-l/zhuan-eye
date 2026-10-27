Page({
  data: {
    orders: [],
    isLoading: true,
    pageNum: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: "",
    searchType: "",
    statusOptions: [
      { value: "", label: "全部" },
      { value: "pending", label: "待处理" },
      { value: "processing", label: "处理中" },
      { value: "completed", label: "已完成" },
      { value: "timeout", label: "超时完成" },
      { value: "closed", label: "已关闭" },
    ],
    statusLabels: [],
    selectedStatus: "",
    selectedStatusLabel: "",
    showDetail: false,
    currentOrder: null,
    // 权限控制
    userRole: "",
    canExport: false,
    canAudit: false,
    canRemind: false,
    canRecheck: false,
    // AI复核
    recheckImgLocalPath: "",
    recheckLoading: false,
    // 审核意见
    auditOpinion: "",
    // 督办
    remindLoading: false,
    // 导出loading
    exportLoading: false,
  },

  onLoad() {
    this.checkLogin();
    this.initStatusLabels();
    this.initPermissions();
    this.loadOrders();
  },

  initStatusLabels() {
    const labels = this.data.statusOptions.map(item => item.label);
    this.setData({ statusLabels: labels });
  },

  // 初始化权限控制
  initPermissions() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    const role = userInfo ? userInfo.role : "";
    const exportRoles = ["管理员", "项目经理", "专职安全员"];
    const auditRoles = ["管理员", "项目经理"];
    const remindRoles = ["管理员", "项目经理", "专职安全员"];
    const recheckRoles = ["管理员", "项目经理", "专职安全员"];
    this.setData({
      userRole: role,
      canExport: exportRoles.indexOf(role) !== -1,
      canAudit: auditRoles.indexOf(role) !== -1,
      canRemind: remindRoles.indexOf(role) !== -1,
      canRecheck: recheckRoles.indexOf(role) !== -1,
    });
  },

  // 处理图片URL，将localhost替换为127.0.0.1
  processUrl(url) {
    if (!url) return url;
    return url.replace(/localhost/g, '127.0.0.1');
  },

  onShow() {
    this.checkLogin();
    this.loadOrders();
    this.checkTargetWorkOrder();
  },

  checkTargetWorkOrder() {
    const app = getApp();
    const targetId = app.globalData.targetWorkOrderId;
    if (targetId && this.data.orders.length > 0) {
      const order = this.data.orders.find(o => o.id === targetId);
      if (order) {
        this.viewDetail(order);
      }
      app.globalData.targetWorkOrderId = null;
    }
  },

  checkLogin() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },

  onPullDownRefresh() {
    this.setData({ orders: [], pageNum: 1, hasMore: true });
    this.loadOrders();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ pageNum: this.data.pageNum + 1 });
      this.loadOrders();
    }
  },

  onKeywordInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onStatusChange(e) {
    const index = e.detail.value;
    const status = this.data.statusOptions[index];
    this.setData({
      selectedStatus: status.value,
      selectedStatusLabel: status.label
    });
    this.setData({ orders: [], pageNum: 1, hasMore: true });
    this.loadOrders();
  },

  searchOrders() {
    this.setData({ orders: [], pageNum: 1, hasMore: true });
    this.loadOrders();
  },

  loadOrders() {
    this.setData({ isLoading: true });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/workOrder`,
      method: "GET",
      data: {
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize,
        search1: this.data.searchKeyword,
        search2: this.data.searchType,
        status: this.data.selectedStatus,
      },
      success: (res) => {
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          const list = result.data.list || [];
          const processedList = list.map(item => {
            return {
              ...item,
              statusText: this.getStatusText(item.status),
              statusClass: this.getStatusType(item.status),
              levelClass: this.getLevelType(item.level),
              recheckText: this.getRecheckText(item.recheckStatus),
              recheckClass: this.getRecheckType(item.recheckStatus),
              rectifyImg: this.processUrl(item.rectifyImg),
            };
          });
          this.setData({
            orders: this.data.pageNum === 1 ? processedList : [...this.data.orders, ...processedList],
            hasMore: processedList.length >= this.data.pageSize,
            isLoading: false,
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({ title: result.msg || "加载失败", icon: "none" });
        }
      },
      fail: () => {
        this.setData({ isLoading: false });
        wx.showToast({ title: "加载失败", icon: "none" });
      },
      complete: () => {
        wx.stopPullDownRefresh();
      },
    });
  },

  viewDetail(data) {
    const order = data.currentTarget ? data.currentTarget.dataset.order : data;
    const processedOrder = {
      ...order,
      statusText: this.getStatusText(order.status),
      statusClass: this.getStatusType(order.status),
      levelClass: this.getLevelType(order.level),
      recheckText: this.getRecheckText(order.recheckStatus),
      recheckClass: this.getRecheckType(order.recheckStatus),
      rectifyImg: this.processUrl(order.rectifyImg),
    };
    this.setData({
      currentOrder: processedOrder,
      showDetail: true,
      recheckImgLocalPath: "",
      auditOpinion: "",
    });
  },

  closeDetail() {
    this.setData({
      showDetail: false,
      currentOrder: null,
      recheckImgLocalPath: "",
      auditOpinion: "",
    });
  },

  handleOrder(e) {
    const order = e.currentTarget.dataset.order;
    wx.showModal({
      title: "确认处理",
      content: "确定开始处理该工单吗？",
      success: (res) => {
        if (res.confirm) {
          this.processOrder(order.id);
        }
      },
    });
  },

  processOrder(id) {
    wx.showLoading({ title: "处理中..." });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/workOrder/${id}/process`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: "工单已开始处理", icon: "success" });
          this.loadOrders();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "操作失败", icon: "none" });
      },
    });
  },

  closeOrder(e) {
    const order = e.currentTarget.dataset.order;
    wx.showModal({
      title: "确认关闭",
      content: "确定关闭该工单吗？",
      success: (res) => {
        if (res.confirm) {
          this.doCloseOrder(order.id);
        }
      },
    });
  },

  doCloseOrder(id) {
    wx.showLoading({ title: "关闭中..." });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/workOrder/${id}/close`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: "工单已关闭", icon: "success" });
          this.loadOrders();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "操作失败", icon: "none" });
      },
    });
  },

  completeOrder(e) {
    const order = e.currentTarget.dataset.order;
    wx.showModal({
      title: "确认完成",
      content: "确定该工单已处理完成吗？",
      success: (res) => {
        if (res.confirm) {
          this.doCompleteOrder(order.id);
        }
      },
    });
  },

  doCompleteOrder(id) {
    wx.showLoading({ title: "提交中..." });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/workOrder/${id}/complete`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: result.msg || "处理完成", icon: "success" });
          this.loadOrders();
          this.closeDetail();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "操作失败", icon: "none" });
      },
    });
  },

  // ==================== Excel台账导出 ====================
  exportExcel() {
    if (this.data.exportLoading) return;
    this.setData({ exportLoading: true });
    wx.showLoading({ title: "导出中..." });

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const params = {
      search1: this.data.searchKeyword,
      search2: this.data.searchType,
      status: this.data.selectedStatus,
    };

    // 构造查询字符串
    const queryStr = Object.keys(params)
      .filter(key => params[key])
      .map(key => key + "=" + encodeURIComponent(params[key]))
      .join("&");

    const exportUrl = baseUrl + "/workOrder/export" + (queryStr ? "?" + queryStr : "");

    wx.downloadFile({
      url: exportUrl,
      success: (res) => {
        wx.hideLoading();
        this.setData({ exportLoading: false });
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;
          // 打开文件
          wx.openDocument({
            filePath: filePath,
            fileType: "xlsx",
            showMenu: true,
            success: () => {
              wx.showToast({ title: "导出成功", icon: "success" });
            },
            fail: () => {
              // 如果无法直接打开，保存到手机
              wx.saveFileToDisk({
                filePath: filePath,
                success: () => {
                  wx.showToast({ title: "文件已保存", icon: "success" });
                },
                fail: () => {
                  wx.showToast({ title: "请长按文件进行保存", icon: "none" });
                }
              });
            }
          });
        } else {
          wx.showToast({ title: "导出失败", icon: "none" });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ exportLoading: false });
        wx.showToast({ title: "导出失败，请检查网络", icon: "none" });
      }
    });
  },

  // ==================== AI二次复核（上传图片方式）====================
  chooseRecheckImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ recheckImgLocalPath: tempFilePath });
      },
    });
  },

  previewRecheckImg() {
    const img = this.data.recheckImgLocalPath;
    if (!img) return;
    wx.previewImage({
      current: img,
      urls: [img],
    });
  },

  doRecheck() {
    const localFile = this.data.recheckImgLocalPath;
    if (!localFile) {
      wx.showToast({ title: "请选择整改图片", icon: "none" });
      return;
    }

    const orderId = this.data.currentOrder.id;
    this.setData({ recheckLoading: true });
    wx.showLoading({ title: "AI复核中...", mask: true });

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    // 上传文件方式
    wx.uploadFile({
      url: baseUrl + "/workOrder/" + orderId + "/recheck",
      filePath: localFile,
      name: "rectifyImgFile",
      timeout: 300000,
      success: (uploadRes) => {
        wx.hideLoading();
        this.setData({ recheckLoading: false });
        let result;
        try {
          result = JSON.parse(uploadRes.data);
        } catch (e) {
          result = { code: "-1", msg: "解析响应失败" };
        }
        if (result.code === "0" || result.code === 0) {
          const data = result.data;
          const currentOrder = this.data.currentOrder;
          if (currentOrder) {
            currentOrder.recheckStatus = data.recheckStatus;
            currentOrder.recheckResult = data.recheckResult;
            currentOrder.recheckTime = data.recheckTime;
            currentOrder.rectifyImg = data.rectifyImg || localFile;
            currentOrder.recheckText = this.getRecheckText(data.recheckStatus);
            currentOrder.recheckClass = this.getRecheckType(data.recheckStatus);
            this.setData({ currentOrder, recheckImgLocalPath: "" });
          }

          if (data.recheckStatus === "passed") {
            wx.showToast({ title: "AI复核通过：隐患已消除", icon: "success" });
          } else {
            wx.showModal({
              title: "AI复核结果",
              content: data.recheckResult || "AI复核不通过",
              showCancel: false,
            });
          }
          this.loadOrders();
        } else {
          wx.showToast({ title: result.msg || "复核失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ recheckLoading: false });
        wx.showToast({ title: "复核失败，请确认检测服务已启动", icon: "none" });
      },
    });
  },

  // ==================== 工单审核意见 ====================
  onAuditOpinionInput(e) {
    this.setData({ auditOpinion: e.detail.value });
  },

  doAudit() {
    const opinion = this.data.auditOpinion;
    if (!opinion || !opinion.trim()) {
      wx.showToast({ title: "请输入审核意见", icon: "none" });
      return;
    }

    const app = getApp();
    const userInfo = app.globalData.userInfo;
    const auditUser = userInfo ? userInfo.username : "";
    const orderId = this.data.currentOrder.id;

    wx.showLoading({ title: "提交中..." });
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: baseUrl + "/workOrder/" + orderId + "/audit",
      method: "PUT",
      header: { "Content-Type": "application/json" },
      data: {
        auditOpinion: opinion,
        auditUser: auditUser,
      },
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: "审核意见已提交", icon: "success" });
          const currentOrder = this.data.currentOrder;
          if (currentOrder) {
            currentOrder.auditOpinion = opinion;
            currentOrder.auditUser = auditUser;
            const now = this.formatTime(new Date());
            currentOrder.auditTime = now;
            this.setData({ currentOrder });
          }
          this.setData({ auditOpinion: "" });
          this.loadOrders();
        } else {
          wx.showToast({ title: result.msg || "提交失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "提交失败", icon: "none" });
      },
    });
  },

  // ==================== 工单督办提醒 ====================
  doRemind() {
    const order = this.data.currentOrder;
    if (!order) return;

    wx.showModal({
      title: "确认督办",
      content: "确定要向责任人发送督办提醒吗？",
      success: (res) => {
        if (res.confirm) {
          this.sendRemind(order.id);
        }
      },
    });
  },

  sendRemind(orderId) {
    this.setData({ remindLoading: true });
    wx.showLoading({ title: "发送督办..." });
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    const baseUrl = app.globalData.baseUrl;
    const remindUser = userInfo ? userInfo.username : "";

    wx.request({
      url: baseUrl + "/workOrder/" + orderId + "/remind",
      method: "PUT",
      header: { "Content-Type": "application/json" },
      data: { remindUser: remindUser },
      success: (res) => {
        wx.hideLoading();
        this.setData({ remindLoading: false });
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: result.msg || "督办提醒已发送", icon: "success" });
          const currentOrder = this.data.currentOrder;
          if (currentOrder) {
            currentOrder.remindCount = (currentOrder.remindCount || 0) + 1;
            currentOrder.lastRemindTime = this.formatTime(new Date());
            this.setData({ currentOrder });
          }
          this.loadOrders();
        } else {
          wx.showToast({ title: result.msg || "督办失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ remindLoading: false });
        wx.showToast({ title: "督办失败", icon: "none" });
      },
    });
  },

  // 预览整改图片
  previewRectifyImg() {
    const img = this.data.currentOrder.rectifyImg;
    if (!img) return;
    wx.previewImage({
      current: img,
      urls: [img],
    });
  },

  // ==================== 工具方法 ====================
  formatTime(date) {
    const pad = function(n) { return n < 10 ? "0" + n : "" + n; };
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  },

  getStatusText(status) {
    const texts = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'timeout': '超时完成',
      'closed': '已关闭',
    };
    return texts[status] || status;
  },

  getLevelType(level) {
    const types = {
      '重大隐患': 'danger',
      '较大隐患': 'warning',
      '一般隐患': 'info',
      '轻微隐患': 'success',
    };
    return types[level] || 'info';
  },

  getStatusType(status) {
    const types = {
      'pending': 'warning',
      'processing': 'info',
      'completed': 'success',
      'timeout': 'danger',
      'closed': 'default',
    };
    return types[status] || 'default';
  },

  getRecheckText(status) {
    const texts = {
      'pending': '待复核',
      'passed': '复核通过',
      'failed': '复核不通过',
    };
    return texts[status] || "";
  },

  getRecheckType(status) {
    const types = {
      'pending': 'warning',
      'passed': 'success',
      'failed': 'danger',
    };
    return types[status] || 'info';
  },

  goBack() {
    wx.navigateBack();
  },
});
