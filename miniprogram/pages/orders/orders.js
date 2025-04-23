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
    isLogin: false,  // 添加登录状态标记
    isAdmin: false,  // 添加管理员状态标记
    pullDownRefreshing: false, // 下拉刷新状态
    refreshLock: false, // 刷新锁
    lastRefreshTime: 0 // 最后刷新时间
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 监听登录状态变化
    app.globalData.loginStatusCallback = (isLogin) => {
      this.setData({
        isLogin: isLogin,
        isAdmin: app.globalData.isAdmin
      });
      if (isLogin) {
        this.getOrders();
      }
    };
    
    // 监听订单更新事件
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.on('orderUpdate', this.handleOrderUpdate);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 添加刷新频率限制，避免频繁刷新
    const now = Date.now();
    const REFRESH_THRESHOLD = 30 * 1000; // 30秒内不重复刷新
    
    if (!this.data.refreshLock && (now - this.data.lastRefreshTime > REFRESH_THRESHOLD)) {
      this.getOrders();
    }
  },
  
  /**
   * 监听页面卸载
   */
  onUnload() {
    // 移除订单更新事件监听
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('orderUpdate', this.handleOrderUpdate);
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ pullDownRefreshing: true });
    
    // 清除缓存，强制刷新
    const isAdmin = app.globalData.isAdmin;
    const openid = app.globalData.openid;
    const cacheKey = `orders_${isAdmin ? 'admin' : openid}`;
    wx.removeStorageSync(cacheKey);
    
    this.getOrders(() => {
      wx.stopPullDownRefresh();
      this.setData({ pullDownRefreshing: false });
    });
  },
  
  // 处理订单更新事件
  handleOrderUpdate() {
    const now = Date.now();
    const REFRESH_THRESHOLD = 5 * 1000; // 5秒钟内不重复刷新
    
    if (!this.data.refreshLock && (now - this.data.lastRefreshTime > REFRESH_THRESHOLD)) {
      // 清除订单缓存
      const isAdmin = app.globalData.isAdmin;
      const openid = app.globalData.openid;
      const cacheKey = `orders_${isAdmin ? 'admin' : openid}`;
      wx.removeStorageSync(cacheKey);
      
      // 获取最新订单
      this.getOrders();
    }
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
  getOrders(callback) {
    // 如果有刷新锁或已经在加载中，直接返回
    if (this.data.refreshLock || (this.data.loading && !this.data.pullDownRefreshing)) {
      if (callback) callback();
      return;
    }
    
    this.setData({ 
      loading: true,
      refreshLock: true
    });
    
    // 设置刷新锁，避免短时间内重复请求
    setTimeout(() => {
      this.setData({ refreshLock: false });
    }, 2000); // 减少到3秒内不允许重复刷新
    
    const isAdmin = app.globalData.isAdmin;
    const openid = app.globalData.openid;
    
    // 先从缓存加载数据，提供快速显示
    const cacheKey = `orders_${isAdmin ? 'admin' : openid}`;
    const cachedOrders = wx.getStorageSync(cacheKey);
    
    if (cachedOrders && cachedOrders.time) {
      const now = Date.now();
      const CACHE_DURATION = 3 * 60 * 1000; // 3分钟缓存
      
      if (now - cachedOrders.time < CACHE_DURATION) {
        // 使用缓存数据快速渲染
        this.setData({
          orders: cachedOrders.orders,
          groupedOrders: cachedOrders.groupedOrders,
          dateKeys: cachedOrders.dateKeys,
          loading: false,
          lastRefreshTime: now
        });
        
        if (callback) callback();
      }
    }
    
    // 调用云函数获取最新订单
    wx.cloud.callFunction({
      name: 'order',
      data: {
        action: isAdmin ? 'getAllOrders' : 'getUserOrders',
        data: {
          openid: openid
        }
      },
      success: res => {
        console.log('获取订单成功: ', res);
        
        if (res.result && res.result.code === 0) {
          // 格式化每个订单的时间
          const orders = res.result.data.map(order => {
            if (order.formattedTime) {
              order.createTime = order.formattedTime;
            } else if (order.createTime) {
              order.createTime = common.formatDateTime(order.createTime);
            }
            return order;
          });
          
          // 按日期分组订单
          const { grouped, dateKeys } = this.groupOrdersByDate(orders);
          
          // 保存到缓存
          const now = Date.now();
          wx.setStorageSync(cacheKey, {
            time: now,
            orders: orders,
            groupedOrders: grouped,
            dateKeys: dateKeys
          });
          
          this.setData({
            orders: orders,
            groupedOrders: grouped,
            dateKeys: dateKeys,
            loading: false,
            lastRefreshTime: now
          });
        } else {
          this.setData({ 
            loading: false,
            lastRefreshTime: Date.now()
          });
          wx.showToast({
            title: res.result?.msg || '获取订单失败',
            icon: 'none'
          });
        }
        
        if (callback) callback();
      },
      fail: err => {
        console.error('获取订单失败: ', err);
        this.setData({ 
          loading: false,
          lastRefreshTime: Date.now()
        });
        
        wx.showToast({
          title: '获取订单失败',
          icon: 'none'
        });
        
        if (callback) callback();
      }
    });
  },

  // 使用节流处理的删除订单函数
  deleteOrder: common.throttle(function(e) {
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
  }),

  // 跳转到菜单页
  goToMenu() {
    wx.switchTab({
      url: '/pages/menu/menu'
    });
  },

  // 跳转到登录页
  goToLogin() {
    wx.navigateTo({
      url: '/pages/account/account'
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    const isAdmin = app.globalData.isAdmin;
    
    this.setData({
      isLogin,
      isAdmin
    });
    
    if (isLogin) {
      this.getOrders();
    }
  },

  // 接受订单（管理员功能），使用节流
  acceptOrder: common.throttle(function(e) {
    const index = e.currentTarget.dataset.index;
    const dateKey = e.currentTarget.dataset.datekey;
    const orderId = this.data.groupedOrders[dateKey][index]._id;
    
    if (!orderId) {
      wx.showToast({
        title: '无法接受该订单',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '处理中...',
    });
    
    wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'acceptOrder',
        data: {
          orderId: orderId
        }
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.code === 0) {
          let groupedOrders = this.data.groupedOrders;
          groupedOrders[dateKey][index].status = '处理中';
          
          this.setData({
            groupedOrders
          });
          
          wx.showToast({
            title: '已接单',
            icon: 'success'
          });
          
          // 触发订单更新事件
          if (app.globalData && app.globalData.eventBus) {
            app.globalData.eventBus.emit('orderUpdate', {
              type: 'status',
              id: orderId,
              status: '处理中'
            });
          }
        } else {
          wx.showToast({
            title: res.result?.msg || '接单失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('接单失败: ', err);
        
        wx.showToast({
          title: '接单失败',
          icon: 'none'
        });
      }
    });
  }),

  // 完成订单（管理员功能），使用节流
  completeOrder: common.throttle(function(e) {
    const index = e.currentTarget.dataset.index;
    const dateKey = e.currentTarget.dataset.datekey;
    const orderId = this.data.groupedOrders[dateKey][index]._id;
    
    if (!orderId) {
      wx.showToast({
        title: '无法完成该订单',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '处理中...',
    });
    
    wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'completeOrder',
        data: {
          orderId: orderId
        }
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.code === 0) {
          let groupedOrders = this.data.groupedOrders;
          groupedOrders[dateKey][index].status = '已完成';
          
          this.setData({
            groupedOrders
          });
          
          wx.showToast({
            title: '已完成',
            icon: 'success'
          });
          
          // 触发订单更新事件
          if (app.globalData && app.globalData.eventBus) {
            app.globalData.eventBus.emit('orderUpdate', {
              type: 'status',
              id: orderId,
              status: '已完成'
            });
          }
        } else {
          wx.showToast({
            title: res.result?.msg || '操作失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('完成订单失败: ', err);
        
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        });
      }
    });
  })
});
