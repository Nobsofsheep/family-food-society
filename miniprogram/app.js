// app.js

// 引入一个简单的事件总线，用于全局通信
class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }
  
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

App({
  onLaunch: function () {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'family-menu-01-1gjtmbob2bba8eb5',
        traceUser: true,
      })
    }

    // 修复 __route__ 未定义错误
    if (typeof __route__ === 'undefined') {
      global.__route__ = '';
    }
    
    // 初始化事件总线
    this.globalData = {
      userInfo: null,
      systemInfo: null,
      showCartOnIndexShow: false,
      eventBus: new EventBus(),
      openid: '',
      isLogin: false,
      isAdmin: false
    };
    
    // 检查用户登录状态
    this.checkLoginStatus();
    
    // 检查特色菜品和推荐菜品设置
    this.checkFeatureDishSetting();
    this.checkRecommendDishSetting();
  },
  
  // 检查用户登录状态
  checkLoginStatus: function() {
    // 从本地存储中获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userInfo) {
      this.globalData.isLogin = true;
      this.globalData.userInfo = userInfo;
      this.globalData.openid = userInfo.openid;
      this.globalData.isAdmin = userInfo.role === 'admin';
    }
  },
  
  // 检查特色菜品设置
  async checkFeatureDishSetting() {
    try {
      // 检查是否开启了自动设置今日特色
      const autoFeatureDish = wx.getStorageSync('autoFeatureDish') || false;
      if (!autoFeatureDish) return;
      
      // 查询是否已有特色菜品
      const db = wx.cloud.database();
      const featureResult = await db.collection('dishes')
        .where({
          isFeature: true
        })
        .get();
      
      // 如果没有特色菜品，则自动随机设置一个
      if (!featureResult.data || featureResult.data.length === 0) {
        // 获取所有菜品
        const dishesResult = await db.collection('dishes').get();
        if (dishesResult.data && dishesResult.data.length > 0) {
          // 随机选择一个菜品作为特色菜品
          const randomIndex = Math.floor(Math.random() * dishesResult.data.length);
          const selectedDish = dishesResult.data[randomIndex];
          
          if (selectedDish) {
            // 设置为特色菜品
            await db.collection('dishes').doc(selectedDish._id).update({
              data: {
                isFeature: true,
                updateTime: new Date()
              }
            });
            
            console.log('自动设置今日特色菜品成功');
            
            // 触发菜品更新事件
            if (this.globalData.eventBus) {
              this.globalData.eventBus.emit('dishUpdate', { 
                type: 'update',
                id: selectedDish._id
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('检查特色菜品设置失败：', err);
    }
  },
  
  // 检查推荐菜品设置
  async checkRecommendDishSetting() {
    try {
      // 检查是否开启了自动设置今日推荐
      const autoRecommendDish = wx.getStorageSync('autoRecommendDish') || false;
      if (!autoRecommendDish) return;
      
      // 查询是否已有推荐菜品
      const db = wx.cloud.database();
      const recommendResult = await db.collection('dishes')
        .where({
          isRecommended: true
        })
        .get();
      
      // 如果推荐菜品少于2个，则自动随机设置
      if (!recommendResult.data || recommendResult.data.length < 3) {
        // 获取所有非推荐的菜品
        const notRecommendedResult = await db.collection('dishes')
          .where({
            isRecommended: db.command.neq(true)
          })
          .get();
        
        if (notRecommendedResult.data && notRecommendedResult.data.length > 0) {
          // 需要设置的推荐菜品数量 (最多2个)
          const neededCount = Math.min(3 - (recommendResult.data ? recommendResult.data.length : 0), notRecommendedResult.data.length);
          
          if (neededCount > 0) {
            // 随机选择菜品
            const availableDishes = [...notRecommendedResult.data];
            
            for (let i = 0; i < neededCount; i++) {
              if (availableDishes.length === 0) break;
              
              const randomIndex = Math.floor(Math.random() * availableDishes.length);
              const selectedDish = availableDishes[randomIndex];
              
              // 从可用列表中移除已选择的菜品
              availableDishes.splice(randomIndex, 1);
              
              if (selectedDish) {
                // 设置为推荐菜品
                await db.collection('dishes').doc(selectedDish._id).update({
                  data: {
                    isRecommended: true,
                    updateTime: new Date()
                  }
                });
                
                console.log('自动设置今日推荐菜品成功');
                
                // 触发菜品更新事件
                if (this.globalData.eventBus) {
                  this.globalData.eventBus.emit('dishUpdate', { 
                    type: 'update',
                    id: selectedDish._id
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('检查推荐菜品设置失败：', err);
    }
  },
  
  // 当用户未登录时调用此方法，提示登录
  showLoginTip: function(callback) {
    wx.showModal({
      title: '提示',
      content: '您尚未登录，请先登录',
      confirmText: '去登录',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/settings/settings'
          });
        } else if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },
  
  // 退出登录
  logout() {
    // 清除登录状态
    this.globalData.isLogin = false;
    this.globalData.userInfo = null;
    
    // 清除本地存储
    wx.removeStorageSync('userInfo');
    
    // 调用登录状态变化回调
    if (this.globalData.loginStatusCallback) {
      this.globalData.loginStatusCallback(false);
    }
    
    // 返回首页
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
