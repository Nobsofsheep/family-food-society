// 修复后的orders.js文件
// 使用公共工具函数，修复日期格式化和订单删除功能

// 引入公共工具函数
const app = getApp();
const common = require('../../utils/common.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    orders: [],
    groupedOrders: {},
    dateKeys: [],
    loading: false,
    isLogin: false  // 添加登录状态标记
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.getOrders();
    wx.stopPullDownRefresh();
  },

  // 将订单按日期分组
  groupOrdersByDate(orders) {
    const grouped = {};
    
    orders.forEach(order => {
      const dateKey = common.getDateKey(order.createTime);
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(order);
    });
    
    // 提取日期键并按时间降序排序
    const dateKeys = Object.keys(grouped).sort((a, b) => {
      // 这里简单处理，因为日期格式是统一的，可以直接字符串比较
      return b.localeCompare(a);
    });
    
    return { grouped, dateKeys };
  },

  // 从云数据库获取订单数据
  getOrders() {
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    
    // 获取当前用户的openid
    const openid = app.globalData && app.globalData.openid ? app.globalData.openid : '';
    
    // 如果没有openid，先获取openid
    if (!openid) {
      wx.cloud.callFunction({
        name: 'login',
        data: {},
        success: res => {
          console.log('云函数获取到的openid: ', res.result.openid);
          
          // 保存openid到全局数据
          if (app.globalData) {
            app.globalData.openid = res.result.openid;
          }
          
          // 获取该用户的订单
          this.fetchOrdersByOpenid(res.result.openid);
        },
        fail: err => {
          console.error('获取openid失败', err);
          this.setData({ loading: false });
          
          wx.showToast({
            title: '获取订单失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 已有openid，直接获取订单
      this.fetchOrdersByOpenid(openid);
    }
  },
  
  // 根据openid获取订单
  fetchOrdersByOpenid(openid) {
    const db = wx.cloud.database();
    
    db.collection('orders')
      .where({
        openid: openid
      })
      .orderBy('createTime', 'desc')
      .get({
        success: res => {
          console.log('获取订单成功: ', res.data);
          
          // 格式化每个订单的时间
          const orders = res.data.map(order => {
            if (order.formattedTime) {
              order.createTime = order.formattedTime;
            } else if (order.createTime) {
              order.createTime = common.formatDateTime(order.createTime);
            }
            return order;
          });
          
          // 按日期分组订单
          const { grouped, dateKeys } = this.groupOrdersByDate(orders);
          
          this.setData({
            orders: orders,
            groupedOrders: grouped,
            dateKeys: dateKeys,
            loading: false
          });
        },
        fail: err => {
          console.error('获取订单失败: ', err);
          this.setData({ loading: false });
          
          wx.showToast({
            title: '获取订单失败',
            icon: 'none'
          });
        }
      });
  },

  // 删除订单
  deleteOrder(e) {
    const index = e.currentTarget.dataset.index;
    const dateKey = e.currentTarget.dataset.datekey;
    const orderId = this.data.groupedOrders[dateKey][index]._id;
    
    if (!orderId) {
      wx.showToast({
        title: '无法删除该订单',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // 显示加载中
          wx.showLoading({
            title: '删除中...',
          });
          
          // 调用云函数删除订单
          wx.cloud.callFunction({
            name: 'order',
            data: {
              action: 'deleteOrder',
              data: {
                orderId: orderId
              }
            },
            success: res => {
              wx.hideLoading();
              
              if (res.result && res.result.code === 0) {
                console.log('删除订单成功: ', res);
                
                // 获取当前分组订单列表
                let groupedOrders = this.data.groupedOrders;
                
                // 移除指定订单
                groupedOrders[dateKey].splice(index, 1);
                
                // 如果分组为空，删除该分组
                if (groupedOrders[dateKey].length === 0) {
                  let dateKeys = this.data.dateKeys;
                  dateKeys = dateKeys.filter(key => key !== dateKey);
                  delete groupedOrders[dateKey];
                  
                  this.setData({
                    groupedOrders,
                    dateKeys
                  });
                } else {
                  this.setData({
                    groupedOrders
                  });
                }
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result?.msg || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('删除订单失败: ', err);
              
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 前往菜单页面
  goToMenu() {
    wx.switchTab({
      url: '/pages/menu/menu'
    });
  },

  // 前往登录页面
  goToLogin() {
    wx.switchTab({
      url: '/pages/settings/settings'
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    // 从全局数据获取登录状态
    const isLogin = common.checkLoginStatus();
    
    this.setData({
      isLogin: isLogin
    });
    
    if (isLogin) {
      this.getOrders();
    }
  }
});
