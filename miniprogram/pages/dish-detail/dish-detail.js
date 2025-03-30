Page({
  /**
   * 页面的初始数据
   */
  data: {
    dish: null,
    loading: true,
    cartCount: 0,
    showCart: false,
    cartItems: [],
    isLogin: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查登录状态
    const app = getApp();
    this.setData({
      isLogin: app.globalData.isLogin,
      cartCount: app.globalData.isLogin ? (wx.getStorageSync('cartItems') || []).reduce((total, item) => total + item.quantity, 0) : 0
    });
    
    // 监听登录状态变化
    app.globalData.loginStatusCallback = (isLogin) => {
      this.setData({
        isLogin: isLogin,
        cartCount: isLogin ? (wx.getStorageSync('cartItems') || []).reduce((total, item) => total + item.quantity, 0) : 0,
        cartItems: isLogin ? (wx.getStorageSync('cartItems') || []) : []
      });
    };
    
    if (options.id) {
      this.getDishDetail(options.id);
    } else {
      wx.showToast({
        title: '缺少菜品ID',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 更新登录状态和购物车数量
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    
    // 如果未登录，直接清空购物车角标
    if (!isLogin) {
      this.setData({
        isLogin: false,
        cartCount: 0,
        cartItems: []
      });
      return;
    }
    
    // 已登录状态下，更新购物车数量
    const cartItems = wx.getStorageSync('cartItems') || [];
    this.setData({
      isLogin: true,
      cartCount: cartItems.reduce((total, item) => total + item.quantity, 0),
      cartItems: cartItems
    });
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

  // 获取菜品详情
  async getDishDetail(id) {
    try {
      this.setData({ loading: true });
      const db = wx.cloud.database();
      
      const result = await db.collection('dishes').doc(id).get();
      
      if (result.data) {
        this.setData({
          dish: result.data,
          loading: false
        });
        // 设置页面标题
        wx.setNavigationBarTitle({
          title: result.data.name
        });
      } else {
        wx.showToast({
          title: '菜品不存在',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (err) {
      console.error('获取菜品详情失败：', err);
      wx.showToast({
        title: '获取菜品详情失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 加入购物车
  addToCart() {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.globalData.isLogin) {
      app.showLoginTip();
      return;
    }
    
    const dish = this.data.dish;
    if (!dish) return;
    
    // 获取当前购物车数据
    let cartItems = wx.getStorageSync('cartItems') || [];
    
    // 检查商品是否已在购物车中
    const existingItem = cartItems.find(item => item._id === dish._id);
    
    if (existingItem) {
      // 如果商品已存在，增加数量
      existingItem.quantity += 1;
    } else {
      // 如果商品不存在，添加新商品
      cartItems.push({
        _id: dish._id,
        name: dish.name,
        image: dish.image,
        quantity: 1
      });
    }
    
    // 更新本地存储
    wx.setStorageSync('cartItems', cartItems);
    
    // 更新购物车角标
    this.updateCartBadge(cartItems);
    
    // 显示成功提示
    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  },

  // 更新购物车状态
  updateCartStatus() {
    const app = getApp();
    const cartItems = wx.getStorageSync('cartItems') || [];
    
    // 只有在登录状态下才显示购物车数量
    if (app.globalData.isLogin) {
      const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
      this.setData({
        cartCount: totalItems,
        cartItems: cartItems
      });
    } else {
      this.setData({
        cartCount: 0,
        cartItems: []
      });
    }
  },
  
  // 更新购物车角标
  updateCartBadge(cartItems) {
    const app = getApp();
    
    // 只有在登录状态下才显示购物车数量
    if (app.globalData.isLogin) {
      const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      this.setData({
        cartCount: totalCount,
        cartItems: cartItems
      });
    } else {
      this.setData({
        cartCount: 0,
        cartItems: []
      });
    }
  },

  // 展示图片预览
  previewImage() {
    const { dish } = this.data;
    if (!dish || !dish.image) return;
    
    wx.previewImage({
      urls: [dish.image],
      current: dish.image
    });
  },

  // 返回菜单页
  goBack() {
    wx.navigateBack();
  },

  // 显示购物车弹窗
  showCart() {
    // 检查用户是否已登录
    const app = getApp();
    if (!app.globalData.isLogin) {
      app.showLoginTip();
      return;
    }
    
    // 获取购物车数据
    const cartItems = wx.getStorageSync('cartItems') || [];
    
    // 显示购物车弹窗
    this.setData({
      showCart: true,
      cartItems: cartItems
    });
  },

  // 隐藏购物车弹窗
  hideCart() {
    this.setData({
      showCart: false
    });
  },

  // 从购物车中移除商品
  removeFromCart(e) {
    const id = e.currentTarget.dataset.id;
    let cartItems = this.data.cartItems;
    
    const index = cartItems.findIndex(item => item._id === id);
    if (index !== -1) {
      cartItems.splice(index, 1);
      
      // 更新本地存储
      wx.setStorageSync('cartItems', cartItems);
      
      // 更新页面显示
      this.setData({
        cartItems: cartItems
      });
      
      // 更新购物车角标
      this.updateCartBadge(cartItems);
    }
  },

  // 清空购物车
  clearCart() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          // 清空本地存储
          wx.setStorageSync('cartItems', []);
          
          // 更新页面显示
          this.setData({
            cartItems: []
          });
          
          // 更新购物车角标
          this.updateCartBadge([]);
        }
      }
    });
  },

  // 去结算
  checkout() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/checkout/checkout'
    });
  },

  onUnload() {
    const app = getApp();
    app.globalData.loginStatusCallback = null;
  }
}); 