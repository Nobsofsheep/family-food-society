// 菜品详情页
const common = require('../../utils/common.js');

// 跟踪已经加载过的菜品数据
const dishCache = {};

Page({
  /**
   * 页面的初始数据
   */
  data: {
    dishId: '',
    dish: null,
    loading: true,
    cartCount: 0,
    cartItems: [],
    isAdmin: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const dishId = options.id;
    this.setData({
      dishId: dishId
    });
    
    // 检查用户权限
    this.checkAdminPermission();

    // 从缓存中获取数据
    const cachedDish = dishCache[dishId];
    if (cachedDish) {
      console.log('使用缓存的菜品数据');
      this.setData({
        dish: cachedDish,
        loading: false
      });
      // 预加载图片
      this.preloadImage(cachedDish.image);
    } else {
      this.getDishDetail();
    }
    
    // 初始化购物车状态
    this.initCartStatus();
    
    // 注册菜品更新事件监听
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
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    const { dish } = this.data;
    if (dish) {
      return {
        title: dish.name,
        path: `/pages/dish-detail/dish-detail?id=${dish._id}`,
        imageUrl: dish.image
      };
    }
    return {};
  },

  // 预加载图片
  preloadImage(imageUrl) {
    if (!imageUrl) return;
    
    // 使用微信小程序提供的previewImage API预加载，但不显示预览
    // 或者直接忽略预加载，因为小程序会自动缓存图片
    console.log('图片URL准备加载:', imageUrl);
    
    // 也可以使用getImageInfo API获取图片信息，这会预加载图片
    wx.getImageInfo({
      src: imageUrl,
      success: (res) => {
        console.log('图片预加载成功:', res.width, 'x', res.height);
      },
      fail: (err) => {
        console.error('图片预加载失败:', err);
      }
    });
  },

  // 获取菜品详情数据
  getDishDetail: function() {
    this.setData({ loading: true });
    
    const dishId = this.data.dishId;
    const db = wx.cloud.database();
    
    db.collection('dishes').doc(dishId).get({
      success: res => {
        const dish = res.data;
        
        // 缓存数据
        dishCache[dishId] = dish;
        
        this.setData({
          dish: dish,
          loading: false
        });
        
        // 预加载图片
        this.preloadImage(dish.image);
      },
      fail: err => {
        console.error('获取菜品详情失败：', err);
        wx.showToast({
          title: '获取菜品详情失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    });
  },
  
  // 处理菜品更新事件
  handleDishUpdate(data) {
    // 如果更新的是当前菜品，刷新数据
    if (data && data.id === this.data.dishId) {
      // 清除缓存
      delete dishCache[this.data.dishId];
      // 重新获取数据
      this.getDishDetail();
    }
  },

  // 添加到购物车
  addToCart: function() {
    const dish = this.data.dish;
    if (common.addToCart(dish)) {
      this.updateCartStatus();
      wx.showToast({
        title: '已加入购物车',
        icon: 'success'
      });
    }
  },

  // 立即下单
  orderNow: function() {
    const dish = this.data.dish;
    
    // 添加到购物车
    common.addToCart(dish);
    
    // 跳转到结账页面
    wx.navigateTo({
      url: '/pages/checkout/checkout'
    });
  },

  // 编辑菜品（管理员功能）
  editDish: function() {
    const dishId = this.data.dishId;
    wx.navigateTo({
      url: `/pages/dish-edit/dish-edit?id=${dishId}`
    });
  },
  
  // 检查管理员权限
  checkAdminPermission: function() {
    const app = getApp();
    const isAdmin = app.globalData.isAdmin;
    
    this.setData({
      isAdmin: isAdmin
    });
  },

  // 更新购物车状态
  updateCartStatus() {
    const cartStatus = common.updateCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  },

  // 初始化购物车状态
  initCartStatus() {
    const cartStatus = common.initCartStatus();
    this.setData({
      cartCount: cartStatus.cartCount,
      cartItems: cartStatus.cartItems
    });
  },
  
  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 预览图片
  previewImage() {
    if (this.data.dish && this.data.dish.image) {
      wx.previewImage({
        urls: [this.data.dish.image],
        current: this.data.dish.image
      });
    }
  },

  onUnload() {
    // 移除菜品更新事件监听
    const app = getApp();
    if (app.globalData && app.globalData.eventBus) {
      app.globalData.eventBus.off('dishUpdate', this.handleDishUpdate);
    }
  }
}); 