Page({
  data: {
    records: [],
    isLoading: true,
    pageNum: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: "",
    showDetail: false,
    detailData: {}
  },

  onLoad() {
    this.checkLogin();
    this.loadRecords();
  },

  onShow() {
    this.checkLogin();
    this.loadRecords();
  },

  checkLogin() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: "/pages/login/index" });
    }
  },

  onPullDownRefresh() {
    this.setData({ records: [], pageNum: 1, hasMore: true });
    this.loadRecords();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({ pageNum: this.data.pageNum + 1 });
      this.loadRecords();
    }
  },

  onKeywordInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  searchRecords() {
    this.setData({ records: [], pageNum: 1, hasMore: true });
    this.loadRecords();
  },

  formatLabel(label) {
    if (!label) return '';
    try {
      if (label.startsWith('[')) {
        const arr = JSON.parse(label);
        return Array.isArray(arr) ? arr.join('、') : label;
      }
      return label;
    } catch (e) {
      return label;
    }
  },

  formatConfidence(confidence) {
    if (!confidence) return '';
    try {
      if (confidence.startsWith('[')) {
        const arr = JSON.parse(confidence);
        if (Array.isArray(arr)) {
          return arr.map(c => (parseFloat(c) * 100).toFixed(1) + '%').join('、');
        }
      }
      return (parseFloat(confidence) * 100).toFixed(1) + '%';
    } catch (e) {
      return confidence;
    }
  },

  formatWeight(weight) {
    if (!weight) return '';
    try {
      if (weight.startsWith('{')) {
        const obj = JSON.parse(weight);
        return Object.keys(obj).map(key => key + ': ' + obj[key]).join('，');
      }
      return weight;
    } catch (e) {
      return weight;
    }
  },

  loadRecords() {
    this.setData({ isLoading: true });
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/cameraRecords`,
      method: "GET",
      data: {
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize,
        search: this.data.searchKeyword,
      },
      success: (res) => {
        const result = res.data;
        console.log('摄像记录响应:', result);
        if (result.code === "0") {
          const data = result.data || {};
          const newRecords = data.records || data.list || [];
          this.setData({
            records: this.data.pageNum === 1 ? newRecords : [...this.data.records, ...newRecords],
            hasMore: newRecords.length >= this.data.pageSize,
            isLoading: false,
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({ title: result.msg || "加载失败", icon: "none" });
        }
      },
      fail: (err) => {
        console.error('摄像记录请求失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({ title: "加载失败", icon: "none" });
      },
      complete: () => {
        wx.stopPullDownRefresh();
      },
    });
  },

  viewDetail(e) {
    const record = e.currentTarget.dataset.record || {};
    this.setData({
      detailData: record,
      showDetail: true
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  goBack() {
    wx.navigateBack();
  },
});
