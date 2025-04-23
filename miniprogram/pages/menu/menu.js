// menu.js
const common = require('../../utils/common.js');

Page({
  data: {
    activeTab: 'all',
    categories: [],
    selectedCategory: '',
    dishes: [],
    loading: false,
    cartCount: 0,
    showCart: false,
    cartItems: [],
    hasMore: true,
    page: 0,
    pageSize: 20,
    loadingMore: false,
    hasCache: false,
    lastCacheTime: 0
  },

  onLoad: function(options) {
    this.getCategories();
    this.initCartStatus();
    
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.on('dishUpdate', this.handleDishUpdate);
      app.globalData.eventBus.on('categoryUpdate', this.handleCategoryUpdate);
    }
  },

  onShow() {
    this.updateCartStatus();
    
    const now = Date.now();
    const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存
    
    if (!this.data.categories.length) {
      this.getCategories();
    } else if (!this.data.dishes.length || !this.data.hasCache || now - this.data.lastCacheTime > CACHE_DURATION) {
      this.getDishes();
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('dishUpdate', this.handleDishUpdate);
      app.globalData.eventBus.off('categoryUpdate', this.handleCategoryUpdate);
    }
  },

  onHide() {
    // 页面隐藏时关闭购物车弹窗
    this.setData({
      showCart: false
    });
  },

  async getCategories() {
    try {
      const db = wx.cloud.database();
      
      const cachedCategories = wx.getStorageSync('categories');
      const now = Date.now();
      const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存
      
      if (cachedCategories && cachedCategories.time && now - cachedCategories.time < CACHE_DURATION) {
        console.log('使用缓存的分类数据');
        const firstCategory = cachedCategories.data[0]._id;
        this.setData({
          categories: cachedCategories.data,
          selectedCategory: firstCategory
        }, () => {
          this.getDishes();
        });
        return;
      }
      
      const result = await db.collection('categories')
        .orderBy('order', 'asc')
        .get();
      
      if (result.data && result.data.length > 0) {
        wx.setStorageSync('categories', {
          data: result.data,
          time: now
        });
        
        const firstCategory = result.data[0]._id;
        this.setData({
          categories: result.data,
          selectedCategory: firstCategory
        }, () => {
          this.getDishes();
        });
      } else {
        wx.showToast({
          title: '暂无分类数据',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('获取分类失败：', err);
      wx.showToast({
        title: '获取分类失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  changeTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    this.getDishes();
  },

  selectCategory: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      selectedCategory: categoryId
    });
    this.getDishes();
  },

  async getDishes() {
    try {
      this.setData({ 
        loading: true,
        page: 0,
        dishes: [],
        hasMore: true 
      });
      
      await this.loadMoreDishes();
    } catch (err) {
      console.error('获取菜品失败：', err);
      wx.showToast({
        title: '获取菜品失败',
        icon: 'none'
      });
      this.setData({ 
        loading: false,
        loadingMore: false 
      });
    }
  },

  async loadMoreDishes() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return;
    }

    try {
      this.setData({ loadingMore: true });
      
      const db = wx.cloud.database();
      const _ = db.command;
      const pageSize = this.data.pageSize;
      const skip = this.data.page * pageSize;
      
      let query = {};
      
      if (this.data.activeTab === 'new') {
        query.isNew = true;
      }
      
      if (this.data.selectedCategory) {
        query.categoryId = this.data.selectedCategory;
      }
      
      const cacheKey = `dishes_${this.data.activeTab}_${this.data.selectedCategory}_${this.data.page}`;
      const cachedResult = wx.getStorageSync(cacheKey);
      const now = Date.now();
      const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
      
      let newDishes = [];
      
      if (cachedResult && cachedResult.time && now - cachedResult.time < CACHE_DURATION) {
        console.log(`使用缓存的菜品数据: ${cacheKey}`);
        newDishes = cachedResult.data;
      } else {
        let topDishes = { data: [] };
        if (this.data.page === 0) {
          topDishes = await db.collection('dishes')
            .where({
              ...query,
              isTop: true
            })
            .get();
        }
        
        const normalDishes = await db.collection('dishes')
          .where({
            ...query,
            isTop: _.neq(true)
          })
          .skip(skip)
          .limit(pageSize)
          .get();
        
        newDishes = [...(topDishes.data || []), ...(normalDishes.data || [])];
        
        wx.setStorageSync(cacheKey, {
          data: newDishes,
          time: now
        });
      }
      
      const allDishes = [...this.data.dishes, ...newDishes];
      
      if (this.data.page === 0) {
        allDishes.sort((a, b) => {
          if (a.isTop && !b.isTop) return -1;
          if (!a.isTop && b.isTop) return 1;
          
          if ((!a.order && a.createTime) && b.order) return 1;
          if (a.order && (!b.order && b.createTime)) return -1;
          
          return (a.order || 999999) - (b.order || 999999);
        });
      }
      
      console.log(`页码: ${this.data.page}, 获取到菜品数量: ${newDishes.length}, 总数: ${allDishes.length}`);
      
      const hasMore = newDishes.length === pageSize;
      
      this.setData({
        dishes: allDishes,
        loading: false,
        loadingMore: false,
        hasMore: hasMore,
        page: this.data.page + 1,
        hasCache: true,
        lastCacheTime: now
      });
    } catch (err) {
      console.error('加载更多菜品失败：', err);
      this.setData({ 
        loading: false,
        loadingMore: false 
      });
    }
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMoreDishes();
    }
  },

  goDishDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?id=${id}`
    });
  },

  addToCart: function(e) {
    const dish = e.currentTarget.dataset.dish;
    
    if (!dish || !dish._id) {
      wx.showToast({
        title: '无效的菜品信息',
        icon: 'none'
      });
      return;
    }
    
    common.addToCart(dish);
    this.updateCartStatus();
  },

  clearCart: function() {
    wx.showModal({
      title: '提示',
      content: '确定要清空购物车吗？',
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

  showCartDetail: function() {
    this.setData({
      showCart: true
    });
  },
  
  hideCartDetail: function() {
    this.setData({
      showCart: false
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
  
  checkout: function() {
    this.setData({
      showCart: false
    });
    
    wx.navigateTo({
      url: '/pages/checkout/checkout'
    });
  },

  handleDishUpdate(data) {
    if (data && (data.type === 'update' || data.type === 'recommendUpdate' || data.type === 'orderChange')) {
      console.log('菜单页接收到菜品更新事件:', data.type);
      
      // 清除当前页的菜品缓存，以便重新获取最新数据
      const cacheKeys = [];
      for (let i = 0; i <= this.data.page; i++) {
        cacheKeys.push(`dishes_${this.data.activeTab}_${this.data.selectedCategory}_${i}`);
      }
      
      // 删除所有相关缓存
      cacheKeys.forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
          console.error('清除菜品缓存失败:', e);
        }
      });
      
      // 重新获取菜品数据
      this.setData({
        dishes: [],
        page: 0,
        hasMore: true,
        hasCache: false
      }, () => {
        this.getDishes();
      });
    }
  },

  handleCategoryUpdate(data) {
    if (data) {
      console.log('菜单页接收到分类更新事件:', data.type);
      
      // 清除分类缓存
      try {
        wx.removeStorageSync('categories');
      } catch (e) {
        console.error('清除分类缓存失败:', e);
      }
      
      // 重新获取分类数据
      this.getCategories();
    }
  },

  updateCartStatus() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  },

  initCartStatus() {
    const cartStatus = common.initCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  }
});
