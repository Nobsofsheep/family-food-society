// app.js

// 优化后的事件总线实现
class EventBus {
  constructor() {
    this.events = new Map();
  }
  
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
  }
  
  off(event, callback) {
    if (!this.events.has(event)) return;
    this.events.get(event).delete(callback);
  }
  
  emit(event, data) {
    if (!this.events.has(event)) return;
    this.events.get(event).forEach(callback => callback(data));
  }
}

// 简化的登录状态管理
const LoginManager = {
  EXPIRY_TIME: 7 * 24 * 60 * 60 * 1000, // 7天
  
  clearLoginData() {
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('loginTime');
  },
  
  setLoginData(userInfo) {
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('loginTime', new Date().getTime());
  },
  
  isLoginValid() {
    const userInfo = wx.getStorageSync('userInfo');
    const loginTime = wx.getStorageSync('loginTime');
    const now = new Date().getTime();
    return userInfo && loginTime && (now - loginTime < this.EXPIRY_TIME);
  }
};

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 初始化云开发
    wx.cloud.init({
      env: 'family-menu-01-1gjtmbob2bba8eb5',
      traceUser: true,
    });

    // 初始化全局数据
    this.globalData = {
      userInfo: null,
      systemInfo: null,
      showCartOnIndexShow: false,
      eventBus: new EventBus(),
      openid: '',
      isLogin: false,
      isAdmin: false
    };
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 自动登录
    const hasLogout = wx.getStorageSync('hasLogout');
    if (!hasLogout) {
      this.autoLogin().then(() => {
        // 确保在登录完成后再检查订单监听初始化需求
        if (this.globalData.isAdmin) {
          // 删除订单监听初始化
        }
      }).catch(err => {
        console.error('自动登录失败:', err);
      });
    }
    
    // 检查特色菜品和推荐菜品设置
    this.checkFeatureDishSetting();
    this.checkRecommendDishSetting();
  },
  
  checkLoginStatus: function() {
    if (LoginManager.isLoginValid()) {
      const userInfo = wx.getStorageSync('userInfo');
      this.globalData.isLogin = true;
      this.globalData.userInfo = userInfo;
      this.globalData.openid = userInfo.openid;
      this.globalData.isAdmin = userInfo.role === 'admin';
    } else {
      LoginManager.clearLoginData();
      this.resetLoginState();
    }
  },
  
  resetLoginState() {
    this.globalData.isLogin = false;
    this.globalData.userInfo = null;
    this.globalData.openid = '';
    this.globalData.isAdmin = false;
  },
  
  autoLogin: function() {
    return new Promise((resolve, reject) => {
      const hasLogout = wx.getStorageSync('hasLogout');
      if (hasLogout) {
        return resolve(false);
      }

      wx.showLoading({
        title: '登录中...',
      });

      wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.code === 0 && res.result.data) {
            const userData = res.result.data;
            this.globalData.isLogin = true;
            this.globalData.userInfo = userData;
            this.globalData.openid = userData.openid;
            this.globalData.isAdmin = userData.role === 'admin';
            
            LoginManager.setLoginData(userData);
            
            if (this.globalData.loginStatusCallback) {
              this.globalData.loginStatusCallback(true);
            }
            
            resolve(true);
          } else {
            this.resetLoginState();
            if (this.globalData.loginStatusCallback) {
              this.globalData.loginStatusCallback(false);
            }
            resolve(false);
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('自动登录失败：', err);
          this.resetLoginState();
          if (this.globalData.loginStatusCallback) {
            this.globalData.loginStatusCallback(false);
          }
          reject(err);
        }
      });
    });
  },
  
  async checkFeatureDishSetting() {
    try {
      const autoFeatureDish = wx.getStorageSync('autoFeatureDish') || false;
      if (!autoFeatureDish) return;
      
      const db = wx.cloud.database();
      const featureResult = await db.collection('dishes')
        .where({
          isFeature: true
        })
        .get();
      
      if (!featureResult.data || featureResult.data.length === 0) {
        const dishesResult = await db.collection('dishes').get();
        if (dishesResult.data && dishesResult.data.length > 0) {
          const randomIndex = Math.floor(Math.random() * dishesResult.data.length);
          const selectedDish = dishesResult.data[randomIndex];
          
          if (selectedDish) {
            await db.collection('dishes').doc(selectedDish._id).update({
              data: {
                isFeature: true,
                updateTime: new Date()
              }
            });
            
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
  
  async checkRecommendDishSetting() {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 获取今天的推荐菜品
      const todayRecommendResult = await db.collection('dishes')
        .where({
          isRecommend: true,
          recommendDate: _.gte(today)
        })
        .get();
      
      // 如果今天已经有推荐菜品，则不再更新
      if (todayRecommendResult.data && todayRecommendResult.data.length > 0) {
        return;
      }
      
      // 获取昨天的推荐菜品ID
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayRecommendResult = await db.collection('dishes')
        .where({
          isRecommend: true,
          recommendDate: _.gte(yesterday).and(_.lt(today))
        })
        .get();
      
      const yesterdayRecommendIds = yesterdayRecommendResult.data 
        ? yesterdayRecommendResult.data.map(dish => dish._id) 
        : [];
      
      // 获取所有非自定义且非昨天推荐的菜品
      const dishesResult = await db.collection('dishes')
        .where({
          isCustom: _.neq(true),
          _id: _.nin(yesterdayRecommendIds)
        })
        .get();
      
      if (dishesResult.data && dishesResult.data.length > 0) {
        // 先清除所有推荐菜品的标记
        const allRecommendResult = await db.collection('dishes')
          .where({
            isRecommend: true
          })
          .get();

        if (allRecommendResult.data) {
          for (const dish of allRecommendResult.data) {
            await db.collection('dishes').doc(dish._id).update({
              data: {
                isRecommend: false,
                recommendDate: null
              }
            });
          }
        }

        // 随机选择5个菜品
        const selectedDishes = [];
        const availableDishes = [...dishesResult.data];
        const recommendCount = Math.min(5, availableDishes.length);
        
        for (let i = 0; i < recommendCount; i++) {
          const randomIndex = Math.floor(Math.random() * availableDishes.length);
          selectedDishes.push(availableDishes[randomIndex]);
          availableDishes.splice(randomIndex, 1);
        }
        
        // 更新选中的菜品为推荐菜品
        for (const dish of selectedDishes) {
          await db.collection('dishes').doc(dish._id).update({
            data: {
              isRecommend: true,
              recommendDate: today,
              updateTime: new Date()
            }
          });
        }
        
        // 发送更新事件
        if (this.globalData.eventBus) {
          this.globalData.eventBus.emit('dishUpdate', { 
            type: 'recommendUpdate',
            ids: selectedDishes.map(dish => dish._id),
            date: today
          });
        }

        // 更新自动推荐设置状态
        wx.setStorageSync('lastRecommendDate', today.getTime());
      }
    } catch (err) {
      console.error('设置推荐菜品失败：', err);
      // 出错时也通知UI更新
      if (this.globalData.eventBus) {
        this.globalData.eventBus.emit('dishUpdate', { 
          type: 'recommendError',
          error: err
        });
      }
    }
  },
  
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
  
  login: function(userInfo) {
    wx.removeStorageSync('hasLogout');
    
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('loginTime', new Date().getTime());
    
    this.globalData.isLogin = true;
    this.globalData.userInfo = userInfo;
    this.globalData.openid = userInfo.openid;
    this.globalData.isAdmin = userInfo.role === 'admin';

    // 删除订单监听初始化

    if (this.globalData.loginStatusCallback) {
      this.globalData.loginStatusCallback(true);
    }
  },
  
  logout: function() {
    wx.setStorageSync('hasLogout', true);
    
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('loginTime');
    
    this.globalData.isLogin = false;
    this.globalData.userInfo = null;
    this.globalData.openid = '';
    this.globalData.isAdmin = false;

    // 删除关闭订单监听代码

    if (this.globalData.loginStatusCallback) {
      this.globalData.loginStatusCallback(false);
    }
  },

  // 删除整个initOrderListener函数

  // 删除onHide函数中的订单监听器相关代码
  onHide() {
    // 删除订单监听器相关代码
  },

  // 删除onShow函数中的订单监听器相关代码
  onShow() {
    // 删除订单监听器相关代码
  },

  // 手动设置推荐菜品
  async setDishRecommend(dishId, isRecommend) {
    try {
      const db = wx.cloud.database();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isRecommend) {
        // 获取当前推荐菜品数量
        const currentRecommendResult = await db.collection('dishes')
          .where({
            isRecommend: true,
            recommendDate: db.command.gte(today)
          })
          .count();

        // 如果已经有5个推荐菜品，不允许再添加
        if (currentRecommendResult.total >= 5) {
          throw new Error('今日推荐菜品已达上限（5个）');
        }
      }

      // 更新菜品推荐状态
      await db.collection('dishes').doc(dishId).update({
        data: {
          isRecommend: isRecommend,
          recommendDate: isRecommend ? today : null,
          updateTime: new Date()
        }
      });

      // 发送更新事件
      if (this.globalData.eventBus) {
        this.globalData.eventBus.emit('dishUpdate', {
          type: 'recommendUpdate',
          id: dishId,
          isRecommend: isRecommend,
          date: today
        });
      }

      return {
        code: 0,
        msg: isRecommend ? '设置推荐成功' : '取消推荐成功'
      };
    } catch (err) {
      console.error('设置推荐菜品失败：', err);
      throw err;
    }
  }
});

