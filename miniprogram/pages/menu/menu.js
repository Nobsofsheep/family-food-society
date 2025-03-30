// 修复后的menu.js文件
// 使用公共工具函数，修复购物车数据不一致问题

// 引入公共工具函数
const common = require('../../utils/common.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'all',
    selectedCategory: null,
    categories: [],
    dishes: [],
    loading: true,
    cartCount: 0,
    isCategoryCollapsed: false, // 分类列表是否收起
    showCart: false, // 是否显示购物车详情
    cartItems: [] // 购物车商品列表
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取分类数据
    this.getCategories();
    
    // 设置分类列表为展开状态
    this.setData({
      isCategoryCollapsed: false
    });
    
    // 更新本地存储中的状态
    wx.setStorageSync('menuCategoryCollapsed', false);
    
    // 监听菜品更新事件
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.on('dishUpdate', this.handleDishUpdate);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 更新购物车状态
    this.updateCartStatus();
    // 如果有分类，则加载菜品
    if (this.data.categories.length > 0) {
      this.getDishes();
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 移除事件监听
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('dishUpdate', this.handleDishUpdate);
    }
  },

  // 获取分类数据
  async getCategories() {
    try {
      const db = wx.cloud.database();
      const result = await db.collection('categories')
        .orderBy('order', 'asc')
        .get();
      
      if (result.data && result.data.length > 0) {
        this.setData({
          categories: result.data,
          selectedCategory: result.data[0]._id // 默认选择第一个分类
        });
        
        // 获取菜品数据
        this.getDishes();
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

  // 切换标签
  changeTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    this.getDishes();
  },

  // 选择分类
  selectCategory: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      selectedCategory: categoryId
    });
    this.getDishes();
  },

  // 获取菜品数据
  async getDishes() {
    try {
      this.setData({ loading: true });
      const db = wx.cloud.database();
      
      // 构建查询条件
      let query = {};
      
      if (this.data.activeTab === 'new') {
        query.isNew = true;
      }
      
      if (this.data.selectedCategory) {
        query.categoryId = this.data.selectedCategory;
      }
      
      const result = await db.collection('dishes')
        .where(query)
        .get();
      
      this.setData({
        dishes: result.data || [],
        loading: false
      });
    } catch (err) {
      console.error('获取菜品失败：', err);
      wx.showToast({
        title: '获取菜品失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 跳转到菜品详情
  goDishDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?id=${id}`
    });
  },

  // 加入购物车
  addToCart: async function (e) {
    const dish = e.currentTarget.dataset.dish;
    
    if (common.addToCart(dish)) {
      // 更新购物车状态
      this.updateCartStatus();
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

  // 展示购物车详情
  showCartDetail: function() {
    // 检查用户是否已登录
    if (!common.checkLoginStatus()) {
      common.showLoginTip();
      return;
    }
    
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

  /**
   * 收起/展开分类列表
   */
  toggleCategoryList() {
    this.setData({
      isCategoryCollapsed: !this.data.isCategoryCollapsed
    });
    // 保存状态到本地存储，下次打开页面依然保持这个状态
    wx.setStorageSync('menuCategoryCollapsed', this.data.isCategoryCollapsed);
  },

  /**
   * 处理菜品更新事件
   */
  handleDishUpdate(data) {
    if (data && (data.type === 'update' || data.type === 'add' || data.type === 'delete')) {
      // 刷新菜品列表
      this.getDishes();
    }
  },

  // 更新购物车状态
  updateCartStatus() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  }
});
