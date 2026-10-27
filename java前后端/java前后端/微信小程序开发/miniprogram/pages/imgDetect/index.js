Page({
  data: {
    imagePath: "",
    isUploading: false,
    result: null,
    showResult: false,
    modelList: [],
    selectedModel: "",
    confValue: 50,
    showModelPicker: false,
    hazardList: [],
    hazardLevel: "",
    detailList: [],
    suggestion: "",
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

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 
          imagePath: tempFilePath,
          showResult: false,
          result: null 
        });
      },
      fail: () => {
        wx.showToast({ title: "选择图片失败", icon: "none" });
      },
    });
  },

  uploadAndRecognize() {
    const { imagePath, selectedModel, confValue } = this.data;
    
    if (!imagePath) {
      wx.showToast({ title: "请先选择图片", icon: "none" });
      return;
    }

    if (!selectedModel) {
      wx.showToast({ title: "请选择检测模型", icon: "none" });
      return;
    }

    wx.showLoading({ title: "上传识别中..." });
    this.setData({ isUploading: true });

    const app = getApp();
    const baseUrl = app.globalData.baseUrl;

    wx.uploadFile({
      url: `${baseUrl}/files/upload`,
      filePath: imagePath,
      name: "file",
      success: (uploadRes) => {
        try {
          const uploadResult = JSON.parse(uploadRes.data);
          if (uploadResult.code === "0") {
            const imgUrl = uploadResult.data;
            wx.request({
              url: `${baseUrl}/flask/predict`,
              method: "POST",
              data: {
                weight: selectedModel,
                conf: (confValue / 100).toFixed(1),
                username: app.globalData.userInfo.username,
                inputImg: imgUrl,
                startTime: new Date().toLocaleString(),
              },
              success: (predictRes) => {
                wx.hideLoading();
                const result = predictRes.data;
                if (result.code === "0") {
                  let data = JSON.parse(result.data);

                  // 解析 label 和 confidence
                  let labels = data.label;
                  let confidences = data.confidence;
                  try {
                    if (typeof labels === 'string') labels = JSON.parse(labels);
                    if (typeof confidences === 'string') confidences = JSON.parse(confidences);
                  } catch (e) {}

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
                    var bboxStr = '-';
                    if (d.bbox && d.bbox.length === 4) {
                      bboxStr = '[' + d.bbox.join(', ') + ']';
                    }
                    detailList.push({
                      hazard_type: d.hazard_type || d.class_name,
                      confidence: d.confidence,
                      typeLabel: typeLabel,
                      typeClass: typeClass,
                      sourceLabel: sourceLabel,
                      bboxStr: bboxStr
                    });
                  }

                  this.setData({
                    result: data,
                    showResult: true,
                    isUploading: false,
                    hazardList: hazardList,
                    hazardLevel: data.hazard_level || '',
                    detailList: detailList,
                    suggestion: data.suggestion || '',
                  });
                } else {
                  wx.showToast({ title: result.msg || "识别失败", icon: "none" });
                  this.setData({ isUploading: false });
                }
              },
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: "识别失败", icon: "none" });
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
      imagePath: "",
      result: null,
      showResult: false,
      hazardList: [],
      hazardLevel: "",
      detailList: [],
      suggestion: "",
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
