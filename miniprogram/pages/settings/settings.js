// 修复后的settings.js文件
// 使用公共工具函数

const app = getApp();
const common = require('../../utils/common.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    autoFeatureDish: false, // 是否自动设置今日特色
    autoRecommendDish: false, // 是否自动设置今日推荐
    isLogin: false, // 是否已登录
    userInfo: null, // 用户信息
    isAdmin: false, // 是否为管理员
    avatarUrl: '', // 用户头像URL
    showNicknameDialog: false // 是否显示获取昵称的弹窗
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initUserInfo();
    this.getAutoSettings();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.initUserInfo();
    this.getAutoSettings();
  },
  
  // 初始化用户信息
  initUserInfo() {
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo,
      isAdmin: app.globalData.isAdmin
    });
  },

  // 获取自动设置特色菜和推荐菜的状态
  getAutoSettings: function () {
    const that = this;
    wx.getStorage({
      key: 'autoFeatureDish',
      success: function (res) {
        that.setData({
          autoFeatureDish: res.data
        });
      },
      fail: function () {
        wx.setStorage({
          key: 'autoFeatureDish',
          data: false
        });
      }
    });

    wx.getStorage({
      key: 'autoRecommendDish',
      success: function (res) {
        that.setData({
          autoRecommendDish: res.data
        });
      },
      fail: function () {
        wx.setStorage({
          key: 'autoRecommendDish',
          data: false
        });
      }
    });
  },

  // 切换自动设置今日特色开关
  toggleAutoFeatureDish: function (e) {
    if (!this.data.isLogin || !this.data.isAdmin) {
      common.showAdminTip();
      return;
    }
    
    const value = e.detail.value;
    this.setData({
      autoFeatureDish: value
    });
    wx.setStorage({
      key: 'autoFeatureDish',
      data: value
    });
    wx.showToast({
      title: value ? '已开启自动设置' : '已关闭自动设置',
      icon: 'none'
    });
  },

  // 切换自动设置今日推荐开关
  toggleAutoRecommendDish: function (e) {
    if (!this.data.isLogin || !this.data.isAdmin) {
      common.showAdminTip();
      return;
    }
    
    const value = e.detail.value;
    this.setData({
      autoRecommendDish: value
    });
    wx.setStorage({
      key: 'autoRecommendDish',
      data: value
    });
    wx.showToast({
      title: value ? '已开启自动设置' : '已关闭自动设置',
      icon: 'none'
    });
  },

  // 步骤1：开始登录流程，获取头像
  login: function() {
    // 提示用户点击头像选择器
    wx.showToast({
      title: '请点击上方头像',
      icon: 'none',
      duration: 2000
    });
  },

  // 步骤1：获取用户头像
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      avatarUrl,
      showNicknameDialog: true // 获取完头像后，显示获取昵称的弹窗
    });
    wx.showToast({
      title: '头像获取成功',
      icon: 'success'
    });
  },

  // 步骤2：输入框中昵称变化时触发
  onNicknameInput: function(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 步骤3：完成登录
  completeLogin: function() {
    const that = this;
    const { avatarUrl, nickname } = this.data;
    
    if (!avatarUrl) {
      wx.showToast({
        title: '请先选择头像',
        icon: 'none'
      });
      return;
    }
    
    if (!nickname || nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    // 隐藏昵称输入弹窗
    this.setData({
      showNicknameDialog: false
    });
    
    wx.showLoading({
      title: '登录中...',
    });
    
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'login',
        data: {
          nickname: nickname,
          avatar: avatarUrl,
          gender: 0 // 默认值
        }
      },
      success: function(res) {
        wx.hideLoading();
        const result = res.result;
        if (result.code === 0) {
          // 登录成功，更新全局数据
          const userData = result.data.userInfo;
          
          app.globalData.isLogin = true;
          app.globalData.userInfo = userData;
          app.globalData.openid = userData.openid;
          app.globalData.isAdmin = userData.role === 'admin';
          
          // 更新本地存储
          wx.setStorageSync('userInfo', userData);
          
          // 更新页面数据
          that.setData({
            isLogin: true,
            userInfo: userData,
            isAdmin: userData.role === 'admin',
            avatarUrl: '',
            nickname: ''
          });
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: result.msg || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('登录失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 取消登录，关闭昵称输入弹窗
  cancelLogin: function() {
    this.setData({
      showNicknameDialog: false,
      avatarUrl: '',
      nickname: ''
    });
  },

  // 退出登录
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除全局数据
          app.globalData.isLogin = false;
          app.globalData.userInfo = null;
          app.globalData.openid = '';
          app.globalData.isAdmin = false;
          
          // 清除本地存储
          wx.removeStorageSync('userInfo');
          
          // 更新页面数据
          this.setData({
            isLogin: false,
            userInfo: null,
            isAdmin: false
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  // 前往菜品管理页面
  goToMenuManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/menu-manage/menu-manage'
    });
  },

  // 前往菜品分类管理页面
  goToCategoryManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/category-manage/category-manage'
    });
  },

  // 前往新品管理页面
  goToNewDishManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/new-dish-manage/new-dish-manage'
    });
  },

  // 前往今日特色管理页面
  goToFeatureDishManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/feature-dish-manage/feature-dish-manage'
    });
  },

  // 前往今日推荐管理页面
  goToRecommendDishManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/recommend-dish-manage/recommend-dish-manage'
    });
  },
  
  // 前往用户管理页面
  goToUserManage: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    if (!common.checkAdminPermission()) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/user-manage/user-manage'
    });
  },

  // 前往个人信息页面
  goToAccountInfo: function () {
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/account/account'
    });
  },

  // 显示关于我们
  showAbout: function () {
    wx.showModal({
      content: '版本：1.0.0',
      showCancel: false
    });
  },

  // 联系客服
  contactCustomerService: function () {
    wx.showModal({
      content: '联系客服邮箱：nobrofsheep@gmail.com',
      showCancel: false
    });
  }
});
