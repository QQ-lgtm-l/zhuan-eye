Page({
  data: {
    videoPath: "",
    isUploading: false,
    result: null,
    showResult: false,
    modelList: [],
    selectedModel: "",
    confValue: 50,
    showModelPicker: false,
    suggestion: "",
    hazardLevel: "",
    hazardList: [],
    detailList: [],
  },

  onLoad() {
    this.checkLogin();
    this.loadModelList();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    const app = getApp();
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    const userInfo = app.globalData.userInfo;
    const allowedRoles = ['管理员', '项目经理', '专职安全员', '巡检员'];
    if (!allowedRoles.includes(userInfo.role)) {
      wx.showToast({
        title: '暂无检测权限',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/safeDetect/index' });
      }, 2000);
    }
  },

  loadModelList() {
    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.request({
      url: `${baseUrl}/flask/file_names`,
      method: "GET",
      success: (res) => {
        const result = res.data;
        if (result.code === "0") {
          try {
            const data = JSON.parse(result.data);
            if (data.weight_items && Array.isArray(data.weight_items)) {
              this.setData({ 
                modelList: data.weight_items,
                selectedModel: data.weight_items.length > 0 ? data.weight_items[0].value : ""
              });
            }
          } catch (e) {
            console.log("解析模型列表失败:", e);
          }
        }
      },
      fail: () => {
        console.log("加载模型列表失败");
        this.setData({
          modelList: [
            { label: "YOLOv8s", value: "yolov8s.pt" },
            { label: "YOLOv8m", value: "yolov8m.pt" },
            { label: "YOLOv8l", value: "yolov8l.pt" },
          ],
          selectedModel: "yolov8s.pt"
        });
      }
    });
  },

  showModelPicker() {
    this.setData({ showModelPicker: true });
  },

  hideModelPicker() {
    this.setData({ showModelPicker: false });
  },

  onPickerContentTap() {
  },

  selectModel(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ 
      selectedModel: value,
      showModelPicker: false 
    });
  },

  onConfChange(e) {
    this.setData({ confValue: e.detail.value });
  },

  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album", "camera"],
      maxDuration: 60,
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 
          videoPath: tempFilePath,
          showResult: false,
          result: null 
        });
      },
      fail: () => {
        wx.showToast({ title: "选择视频失败", icon: "none" });
      },
    });
  },

  uploadAndRecognize() {
    const { videoPath, selectedModel, confValue } = this.data;
    
    if (!videoPath) {
      wx.showToast({ title: "请先选择视频", icon: "none" });
      return;
    }

    if (!selectedModel) {
      wx.showToast({ title: "请选择检测模型", icon: "none" });
      return;
    }

    wx.showLoading({ title: "视频检测中，可能需要较长时间..." });
    this.setData({ isUploading: true });

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.uploadFile({
      url: `${baseUrl}/files/upload`,
      filePath: videoPath,
      name: "file",
      success: (uploadRes) => {
        try {
          const uploadResult = JSON.parse(uploadRes.data);
          if (uploadResult.code === "0") {
            const videoUrl = uploadResult.data;
            wx.request({
              url: `${baseUrl}/flask/video`,
              method: "POST",
              data: {
                weight: selectedModel,
                conf: (confValue / 100).toFixed(1),
                username: app.globalData.userInfo.username,
                inputVideo: videoUrl,
                startTime: new Date().toLocaleString(),
              },
              timeout: 300000,
              success: (predictRes) => {
                wx.hideLoading();
                console.log("视频检测请求成功，statusCode:", predictRes.statusCode);
                let result = predictRes.data;
                console.log("视频检测返回原始数据:", result);
                console.log("数据类型:", typeof result);
                
                if (typeof result === 'string') {
                  try {
                    result = JSON.parse(result);
                  } catch (e) {
                    console.log("解析result失败:", e);
                    wx.showToast({ title: "解析结果失败", icon: "none" });
                    this.setData({ isUploading: false });
                    return;
                  }
                }
                
                console.log("视频检测返回解析后:", result);
                console.log("result.code:", result.code);
                console.log("result.code类型:", typeof result.code);
                
                if (result.code === "0" || result.code === 0) {
                  let data = result.data;
                  console.log("result.data原始值:", data);
                  console.log("result.data类型:", typeof data);
                  
                  if (typeof data === 'string') {
                    try {
                      data = JSON.parse(data);
                    } catch (e) {
                      console.log("解析data失败:", e);
                      wx.showToast({ title: "解析数据失败", icon: "none" });
                      this.setData({ isUploading: false });
                      return;
                    }
                  }
                  console.log("解析后的数据:", data);
                  let labels = data.label;
                  let confidences = data.confidence;
                  let outVideo = data.outVideo || data.videoUrl;
                  let hazardLevel = data.hazard_level || "";
                  let suggestion = data.suggestion || "";

                  console.log("原始label:", labels);
                  console.log("原始confidence:", confidences);
                  console.log("视频URL:", outVideo);
                  console.log("隐患等级:", hazardLevel);
                  console.log("整改建议:", suggestion);

                  try {
                    if (typeof labels === 'string') {
                      labels = JSON.parse(labels);
                    }
                    if (typeof confidences === 'string') {
                      confidences = JSON.parse(confidences);
                    }
                  } catch (e) {
                    console.log("解析JSON失败", e);
                  }

                  // 配对隐患标签
                  let hazardList = [];
                  if (Array.isArray(labels) && Array.isArray(confidences)) {
                    for (let i = 0; i < labels.length; i++) {
                      hazardList.push({
                        label: labels[i],
                        confidence: confidences[i]
                      });
                    }
                  }

                  // 解析 all_detections
                  let allDetections = data.all_detections || [];
                  if (typeof allDetections === 'string') {
                    try { allDetections = JSON.parse(allDetections); } catch (e) { allDetections = []; }
                  }

                  // 预处理 all_detections
                  let detailList = [];
                  for (let i = 0; i < allDetections.length; i++) {
                    var d = allDetections[i];
                    var typeLabel = '';
                    var typeClass = '';
                    if (d.is_hazard) {
                      typeLabel = '⚠️隐患';
                      typeClass = 'hazard';
                    } else if (d.category === 'normal') {
                      typeLabel = '✅正常';
                      typeClass = 'normal';
                    } else {
                      typeLabel = '➖中性';
                      typeClass = 'neutral';
                    }
                    var sourceLabel = '主模型';
                    if (d.inferred) {
                      sourceLabel = '🔍推断';
                    } else if (d.source === 'coco') {
                      sourceLabel = 'COCO';
                    }
                    detailList.push({
                      hazard_type: d.hazard_type || d.class_name,
                      confidence: d.confidence,
                      typeLabel: typeLabel,
                      typeClass: typeClass,
                      sourceLabel: sourceLabel
                    });
                  }

                  const resultData = {
                    ...data,
                    labels: labels,
                    confidences: confidences,
                    displayLabel: Array.isArray(labels) ? labels.join('、') : (labels || '未检测到隐患'),
                    displayConfidence: Array.isArray(confidences) ? confidences.join('、') : (confidences || '-'),
                    outVideo: outVideo,
                  };

                  this.setData({
                    result: resultData,
                    showResult: true,
                    isUploading: false,
                    hazardLevel: hazardLevel,
                    suggestion: suggestion,
                    hazardList: hazardList,
                    detailList: detailList,
                  });
                  
                  wx.showToast({ title: "检测成功", icon: "success" });
                } else {
                  console.log("检测失败，code:", result.code, ", msg:", result.msg);
                  wx.showToast({ title: result.msg || "检测失败", icon: "none" });
                  this.setData({ isUploading: false });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.log("视频检测请求失败:", err);
                wx.showToast({ title: "网络请求失败", icon: "none" });
                this.setData({ isUploading: false });
              },
            });
          } else {
            wx.hideLoading();
            wx.showToast({ title: "上传失败", icon: "none" });
            this.setData({ isUploading: false });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: "上传失败", icon: "none" });
          this.setData({ isUploading: false });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "上传失败", icon: "none" });
        this.setData({ isUploading: false });
      },
    });
  },

  reset() {
    this.setData({
      videoPath: "",
      result: null,
      showResult: false,
      hazardLevel: "",
      suggestion: "",
      hazardList: [],
      detailList: [],
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
