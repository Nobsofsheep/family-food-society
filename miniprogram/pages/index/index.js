// 修复后的index.js文件
// 修复购物车数据不一致问题，统一使用_id和quantity字段

// 引入公共工具函数
const common = require('../../utils/common.js');

Page({
  // 页面的初始数据
  data: {
    // 购物车数量
    cartCount: 0,
    // 是否显示购物车详情
    showCart: false,
    // 购物车商品列表
    cartItems: [],
    // 今日特色菜品
    specialDish: null,
    // 推荐菜品列表
    recommendDishes: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    // 获取今日特色和推荐菜品
    this.getSpecialDish();
    this.getRecommendDishes();
    
    // 初始化购物车状态
    this.initCartStatus();
    
    // 监听菜品更新事件
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.on('dishUpdate', this.handleDishUpdate);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function() {
    // 每次页面显示时更新购物车状态
    this.initCartStatus();
    
    // 检查是否需要显示购物车
    const app = getApp();
    if (app.globalData && app.globalData.showCartOnIndexShow) {
      this.showCartDetail();
      app.globalData.showCartOnIndexShow = false;
    }
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    // 移除事件监听
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('dishUpdate', this.handleDishUpdate);
    }
  },
  
  /**
   * 处理菜品更新事件
   */
  handleDishUpdate(data) {
    if (data && (data.type === 'update' || data.type === 'add' || data.type === 'delete')) {
      // 刷新今日特色菜品
      this.getSpecialDish();
      // 刷新今日推荐菜品
      this.getRecommendDishes();
    }
  },

  // 获取今日特色菜品
  async getSpecialDish() {
    try {
      const db = wx.cloud.database();
      // 获取标记为特色菜的菜品
      const res = await db.collection('dishes')
        .where({
          isFeature: true
        })
        .limit(1)
        .get();
      
      if (res.data && res.data.length > 0) {
        this.setData({
          specialDish: res.data[0]
        });
      } else {
        // 如果没有标记为特色的菜品，随机获取一个
        const randomRes = await db.collection('dishes')
          .limit(1)
          .get();
        
        if (randomRes.data && randomRes.data.length > 0) {
          this.setData({
            specialDish: randomRes.data[0]
          });
        }
      }
    } catch (err) {
      console.error('获取今日特色失败:', err);
    }
  },

  // 获取推荐菜品
  async getRecommendDishes() {
    try {
      const db = wx.cloud.database();
      // 获取标记为推荐的菜品
      const res = await db.collection('dishes')
        .where({
          isRecommended: true
        })
        .limit(2)
        .get();
      
      if (res.data && res.data.length > 0) {
        this.setData({
          recommendDishes: res.data
        });
      } else {
        // 如果没有推荐菜品，随机获取2个
        const randomRes = await db.collection('dishes')
          .limit(2)
          .get();
        
        if (randomRes.data && randomRes.data.length > 0) {
          this.setData({
            recommendDishes: randomRes.data
          });
        }
      }
    } catch (err) {
      console.error('获取推荐菜品失败:', err);
    }
  },

  // 展示购物车详情
  showCartDetail: function() {
    // 从存储中获取最新的购物车数据
    const cartItems = wx.getStorageSync('cartItems') || [];
    
    this.setData({
      cartItems: cartItems,
      showCart: true
    });
  },
  
  // 隐藏购物车详情
  hideCartDetail: function() {
    this.setData({
      showCart: false
    });
  },

  // 从购物车中移除商品
  removeFromCart(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.removeFromCart(id);
    
    this.setData({
      cartItems: result.cartItems,
      cartCount: result.cartCount
    });
  },

  // 结算购物车
  checkout: async function() {
    // 先收起购物车弹窗
    this.setData({
      showCart: false
    });
    
    // 跳转到结算页面
    wx.navigateTo({
      url: '/pages/checkout/checkout'
    });
  },

  // 添加到购物车
  addToCart: async function(e) {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.globalData.isLogin) {
      app.showLoginTip();
      return;
    }
    
    const dish = {
      _id: e.currentTarget.dataset.id,
      name: e.currentTarget.dataset.name,
      image: e.currentTarget.dataset.image
    };
    
    if (common.addToCart(dish)) {
      // 更新购物车角标数量
      this.updateCartBadge();
    }
  },
  
  // 更新购物车角标
  updateCartBadge: function() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount
    });
  },

  // 立即下单
  orderNow: async function(e) {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.globalData.isLogin) {
      app.showLoginTip();
      return;
    }
    
    const dish = {
      _id: e.currentTarget.dataset.id,
      name: e.currentTarget.dataset.name,
      image: e.currentTarget.dataset.image
    };
    
    if (common.addToCart(dish)) {
      // 更新购物车角标数量
      this.updateCartBadge();
      
      // 延迟跳转到结算页面，让用户看到添加成功的提示
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/checkout/checkout'
        });
      }, 1000);
    }
  },

  // 查看全部推荐菜品
  viewAllRecommends: function() {
    wx.switchTab({
      url: '/pages/menu/menu'
    });
  },

  // 查看菜品详情
  viewDishDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?id=${id}`
    });
  },

  // 增加购物车商品数量
  increaseQuantity: function(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.increaseCartItemQuantity(id);
    
    if (result) {
      this.setData({
        cartItems: result.cartItems,
        cartCount: result.cartCount
      });
    }
  },
  
  // 减少购物车商品数量
  decreaseQuantity: function(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.decreaseCartItemQuantity(id);
    
    if (result) {
      this.setData({
        cartItems: result.cartItems,
        cartCount: result.cartCount
      });
    }
  },
  
  // 清空购物车
  clearCart: function() {
    common.clearCart(() => {
      this.setData({
        cartItems: [],
        cartCount: 0,
        showCart: false // 清空后自动关闭购物车弹窗
      });
    });
  },

  // 特色菜品图片点击效果
  specialImgTap() {
    // 如果有特色菜，处理图片预览
    if (this.data.specialDish) {
      // 使用图片预览API让用户预览图片
      wx.previewImage({
        urls: [this.data.specialDish.image],
        current: this.data.specialDish.image,
        success: () => {
          console.log('特色菜品图片预览成功');
        }
      });
    }
  },
  
  // 点击特色菜品区域
  viewSpecialDish() {
    if (this.data.specialDish) {
      wx.navigateTo({
        url: `/pages/dish-detail/dish-detail?id=${this.data.specialDish._id}`
      });
    }
  },

  // 初始化购物车状态
  initCartStatus: function() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartItems: cartStatus.cartItems,
      cartCount: cartStatus.cartCount
    });
  }
});
