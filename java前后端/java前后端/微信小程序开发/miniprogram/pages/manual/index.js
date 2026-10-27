const app = getApp();

Page({
  data: {
    keyword: '',
    activeCategory: 'all',
    categories: [],
    items: [],
    loading: false,
    detail: null,
    detailVisible: false
  },

  onLoad() {
    this.loadCategories();
    this.loadItems();
  },

  loadCategories() {
    wx.request({
      url: `${app.globalData.baseUrl}/knowledge/categories`,
      method: 'GET',
      success: (res) => {
        const list = (res.data && res.data.data) || [];
        const categories = list.map((item) => ({
          id: item.key || item.id || item.code || item.category,
          name: item.name || item.label || item.category,
          count: item.count || 0
        }));
        const total = categories.reduce((sum, item) => sum + (item.count || 0), 0);
        this.setData({
          categories: [{ id: 'all', name: '全部', count: total || 32 }].concat(categories)
        });
      }
    });
  },

  loadItems() {
    this.setData({ loading: true });
    const category = this.data.activeCategory === 'all' ? '' : this.data.activeCategory;
    wx.request({
      url: `${app.globalData.baseUrl}/knowledge/items`,
      method: 'GET',
      data: { category, keyword: this.data.keyword },
      success: (res) => {
        const list = ((res.data && res.data.data) || []).map((item) => ({
          ...item,
          riskClass: item.risk === '重大' ? 'major' : item.risk === '较大' ? 'medium' : 'low'
        }));
        this.setData({ items: list, loading: false });
      },
      fail: () => {
        this.setData({ items: [], loading: false });
        wx.showToast({ title: '知识库加载失败', icon: 'none' });
      }
    });
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value });
    if (!e.detail.value) this.loadItems();
  },

  search() {
    this.loadItems();
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeCategory: id }, () => this.loadItems());
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '加载中' });
    wx.request({
      url: `${app.globalData.baseUrl}/knowledge/item/${id}`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        const data = res.data && res.data.data;
        if (data) {
          data.riskClass = data.risk === '重大' ? 'major' : data.risk === '较大' ? 'medium' : 'low';
          data.checkpointsText = Array.isArray(data.checkpoints) ? data.checkpoints.join('\n') : (data.checkpoints || '');
          this.setData({ detail: data, detailVisible: true });
        } else {
          wx.showToast({ title: '条目不存在', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  closeDetail() {
    this.setData({ detailVisible: false });
  },

  noop() {},

  copyDetail() {
    const data = this.data.detail;
    if (!data) return;
    const text = `【${data.name}】\n风险等级：${data.risk}\n整改建议：${data.suggestion}\n处理方法：${data.handle}\n预防措施：${data.prevent}\n规范依据：${data.basis}`;
    wx.setClipboardData({ data: text });
  }
});
