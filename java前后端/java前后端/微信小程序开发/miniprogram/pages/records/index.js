Page({
  data: {
    userInfo: null,
    activeTab: 'records',
    tabs: [
      { id: 'records', name: '检测记录' },
      { id: 'workorder', name: '工单台账' }
    ],
    searchKeyword: '',
    records: [],
    workOrders: [],
    pageNum: 1,
    pageSize: 5,
    isLoading: false,
    hasMore: true,
    showDetail: false,
    detailData: null,
    currentOrder: null
  },

  onLoad() {
    this.loadUserInfo();
    this.loadRecords();
  },

  onShow() {
    this.loadUserInfo();
    if (this.data.activeTab === 'records') {
      this.loadRecords();
    } else {
      this.loadWorkOrders();
    }
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

  // 处理图片URL，将localhost替换为127.0.0.1
  processUrl(url) {
    if (!url) return url;
    return url.replace(/localhost/g, '127.0.0.1');
  },

  switchTab(e) {
    const tabId = e.currentTarget.dataset.id;
    this.setData({ 
      activeTab: tabId, 
      pageNum: 1,
      hasMore: true 
    });
    if (tabId === 'records') {
      this.loadRecords();
    } else {
      this.loadWorkOrders();
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.setData({ pageNum: 1, hasMore: true });
    if (this.data.activeTab === 'records') {
      this.loadRecords();
    } else {
      this.loadWorkOrders();
    }
  },

  loadRecords() {
    this.setData({ isLoading: true });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    const username = this.data.userInfo ? this.data.userInfo.username : '';

    wx.request({
      url: `${baseUrl}/imgRecords`,
      method: "GET",
      data: {
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize,
        lable: this.data.searchKeyword
      },
      success: (res) => {
        const result = res.data;
        console.log('记录列表响应:', result);
        if (result.code === "0") {
          const data = result.data || {};
          const rawRecords = data.records || data.list || [];
          
          const parsedRecords = rawRecords.map(record => {
            try {
              if (record.label && typeof record.label === 'string' && record.label.startsWith('[')) {
                record.label = JSON.parse(record.label);
              }
              if (record.confidence && typeof record.confidence === 'string' && record.confidence.startsWith('[')) {
                record.confidence = JSON.parse(record.confidence);
              }
            } catch (e) {
              console.error('解析记录JSON失败:', e);
            }
            
            record.displayLabel = Array.isArray(record.label) ? record.label.join('、') : (record.label || '未检测到隐患');
            record.displayConfidence = Array.isArray(record.confidence) ? record.confidence.join('、') : (record.confidence || '-');
            record.displayWeight = record.weight || '-';
            
            return record;
          });
          
          let filteredRecords = parsedRecords;
          if (username) {
            filteredRecords = parsedRecords.filter(r => r.username === username || r.userName === username);
          }
          this.setData({
            records: this.data.pageNum === 1 ? filteredRecords : [...this.data.records, ...filteredRecords],
            hasMore: filteredRecords.length >= this.data.pageSize,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('记录列表请求失败:', err);
        this.setData({ isLoading: false });
      }
    });
  },

  loadWorkOrders() {
    this.setData({ isLoading: true });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/workOrder`,
      method: "GET",
      data: {
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize,
        search2: this.data.searchKeyword
      },
      success: (res) => {
        const result = res.data;
        console.log('工单列表响应:', result);
        if (result.code === "0") {
          const data = result.data || {};
          const rawOrders = data.list || data.records || [];
          const processedOrders = rawOrders.map(item => {
            return {
              ...item,
              statusText: this.getStatusText(item.status),
              statusClass: this.getStatusType(item.status),
              levelClass: this.getLevelType(item.level),
              rectifyImg: this.processUrl(item.rectifyImg),
            };
          });
          this.setData({
            workOrders: processedOrders,
            hasMore: false,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error('工单列表请求失败:', err);
        this.setData({ isLoading: false });
      }
    });
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

  getLevelType(level) {
    const types = {
      '重大隐患': 'danger',
      '较大隐患': 'warning',
      '一般隐患': 'info',
      '轻微隐患': 'success',
    };
    return types[level] || 'info';
  },

  viewDetail(e) {
    const data = e.currentTarget.dataset.data || {};
    if (this.data.activeTab === 'workorder') {
      const processedOrder = {
        ...data,
        statusText: this.getStatusText(data.status),
        statusClass: this.getStatusType(data.status),
        levelClass: this.getLevelType(data.level),
        rectifyImg: this.processUrl(data.rectifyImg),
      };
      this.setData({
        currentOrder: processedOrder,
        showDetail: true,
      });
    } else {
      const detailData = {
        ...data,
        displayLabel: data.displayLabel || (Array.isArray(data.label) ? data.label.join('、') : (data.label || '-')),
        displayConfidence: data.displayConfidence || (Array.isArray(data.confidence) ? data.confidence.join('、') : (data.confidence || '-')),
        displayWeight: data.displayWeight || (data.weight || '-'),
      };
      this.setData({
        showDetail: true,
        detailData: detailData
      });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, detailData: null, currentOrder: null });
  },

  handleOrder(e) {
    const order = e.currentTarget.dataset.data;
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
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    wx.showLoading({ title: "处理中..." });
    wx.request({
      url: `${baseUrl}/workOrder/${id}/process`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: "工单已开始处理", icon: "success" });
          this.loadWorkOrders();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败", icon: "none" });
      }
    });
  },

  completeOrder(e) {
    const order = e.currentTarget.dataset.data;
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
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    wx.showLoading({ title: "处理中..." });
    wx.request({
      url: `${baseUrl}/workOrder/${id}/complete`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: result.msg || "处理完成", icon: "success" });
          this.loadWorkOrders();
          this.closeDetail();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败", icon: "none" });
      }
    });
  },

  closeOrder(e) {
    const order = e.currentTarget.dataset.data;
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
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;
    wx.showLoading({ title: "处理中..." });
    wx.request({
      url: `${baseUrl}/workOrder/${id}/close`,
      method: "PUT",
      success: (res) => {
        wx.hideLoading();
        const result = res.data;
        if (result.code === "0" || result.code === 0) {
          wx.showToast({ title: "工单已关闭", icon: "success" });
          this.loadWorkOrders();
          this.closeDetail();
        } else {
          wx.showToast({ title: result.msg || "操作失败", icon: "none" });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "网络请求失败", icon: "none" });
      }
    });
  },

  onReachBottom() {
    if (!this.data.isLoading && this.data.hasMore) {
      this.setData({ pageNum: this.data.pageNum + 1 });
      if (this.data.activeTab === 'records') {
        this.loadRecords();
      } else {
        this.loadWorkOrders();
      }
    }
  },

  goToImgRecords() {
    wx.navigateTo({ url: '/pages/imgRecords/index' });
  },

  goToVideoRecords() {
    wx.navigateTo({ url: '/pages/videoRecords/index' });
  },

  goToCameraRecords() {
    wx.navigateTo({ url: '/pages/cameraRecords/index' });
  },

  goToWorkOrder() {
    wx.navigateTo({ url: '/pages/workOrder/index' });
  }
});