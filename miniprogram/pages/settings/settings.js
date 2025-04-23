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
    phoneNumber: '', // 添加手机号字段
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getUserInfoFromDB();
    this.getAutoSettings();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getUserInfoFromDB();
    this.getAutoSettings();
  },
  
  // 从数据库获取用户信息
  getUserInfoFromDB: async function() {
    try {
      // 检查是否有退出登录记录
      const logoutFlag = wx.getStorageSync('hasLogout');
      if (logoutFlag) {
        // 如果有退出记录，需要重新登录
        this.setData({
          isLogin: false,
          userInfo: null,
          isAdmin: false
        });
        return;
      }

      // 检查本地存储的用户信息
      const localUserInfo = wx.getStorageSync('userInfo');
      if (!localUserInfo) {
        // 如果本地没有用户信息，说明未登录
        this.setData({
          isLogin: false,
          userInfo: null,
          isAdmin: false
        });
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      });

      if (res.result.code === 0 && res.result.data) {
        const userData = res.result.data;
        // 更新全局数据
        app.globalData.isLogin = true;
        app.globalData.userInfo = userData;
        app.globalData.openid = userData.openid;
        app.globalData.isAdmin = userData.role === 'admin';
        
        // 更新页面数据
        this.setData({
          isLogin: true,
          userInfo: userData,
          isAdmin: userData.role === 'admin'
        });
      } else {
        // 用户未登录或获取信息失败
        this.setData({
          isLogin: false,
          userInfo: null,
          isAdmin: false
        });
        
        // 清除全局数据
        app.globalData.isLogin = false;
        app.globalData.userInfo = null;
        app.globalData.openid = '';
        app.globalData.isAdmin = false;
        
        // 清除本地存储
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('loginTime');
      }
    } catch (err) {
      console.error('获取用户信息失败：', err);
      // 发生错误时也清除登录状态
      this.setData({
        isLogin: false,
        userInfo: null,
        isAdmin: false
      });
      
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.openid = '';
      app.globalData.isAdmin = false;
      
      // 清除本地存储
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('loginTime');
    }
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

  // 获取用户头像
  onChooseAvatar: async function(e) {
    const { avatarUrl } = e.detail;
    
    wx.showLoading({
      title: '登录中...',
    });
    
    try {
      // 先检查用户是否已存在
      const checkUserRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      });

      // 如果用户已存在且有头像，直接使用现有头像
      if (checkUserRes.result.code === 0 && checkUserRes.result.data.avatar) {
        this.setData({
          avatarUrl: checkUserRes.result.data.avatar
        });
        
        // 直接完成登录
        await this.completeLogin();
        return;
      }

      // 生成唯一的文件名
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const fileExt = 'jpg';  // 微信头像都是jpg格式
      const cloudPath = `avatars/${timestamp}-${random}.${fileExt}`;
      
      // 将临时文件上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });
      
      if (uploadRes.fileID) {
        this.setData({
          avatarUrl: uploadRes.fileID
        });
        
        // 直接完成登录
        await this.completeLogin();
      } else {
        throw new Error('上传失败：未获取到文件ID');
      }
    } catch (err) {
      console.error('头像处理失败：', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 完成登录
  completeLogin: async function() {
    const that = this;
    const { avatarUrl } = this.data;
    
    if (!avatarUrl) {
      wx.showToast({
        title: '请先选择头像',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...',
    });
    
    try {
      // 调用登录云函数
      const loginRes = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'login',
          data: {
            avatar: this.data.avatarUrl,
            nickname: '新用户'  // 设置默认昵称
          }
        }
      });

      if (loginRes.result.code === 0) {
        // 清除退出登录标记
        wx.removeStorageSync('hasLogout');
        
        // 登录成功，更新全局数据
        const userData = loginRes.result.data.userInfo;
        
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
          avatarUrl: ''
        });
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      } else {
        throw new Error(loginRes.result.msg || '登录失败');
      }
    } catch (err) {
      console.error('登录失败', err);
      wx.showToast({
        title: err.message || '登录失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 退出登录
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用退出登录的云函数
            await wx.cloud.callFunction({
              name: 'user',
              data: {
                action: 'logout'
              }
            });

            // 设置退出登录标记
            wx.setStorageSync('hasLogout', true);
            
            // 清除全局数据
            app.globalData.isLogin = false;
            app.globalData.userInfo = null;
            app.globalData.openid = '';
            app.globalData.isAdmin = false;
            
            // 清除本地存储的所有相关数据
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('loginTime');
            
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
          } catch (err) {
            console.error('退出登录失败：', err);
            wx.showToast({
              title: '退出失败，请重试',
              icon: 'none'
            });
          }
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
  goToUserManage: function() {
    if (!this.data.isLogin || !this.data.isAdmin) {
      common.showAdminTip();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/user-manage/user-manage'
    });
  },

  // 前往个人信息页面
  goToAccount: function() {
    if (!this.data.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/account/account'
    });
  },

  // 显示关于我们
  showAbout: function () {
    wx.showModal({
      content: '版本：8.2.7',
      showCancel: false
    });
  },

  // 联系客服
  contactCustomerService: function () {
    wx.showModal({
      content: '联系客服邮箱：nobrofsheep@gmail.com',
      showCancel: false
    });
  },

  // 获取用户手机号
  getPhoneNumber: function(e) {
    console.log('获取手机号结果：', e.detail);
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '获取手机号失败: ' + e.detail.errMsg,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    wx.showLoading({
      title: '登录中...',
    });

    // 调用云函数解析手机号
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getPhoneNumber',
        data: {
          cloudID: e.detail.cloudID
        }
      },
      success: res => {
        console.log('云函数调用结果：', res);
        
        if (res.result && res.result.code === 0) {
          const phoneNumber = res.result.data.phoneNumber;
          console.log('获取到的手机号：', phoneNumber);
          
          this.setData({
            phoneNumber: phoneNumber
          });
          
          // 使用手机号登录
          this.phoneLogin(phoneNumber);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: (res.result && res.result.msg) || '获取手机号失败',
            icon: 'none',
            duration: 3000
          });
          console.error('获取手机号失败:', res);
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败:', err);
        wx.showToast({
          title: '获取手机号失败: ' + err.errMsg,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 使用手机号登录
  phoneLogin: function(phoneNumber) {
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'phoneLogin',
        data: {
          phoneNumber: phoneNumber
        }
      },
      success: res => {
        wx.hideLoading();
        const result = res.result;
        if (result && result.code === 0) {
          // 清除退出登录标记
          wx.removeStorageSync('hasLogout');
          
          // 登录成功，更新全局数据
          const userData = result.data.userInfo;
          
          app.globalData.isLogin = true;
          app.globalData.userInfo = userData;
          app.globalData.openid = userData.openid;
          app.globalData.isAdmin = userData.role === 'admin';
          
          // 更新本地存储
          wx.setStorageSync('userInfo', userData);
          wx.setStorageSync('loginTime', new Date().getTime());
          
          // 更新页面数据
          this.setData({
            isLogin: true,
            userInfo: userData,
            isAdmin: userData.role === 'admin'
          });
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: result?.msg || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('登录失败', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
  },
});
