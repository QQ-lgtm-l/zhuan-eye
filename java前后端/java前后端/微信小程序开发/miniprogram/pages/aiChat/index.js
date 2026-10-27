const app = getApp();

Page({
  data: {
    input: '',
    loading: false,
    statusLabel: '知识手册',
    statusModel: '',
    messages: [
      {
        role: 'assistant',
        content: '你好，我是筑安慧眼工地安全助手。可以问我隐患等级、整改建议、规范依据等问题。'
      }
    ],
    suggestions: ['未佩戴安全帽属于什么风险等级？', '高处作业安全带系挂要求？', '配电箱防护有哪些规定？']
  },

  onLoad() {
    this.loadStatus();
  },

  loadStatus() {
    wx.request({
      url: `${app.globalData.baseUrl}/ai/status`,
      method: 'GET',
      success: (res) => {
        const data = res.data && res.data.data;
        if (!data) return;
        const label = data.mode === 'coze' ? '扣子智能体' : data.mode === 'online' ? (data.providerLabel || '在线模型') : '知识手册';
        this.setData({ statusLabel: label, statusModel: data.model || '' });
      }
    });
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  useSuggestion(e) {
    this.setData({ input: e.currentTarget.dataset.text }, () => this.send());
  },

  send() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.loading) return;
    const messages = [...this.data.messages, { role: 'user', content: text }];
    this.setData({ messages, input: '', loading: true });
    this.scrollBottom();

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    wx.request({
      url: `${app.globalData.baseUrl}/ai/chat`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { messages: history },
      success: (res) => {
        const result = res.data || {};
        let reply;
        if (result.code == 0 && result.data && result.data.content) {
          reply = { role: 'assistant', content: result.data.content, source: result.data.source };
          const label = result.data.source === 'coze' ? '扣子智能体' : result.data.source === 'online' ? (result.data.provider || '在线模型') : '知识手册';
          this.setData({ statusLabel: label, statusModel: result.data.model || '' });
        } else {
          reply = { role: 'assistant', content: `回答失败：${result.msg || '服务异常，请稍后重试'}` };
        }
        this.setData({ messages: [...this.data.messages, reply], loading: false });
        this.scrollBottom();
      },
      fail: () => {
        this.setData({
          messages: [...this.data.messages, { role: 'assistant', content: '网络请求失败，请检查后端服务是否启动。' }],
          loading: false
        });
        this.scrollBottom();
      }
    });
  },

  scrollBottom() {
    setTimeout(() => {
      this.setData({ scrollTop: 999999 });
    }, 100);
  }
});
