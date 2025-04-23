// 修复后的checkout.js文件
// 使用公共工具函数，添加登录状态检查

// 引入公共工具函数
const common = require('../../utils/common.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    cartItems: [],
    note: '',
    loading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查登录状态
    this.checkLoginStatus();
    // 加载购物车商品
    this.loadCartItems();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 检查登录状态
    this.checkLoginStatus();
    // 每次页面显示时重新加载购物车数据
    this.loadCartItems();
  },

  // 检查登录状态
  checkLoginStatus() {
    if (!common.checkLoginStatus()) {
      common.showLoginTip(() => {
        wx.navigateBack();
      });
    }
  },

  // 加载购物车商品
  loadCartItems() {
    const cartItems = wx.getStorageSync('cartItems') || [];
    
    if (cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        }
      });
      return;
    }
    
    this.setData({
      cartItems
    });
  },

  // 输入备注
  onNoteInput(e) {
    // 添加输入验证，限制长度
    const note = e.detail.value.slice(0, 100); // 限制备注最多100字
    this.setData({
      note
    });
  },

  // 提交订单
  submitOrder() {
    if (this.data.loading) return;
    
    if (this.data.cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ loading: true });
    
    // 先获取用户信息，确保有用户昵称
    this.getUserInfo().then(userInfo => {
      // 使用公共函数格式化时间
      const now = new Date();
      const formattedTime = common.formatDateTime(now);
      
      // 创建订单对象
      const order = {
        dishes: this.data.cartItems,
        note: this.data.note,
        status: '待处理',
        createTime: now,
        formattedTime: formattedTime,
        orderNumber: 'DD' + new Date().getTime(),
        openid: userInfo.openid, // 设置用户openid
        nickname: userInfo.nickname // 直接设置用户昵称
      };
      
      // 将订单保存到云数据库
      const db = wx.cloud.database();
      
      db.collection('orders').add({
        data: order,
        success: res => {
          console.log('订单提交成功，订单ID:', res._id);
          
          // 清空购物车
          wx.setStorageSync('cartItems', []);
          
          this.setData({ loading: false });
          
          wx.showToast({
            title: '下单成功',
            icon: 'success',
            duration: 500,
            success: () => {
              setTimeout(() => {
                // 跳转到订单页面
                wx.switchTab({
                  url: '/pages/orders/orders'
                });
              }, 500);
            }
          });
        },
        fail: err => {
          console.error('订单提交失败：', err);
          this.setData({ loading: false });
          
          wx.showToast({
            title: '提交失败，请重试',
            icon: 'none'
          });
        }
      });
    }).catch(err => {
      console.error('获取用户信息失败:', err);
      this.setData({ loading: false });
      
      wx.showToast({
        title: '无法获取用户信息，请重试',
        icon: 'none'
      });
    });
  },
  
  // 获取用户信息（包含openid和昵称）
  getUserInfo() {
    return new Promise((resolve, reject) => {
      const app = getApp();
      
      // 如果全局数据中已有用户信息且有昵称，直接使用
      if (app.globalData && app.globalData.userInfo && 
          app.globalData.openid && app.globalData.userInfo.nickname) {
        resolve({
          openid: app.globalData.openid,
          nickname: app.globalData.userInfo.nickname
        });
        return;
      }
      
      // 否则从云端获取用户信息
      wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        },
        success: res => {
          console.log('获取用户信息成功:', res.result);
          
          if (res.result && res.result.code === 0 && res.result.data) {
            const userData = res.result.data;
            const userInfo = {
              openid: userData.openid,
              nickname: userData.nickname || '用户' // 提供兜底值
            };
            
            // 更新全局数据
            if (app.globalData) {
              app.globalData.openid = userInfo.openid;
              app.globalData.userInfo = app.globalData.userInfo || {};
              app.globalData.userInfo.nickname = userInfo.nickname;
            }
            
            resolve(userInfo);
          } else {
            reject(new Error('用户信息不完整'));
          }
        },
        fail: err => {
          console.error('调用云函数获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  }
});
