Page({
  data: {
    userInfo: null,
    chartData: null,
    loading: true,
    screenWidth: 0,
    screenHeight: 0,
    categories: ['未佩戴安全帽', '车辆违规停放', '危险物品', '人员聚集', '正常', '其他隐患'],
    categoryCounts: [0, 0, 0, 0, 0, 0],
    userPieData: [],
    avgConfData: [],
    realtimeData: [],
    tenDayData: [],
    showCharts: true
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      screenWidth: sysInfo.windowWidth,
      screenHeight: sysInfo.windowHeight
    });
    this.loadUserInfo();
    this.loadChartData();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    if (!userInfo) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    const showCharts = ['管理员', '项目经理', '专职安全员', '巡检员'].includes(userInfo.role);
    this.setData({ userInfo, showCharts });
  },

  goAiChat() {
    wx.navigateTo({ url: '/pages/aiChat/index' });
  },

  goManual() {
    wx.navigateTo({ url: '/pages/manual/index' });
  },

  loadChartData() {
    const app = getApp();
    console.log('请求URL:', `${app.globalData.baseUrl}/imgRecords/all`);
    wx.request({
      url: `${app.globalData.baseUrl}/imgRecords/all`,
      method: 'GET',
      success: (res) => {
        console.log('API响应:', res);
        if (res.data) {
          console.log('响应数据:', res.data);
          console.log('响应code:', res.data.code, '类型:', typeof res.data.code);
        }
        if (res.data && res.data.code === '0') {
          const data = res.data.data || [];
          console.log('处理数据:', data);
          this.processChartData(data);
        } else if (res.data && res.data.code === 0) {
          const data = res.data.data || [];
          console.log('处理数据:', data);
          this.processChartData(data);
        } else if (res.data && res.data.data) {
          console.log('code不为0，但有data:', res.data.data);
          this.processChartData(res.data.data);
        } else if (res.data && Array.isArray(res.data)) {
          console.log('响应本身是数组:', res.data);
          this.processChartData(res.data);
        } else {
          console.log('没有有效数据');
          this.processChartData([]);
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        this.processChartData([]);
      },
      complete: () => {
        this.setData({ loading: false });
        this.drawCharts();
      }
    });
  },

  processChartData(data) {
    console.log('收到数据:', data);
    
    const categories = ['未佩戴安全帽', '车辆违规停放', '危险物品', '人员聚集', '正常', '其他隐患'];
    const categoryCounts = [0, 0, 0, 0, 0, 0];
    
    data.forEach(item => {
      try {
        let labels = item.label;
        if (typeof labels === 'string') {
          labels = labels.trim();
          if (labels.startsWith('[') && labels.endsWith(']')) {
            try {
              labels = JSON.parse(labels);
            } catch (e) {
              labels = [labels];
            }
          } else {
            labels = [labels];
          }
        }
        if (Array.isArray(labels)) {
          labels.forEach(label => {
            const labelStr = String(label);
            let matched = false;
            for (let i = 0; i < categories.length; i++) {
              if (labelStr.includes(categories[i]) || categories[i].includes(labelStr)) {
                categoryCounts[i]++;
                matched = true;
                break;
              }
            }
            if (!matched) {
              if (labelStr.includes('person') || labelStr.includes('人员')) {
                categoryCounts[3]++;
              } else if (labelStr.includes('未检测') || labelStr.includes('normal')) {
                categoryCounts[4]++;
              } else {
                categoryCounts[5]++;
              }
            }
          });
        }
      } catch (e) {
        console.error('解析label失败:', e, item);
      }
    });

    const userCounts = {};
    data.forEach(item => {
      const username = item.username || item.userName || '未知用户';
      userCounts[username] = (userCounts[username] || 0) + 1;
    });
    const sortedUsers = Object.keys(userCounts).sort((a, b) => userCounts[b] - userCounts[a]);
    const userPieData = sortedUsers.slice(0, 6).map(username => ({
      name: username,
      value: userCounts[username]
    }));
    console.log('用户饼图数据:', userPieData);

    const confStatsByUser = {};
    data.forEach(item => {
      const username = item.username || item.userName;
      const confidence = item.confidence;
      if (!confidence || !username) return;
      try {
        let confArr = confidence;
        if (typeof confidence === 'string') {
          confArr = confidence.trim();
          if (confArr.startsWith('[') && confArr.endsWith(']')) {
            try {
              confArr = JSON.parse(confArr);
            } catch (e) {
              confArr = [confArr];
            }
          } else {
            confArr = [confArr];
          }
        }
        if (!Array.isArray(confArr) || confArr.length === 0) return;
        const confidences = confArr.map(confValue => {
          let numValue = parseFloat(String(confValue));
          if (numValue > 1) numValue = numValue / 100;
          return isNaN(numValue) ? 0 : numValue;
        });
        const predictionAvg = confidences.reduce((sum, val) => sum + val, 0) / confidences.length;
        if (!confStatsByUser[username]) {
          confStatsByUser[username] = { total: predictionAvg, count: 1 };
        } else {
          confStatsByUser[username].total += predictionAvg;
          confStatsByUser[username].count += 1;
        }
      } catch (e) {
        console.error('解析confidence失败:', e, item);
      }
    });
    const avgConfData = Object.keys(confStatsByUser).map(username => ({
      username,
      avgConf: (confStatsByUser[username].total / confStatsByUser[username].count * 100).toFixed(1)
    })).slice(0, 7);
    console.log('置信度数据:', avgConfData);

    const realtimeData = data.slice(0, 6).map(item => ({
      username: item.username || item.userName || '-',
      weight: item.weight || '-',
      conf: item.conf || '-',
      startTime: item.startTime || item.createTime || '-'
    }));
    console.log('实时数据:', realtimeData);

    const dateCounts = {};
    data.forEach(item => {
      const dateStr = item.startTime || item.createTime || '';
      let date = '';
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          const month = parts[1].padStart(2, '0');
          const day = parts[2].split(' ')[0].split('T')[0].padStart(2, '0');
          date = `${parts[0]}-${month}-${day}`;
        }
      }
      if (date && date.length >= 5) {
        dateCounts[date] = (dateCounts[date] || 0) + 1;
      }
    });
    const sortedDates = Object.keys(dateCounts).sort((a, b) => b.localeCompare(a)).slice(0, 10);
    const tenDayData = sortedDates.reverse().map(date => ({
      date: date.slice(5),
      value: dateCounts[date]
    }));
    console.log('近十日数据:', tenDayData);

    this.setData({
      categoryCounts,
      userPieData,
      avgConfData,
      realtimeData,
      tenDayData
    });
  },

  drawCharts() {
    setTimeout(() => {
      this.drawBarChart();
      this.drawPieChart();
      this.drawRadarChart();
      this.drawLineChart();
    }, 100);
  },

  drawRoundRect(ctx, x, y, width, height, radius) {
    if (!Array.isArray(radius)) {
      radius = [radius, radius, radius, radius];
    }
    ctx.beginPath();
    ctx.moveTo(x + radius[0], y);
    ctx.lineTo(x + width - radius[1], y);
    ctx.arcTo(x + width, y, x + width, y + radius[1], radius[1]);
    ctx.lineTo(x + width, y + height - radius[2]);
    ctx.arcTo(x + width, y + height, x + width - radius[2], y + height, radius[2]);
    ctx.lineTo(x + radius[3], y + height);
    ctx.arcTo(x, y + height, x, y + height - radius[3], radius[3]);
    ctx.lineTo(x, y + radius[0]);
    ctx.arcTo(x, y, x + radius[0], y, radius[0]);
    ctx.closePath();
  },

  drawBarChart() {
    const ctx = wx.createCanvasContext('barChart');
    const { categories, categoryCounts, screenWidth } = this.data;
    const maxCount = Math.max(...categoryCounts, 1);
    const canvasWidth = screenWidth * 0.9;
    const canvasHeight = screenWidth * 0.7;
    const padding = { top: 25, right: 12, bottom: 45, left: 45 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;
    const barWidth = chartWidth / categories.length * 0.55;
    const barGap = chartWidth / categories.length * 0.45;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.setStrokeStyle('#E3F2FD');
    ctx.setLineWidth(1);
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasWidth - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.setStrokeStyle('#1565C0');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvasHeight - padding.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding.left, canvasHeight - padding.bottom);
    ctx.lineTo(canvasWidth - padding.right, canvasHeight - padding.bottom);
    ctx.stroke();

    ctx.setFillStyle('#1565C0');
    ctx.setFontSize(10);
    for (let i = 0; i <= 4; i++) {
      const value = Math.round(maxCount * (1 - i / 4));
      const y = padding.top + (chartHeight / 4) * i;
      ctx.fillText(value.toString(), padding.left - 30, y + 4);
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvasHeight - padding.bottom);
    gradient.addColorStop(0, 'rgba(13,71,161,0.6)');
    gradient.addColorStop(1, 'rgba(13,71,161,0.1)');

    categories.forEach((category, index) => {
      const x = padding.left + (chartWidth / categories.length) * index + barGap / 2;
      const height = (categoryCounts[index] / maxCount) * chartHeight;
      const y = canvasHeight - padding.bottom - height;

      ctx.setFillStyle(gradient);
      this.drawRoundRect(ctx, x, y, barWidth, height, [4, 4, 0, 0]);
      ctx.fill();

      ctx.setFillStyle('#1565C0');
      ctx.setFontSize(9);
      ctx.setTextAlign('center');
      ctx.fillText(category.slice(0, 4), x + barWidth / 2, canvasHeight - padding.bottom + 20);
    });

    ctx.draw();
  },

  drawPieChart() {
    const ctx = wx.createCanvasContext('pieChart');
    const { userPieData, screenWidth } = this.data;
    const canvasWidth = screenWidth;
    const canvasHeight = screenWidth * 0.6;
    const centerX = canvasWidth / 2.5;
    const centerY = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.40;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const colors = ['#0D47A1', '#64B5F6', '#90CAF9', '#1565C0', '#1E88E5', '#BBDEFB'];
    const total = userPieData.reduce((sum, item) => sum + item.value, 0);
    let startAngle = -Math.PI / 2;

    userPieData.forEach((item, index) => {
      const angle = (item.value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.setFillStyle(colors[index]);
      ctx.fill();

      startAngle = endAngle;
    });

    let legendY = centerY - 35;
    userPieData.forEach((item, index) => {
      if (legendY > canvasHeight - 12) return;
      ctx.setFillStyle(colors[index]);
      this.drawRoundRect(ctx, centerX + radius + 10, legendY, 8, 8, 2);
      ctx.fill();

      ctx.setFillStyle('#333');
      ctx.setFontSize(10);
      ctx.setTextAlign('left');
      const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
      ctx.fillText(item.name.slice(0, 4) + ' ' + percent + '%', centerX + radius + 25, legendY + 6);
      legendY += 18;
    });

    ctx.draw();
  },

  drawRadarChart() {
    const ctx = wx.createCanvasContext('radarChart');
    const { avgConfData, screenWidth } = this.data;
    const canvasWidth = screenWidth;
    const canvasHeight = screenWidth * 0.7;
    const centerX = canvasWidth / 2.4;
    const centerY = canvasHeight / 2.2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.36;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (avgConfData.length === 0) {
      ctx.setFillStyle('#90CAF9');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.fillText('暂无数据', centerX, centerY);
      ctx.draw();
      return;
    }

    const count = avgConfData.length;
    const angleStep = (2 * Math.PI) / count;

    for (let level = 5; level >= 1; level--) {
      const r = (radius / 5) * level;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.setStrokeStyle('#E3F2FD');
      ctx.setLineWidth(1);
      ctx.stroke();
      ctx.setFillStyle('#F5F9FF');
      ctx.fill();
    }

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.setStrokeStyle('#E3F2FD');
      ctx.stroke();
    }

    const values = avgConfData.map(item => parseFloat(item.avgConf) / 100 * radius);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + values[i] * Math.cos(angle);
      const y = centerY + values[i] * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    gradient.addColorStop(0, 'rgba(13,71,161,0.5)');
    gradient.addColorStop(1, 'rgba(13,71,161,0.1)');
    ctx.setFillStyle(gradient);
    ctx.fill();
    ctx.setStrokeStyle('#0D47A1');
    ctx.setLineWidth(2);
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + values[i] * Math.cos(angle);
      const y = centerY + values[i] * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.setFillStyle('#0D47A1');
      ctx.fill();
    }

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const labelRadius = radius + 20;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);

      ctx.setFillStyle('#1565C0');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(avgConfData[i].username.slice(0, 4), x, y);
    }

    ctx.draw();
  },

  drawLineChart() {
    const ctx = wx.createCanvasContext('lineChart');
    const { tenDayData, screenWidth } = this.data;
    const canvasWidth = screenWidth * 2;
    const canvasHeight = screenWidth * 0.75;
    const padding = { top: 25, right: 30, bottom: 50, left: 50 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.setStrokeStyle('#E3F2FD');
    ctx.setLineWidth(1);
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasWidth - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.setStrokeStyle('#1565C0');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvasHeight - padding.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding.left, canvasHeight - padding.bottom);
    ctx.lineTo(canvasWidth - padding.right, canvasHeight - padding.bottom);
    ctx.stroke();

    if (tenDayData.length === 0) {
      ctx.setFillStyle('#90CAF9');
      ctx.setFontSize(20);
      ctx.setTextAlign('center');
      ctx.fillText('暂无数据', canvasWidth / 2, canvasHeight / 2);
      ctx.draw();
      return;
    }

    const maxValue = Math.max(...tenDayData.map(item => item.value), 1);

    ctx.setFillStyle('#1565C0');
    ctx.setFontSize(12);
    for (let i = 0; i <= 4; i++) {
      const value = Math.round(maxValue * (1 - i / 4));
      const y = padding.top + (chartHeight / 4) * i;
      ctx.fillText(value.toString(), padding.left - 35, y + 5);
    }

    ctx.beginPath();
    ctx.setStrokeStyle('#0D47A1');
    ctx.setLineWidth(2);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');

    tenDayData.forEach((item, index) => {
      const x = padding.left + (chartWidth / (tenDayData.length - 1)) * index;
      const y = canvasHeight - padding.bottom - (item.value / maxValue) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvasHeight - padding.bottom);
    gradient.addColorStop(0, 'rgba(13,71,161,0.3)');
    gradient.addColorStop(1, 'rgba(13,71,161,0)');

    ctx.beginPath();
    ctx.moveTo(padding.left, canvasHeight - padding.bottom);
    tenDayData.forEach((item, index) => {
      const x = padding.left + (chartWidth / (tenDayData.length - 1)) * index;
      const y = canvasHeight - padding.bottom - (item.value / maxValue) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(canvasWidth - padding.right, canvasHeight - padding.bottom);
    ctx.closePath();
    ctx.setFillStyle(gradient);
    ctx.fill();

    tenDayData.forEach((item, index) => {
      const x = padding.left + (chartWidth / (tenDayData.length - 1)) * index;
      const y = canvasHeight - padding.bottom - (item.value / maxValue) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.setFillStyle('#ffffff');
      ctx.fill();
      ctx.setStrokeStyle('#0D47A1');
      ctx.setLineWidth(2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.setFillStyle('#0D47A1');
      ctx.fill();
    });

    ctx.setFillStyle('#1565C0');
    ctx.setFontSize(12);
    ctx.setTextAlign('center');
    tenDayData.forEach((item, index) => {
      const x = padding.left + (chartWidth / (tenDayData.length - 1)) * index;
      ctx.fillText(item.date, x, canvasHeight - padding.bottom + 25);
    });

    ctx.draw();
  }
});