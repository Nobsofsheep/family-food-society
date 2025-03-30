const app = getApp();

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    nickname: ''
  },

  onLoad: function (options) {
    this.initUserInfo();
  },

  onShow: function () {
    this.initUserInfo();
  },

  // 初始化用户信息
  initUserInfo: function() {
    const userInfo = app.globalData.userInfo;
    const isAdmin = app.globalData.isAdmin;
    
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isAdmin: isAdmin,
        nickname: userInfo.nickname || ''
      });
    } else {
      // 用户未登录，返回设置页
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  },

  // 监听昵称输入
  onNicknameInput: function(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 保存用户信息
  saveUserInfo: function() {
    const nickname = this.data.nickname.trim();
    
    if (!nickname) {
      return wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
    }
    
    wx.showLoading({
      title: '保存中...',
    });
    
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'updateUserInfo',
        userInfo: {
          nickname: nickname
        }
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.result.code === 0) {
          // 更新全局数据
          app.globalData.userInfo.nickname = nickname;
          
          // 更新本地存储
          const userInfo = wx.getStorageSync('userInfo');
          userInfo.nickname = nickname;
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新页面数据
          this.setData({
            'userInfo.nickname': nickname
          });
          
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result.message || '保存失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('保存失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    });
  }
}) 