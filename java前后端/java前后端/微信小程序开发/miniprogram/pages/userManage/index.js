const ROLE_OPTIONS = ['项目经理', '专职安全员', '巡检员', '施工班组长', '现场施工人员'];

Page({
  data: {
    users: [],
    filteredUsers: [],
    keyword: '',
    loading: true,
    showRole: false,
    selectedUser: null,
    roleOptions: ROLE_OPTIONS
  },

  onLoad() {
    const app = getApp();
    const user = app.globalData.userInfo;
    if (!user || (user.role !== '管理员' && user.role !== 'admin')) {
      wx.showToast({ title: '仅管理员可管理用户', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.loaded = false;
    this.loadUsers();
  },

  onShow() {
    if (this.loaded) this.loadUsers();
  },

  loadUsers() {
    const app = getApp();
    this.setData({ loading: true });
    wx.request({
      url: `${app.globalData.baseUrl}/user/all`,
      method: 'GET',
      success: (res) => {
        const body = res.data || {};
        const list = Array.isArray(body) ? body : (Array.isArray(body.data) ? body.data : []);
        const users = list.map(user => ({
          ...user,
          initial: String(user.name || user.username || '用').slice(0, 1)
        })).sort((a, b) => {
          if (a.username === 'admin') return -1;
          if (b.username === 'admin') return 1;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        this.loaded = true;
        this.setData({ users, loading: false }, () => this.applyFilter());
      },
      fail: () => {
        this.loaded = true;
        this.setData({ loading: false });
        wx.showToast({ title: '用户列表加载失败', icon: 'none' });
      }
    });
  },

  applyFilter() {
    const keyword = String(this.data.keyword || '').trim().toLowerCase();
    const users = this.data.users || [];
    const filteredUsers = keyword
      ? users.filter(user => [user.name, user.username, user.tel]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(keyword)))
      : users;
    this.setData({ filteredUsers });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilter());
  },

  openRole(e) {
    const id = Number(e.currentTarget.dataset.id);
    const user = this.data.users.find(item => Number(item.id) === id);
    if (!user) return;
    if (user.username === 'admin') {
      wx.showToast({ title: '唯一管理员不能修改角色', icon: 'none' });
      return;
    }
    this.setData({ selectedUser: user, showRole: true });
  },

  closeRole() {
    this.setData({ showRole: false, selectedUser: null });
  },

  noop() {},

  chooseRole(e) {
    const role = e.currentTarget.dataset.role;
    const user = this.data.selectedUser;
    if (!user || !role) return;
    if (role === user.role) {
      this.closeRole();
      return;
    }
    const app = getApp();
    wx.showLoading({ title: '保存中' });
    wx.request({
      url: `${app.globalData.baseUrl}/user/update`,
      method: 'POST',
      data: { id: user.id, role },
      success: (res) => {
        const body = res.data || {};
        if (body.code === '0' || body.code === 0) {
          wx.hideLoading();
          wx.showToast({ title: '角色已更新', icon: 'success' });
          this.closeRole();
          this.loadUsers();
        } else {
          wx.hideLoading();
          wx.showToast({ title: body.msg || '修改失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    });
  },

  removeUser(e) {
    const id = Number(e.currentTarget.dataset.id);
    const user = this.data.users.find(item => Number(item.id) === id);
    if (!user) return;
    if (user.username === 'admin') {
      wx.showToast({ title: '唯一管理员不能删除', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除用户',
      content: `确定删除「${user.name || user.username}」吗？删除后不可恢复。`,
      confirmColor: '#c45656',
      success: (res) => {
        if (!res.confirm) return;
        const app = getApp();
        wx.showLoading({ title: '删除中' });
        wx.request({
          url: `${app.globalData.baseUrl}/user/${user.id}`,
          method: 'DELETE',
          success: (response) => {
            wx.hideLoading();
            const body = response.data || {};
            if (body.code === '0' || body.code === 0) {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadUsers();
            } else {
              wx.showToast({ title: body.msg || '删除失败', icon: 'none' });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '网络异常，请重试', icon: 'none' });
          }
        });
      }
    });
  }
});
