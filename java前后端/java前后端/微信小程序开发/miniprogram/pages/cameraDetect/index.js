Page({
  data: {
    isDetecting: false,
    result: null,
    showResult: false,
    imagePath: "",
    modelList: [],
    selectedModel: "",
    confValue: 50,
    showModelPicker: false,
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

  takePhotoAndDetect() {
    const { selectedModel } = this.data;
    
    if (!selectedModel) {
      wx.showToast({ title: "请选择检测模型", icon: "none" });
      return;
    }

    wx.showLoading({ title: "拍摄中..." });
    
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      success: (res) => {
        wx.hideLoading();
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 
          imagePath: tempFilePath,
          showResult: false,
          result: null 
        });
        
        this.uploadAndRecognize(tempFilePath);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "拍摄失败", icon: "none" });
      },
    });
  },

  uploadAndRecognize(imagePath) {
    const { selectedModel, confValue } = this.data;
    
    wx.showLoading({ title: "检测中..." });
    this.setData({ isDetecting: true });

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
                  const data = JSON.parse(result.data);
                  this.setData({
                    result: data,
                    showResult: true,
                    isDetecting: false,
                  });
                } else {
                  wx.showToast({ title: result.msg || "检测失败", icon: "none" });
                  this.setData({ isDetecting: false });
                }
              },
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: "检测失败", icon: "none" });
                this.setData({ isDetecting: false });
              },
            });
          } else {
            wx.hideLoading();
            wx.showToast({ title: "上传失败", icon: "none" });
            this.setData({ isDetecting: false });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: "上传失败", icon: "none" });
          this.setData({ isDetecting: false });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "检测失败", icon: "none" });
        this.setData({ isDetecting: false });
      },
    });
  },

  reset() {
    this.setData({
      imagePath: "",
      result: null,
      showResult: false,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
