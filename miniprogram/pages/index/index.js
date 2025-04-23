// index.js
const common = require('../../utils/common.js');

Page({
  data: {
    cartCount: 0,
    showCart: false,
    cartItems: [],
    specialDish: null,
    recommendDishes: []
  },

  onLoad: function(options) {
    this.getSpecialDish();
    this.getRecommendDishes();
    this.initCartStatus();
    
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.on('dishUpdate', this.handleDishUpdate);
    }
  },

  onShow: function() {
    this.updateCartBadge();
    
    const app = getApp();
    if (app.globalData && app.globalData.showCartOnIndexShow) {
      this.showCartDetail();
      app.globalData.showCartOnIndexShow = false;
    }
  },
  
  onUnload: function() {
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('dishUpdate', this.handleDishUpdate);
    }
  },
  
  handleDishUpdate(data) {
    if (data && (data.type === 'update' || data.type === 'add' || data.type === 'delete')) {
      this.getSpecialDish();
      this.getRecommendDishes();
    }
  },

  async getSpecialDish() {
    try {
      const db = wx.cloud.database();
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

  async getRecommendDishes() {
    try {
      const db = wx.cloud.database();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 获取今天的推荐菜品
      const res = await db.collection('dishes')
        .where({
          isRecommend: true,
          recommendDate: db.command.gte(today)
        })
        .limit(5)
        .get();
      
      if (res.data && res.data.length > 0) {
        this.setData({
          recommendDishes: res.data
        });
      } else {
        // 如果没有今天的推荐菜品，尝试更新
        try {
          await wx.cloud.callFunction({
            name: 'updateDailyRecommend'
          });
          // 重新获取推荐菜品
          const newRes = await db.collection('dishes')
            .where({
              isRecommend: true,
              recommendDate: db.command.gte(today)
            })
            .limit(5)
            .get();
          
          if (newRes.data && newRes.data.length > 0) {
            this.setData({
              recommendDishes: newRes.data
            });
          } else {
            // 如果更新后仍然没有推荐菜品，显示提示
            wx.showToast({
              title: '暂无推荐菜品',
              icon: 'none'
            });
          }
        } catch (err) {
          console.error('更新推荐菜品失败:', err);
          wx.showToast({
            title: '获取推荐菜品失败',
            icon: 'none'
          });
        }
      }
    } catch (err) {
      console.error('获取推荐菜品失败:', err);
      wx.showToast({
        title: '获取推荐菜品失败',
        icon: 'none'
      });
    }
  },

  showCartDetail: function() {
    const cartStatus = common.updateCartStatus();
    
    this.setData({
      cartItems: cartStatus.cartItems,
      cartCount: cartStatus.cartCount,
      showCart: true
    });
  },
  
  hideCartDetail: function() {
    this.setData({
      showCart: false
    });
  },

  removeFromCart(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.removeFromCart(id);
    
    this.setData({
      cartItems: result.cartItems,
      cartCount: result.cartCount
    });
    
    // 如果购物车为空，自动收起弹窗
    if (result.cartItems.length === 0) {
      this.setData({
        showCart: false
      });
    }
  },

  checkout: async function() {
    this.setData({
      showCart: false
    });
    // setTimeout(() => {
    //   // 跳转到订单页面
    //   wx.navigateTo({
    //      url: '/pages/checkout/checkout'
    //   });
    // }, 0);
    
    wx.navigateTo({  
      url: '/pages/checkout/checkout'
    });
  },

  addToCart: async function(e) {
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
      setTimeout(() => {
        this.updateCartBadge();
        
        const cartItems = wx.getStorageSync('cartItems') || [];
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        
        this.setData({
          cartCount: totalItems
        });
      }, 0);
    }
  },
  
  updateCartBadge: function() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  },

  orderNow: async function(e) {
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
      setTimeout(() => {
        this.updateCartBadge();
        
        const cartItems = wx.getStorageSync('cartItems') || [];
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        
        this.setData({
          cartCount: totalItems
        });
      }, 100);
    }
  },

  viewAllRecommends: function() {
    // 关闭购物车弹窗
    this.setData({
      showCart: false
    });
    
    wx.switchTab({
      url: '/pages/menu/menu'
    });
  },

  viewDishDetail: function(e) {
    // 关闭购物车弹窗
    this.setData({
      showCart: false
    });
    
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?id=${id}`
    });
  },

  increaseQuantity: function(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.increaseCartItemQuantity(id);
    
    if (result) {
      // 更新购物车数量和商品列表
      this.setData({
        cartItems: result.cartItems,
        cartCount: result.cartCount
      });
      
      // 直接更新当前项的数量，提供更好的用户反馈
      const index = this.data.cartItems.findIndex(item => item._id === id);
      if (index !== -1) {
        const quantity = this.data.cartItems[index].quantity;
        this.setData({
          ['cartItems[' + index + '].quantity']: quantity
        });
      }
    }
  },
  
  decreaseQuantity: function(e) {
    const id = e.currentTarget.dataset.id;
    const result = common.decreaseCartItemQuantity(id);
    
    if (result) {
      // 更新购物车数量和商品列表
      this.setData({
        cartItems: result.cartItems,
        cartCount: result.cartCount
      });
      
      // 如果商品还存在，直接更新数量
      const index = result.cartItems.findIndex(item => item._id === id);
      if (index !== -1) {
        const quantity = result.cartItems[index].quantity;
        this.setData({
          ['cartItems[' + index + '].quantity']: quantity
        });
      }
      
      // 如果购物车为空，自动收起弹窗
      if (result.cartItems.length === 0) {
        this.setData({
          showCart: false
        });
      }
    }
  },
  
  clearCart: function() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空购物车吗？',
      confirmColor: '#FF6B35',
      success: (res) => {
        if (res.confirm) {
          common.clearCart(() => {
            this.setData({
              cartItems: [],
              cartCount: 0,
              showCart: false
            });
          });
        }
      }
    });
  },

  specialImgTap() {
    if (this.data.specialDish) {
      wx.previewImage({
        urls: [this.data.specialDish.image],
        current: this.data.specialDish.image
      });
    }
  },
  
  viewSpecialDish() {
    if (this.data.specialDish) {
      // 关闭购物车弹窗
      this.setData({
        showCart: false
      });
      
      wx.navigateTo({
        url: `/pages/dish-detail/dish-detail?id=${this.data.specialDish._id}`
      });
    }
  },

  initCartStatus: function() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartItems: cartStatus.cartItems,
      cartCount: cartStatus.cartCount
    });
  },

  onHide: function() {
    // 页面隐藏时关闭购物车弹窗
    this.setData({
      showCart: false
    });
  }
});
