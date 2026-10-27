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
      if (typeof label === 'string' && label.startsWith('[')) {
        const arr = JSON.parse(label);
        return Array.isArray(arr) ? arr.join('、') : label;
      } else if (Array.isArray(label)) {
        return label.join('、');
      }
      return label;
    } catch (e) {
      return label;
    }
  },

  formatConfidence(confidence) {
    if (!confidence) return '';
    try {
      if (typeof confidence === 'string' && confidence.startsWith('[')) {
        const arr = JSON.parse(confidence);
        if (Array.isArray(arr)) {
          return arr.map(c => {
            const val = parseFloat(c);
            if (isNaN(val)) {
              return String(c);
            }
            if (val >= 0 && val <= 1) {
              return (val * 100).toFixed(1) + '%';
            }
            return String(c);
          }).join('、');
        }
      } else if (Array.isArray(confidence)) {
        return confidence.map(c => {
          const val = parseFloat(c);
          if (isNaN(val)) {
            return String(c);
          }
          if (val >= 0 && val <= 1) {
            return (val * 100).toFixed(1) + '%';
          }
          return String(c);
        }).join('、');
      }
      const val = parseFloat(confidence);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        return (val * 100).toFixed(1) + '%';
      }
      return String(confidence);
    } catch (e) {
      return String(confidence);
    }
  },

  formatWeight(weight) {
    if (!weight) return '';
    try {
      if (typeof weight === 'string' && weight.startsWith('{')) {
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
      url: `${baseUrl}/imgRecords`,
      method: "GET",
      data: {
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize,
        lable: this.data.searchKeyword,
      },
      success: (res) => {
        const result = res.data;
        console.log('图像记录响应:', result);
        if (result.code === "0") {
          const data = result.data || {};
          const rawRecords = data.records || data.list || [];
          
          const newRecords = rawRecords.map(record => {
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
          
          const allRecords = this.data.pageNum === 1 ? newRecords : [...this.data.records, ...newRecords];
          allRecords.sort((a, b) => {
            if (!a.startTime) return 1;
            if (!b.startTime) return -1;
            return b.startTime.localeCompare(a.startTime);
          });
          
          this.setData({
            records: allRecords,
            hasMore: newRecords.length >= this.data.pageSize,
            isLoading: false,
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({ title: result.msg || "加载失败", icon: "none" });
        }
      },
      fail: (err) => {
        console.error('图像记录请求失败:', err);
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
    const detailData = {
      ...record,
      displayLabel: record.displayLabel || (Array.isArray(record.label) ? record.label.join('、') : (record.label || '-')),
      displayConfidence: record.displayConfidence || (Array.isArray(record.confidence) ? record.confidence.join('、') : (record.confidence || '-')),
      displayWeight: record.displayWeight || (record.weight || '-'),
    };
    this.setData({
      detailData: detailData,
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
