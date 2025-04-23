// 公共工具函数库

const checkLoginStatus = () => {
  const app = getApp();
  return app.globalData && app.globalData.isLogin;
};

const showLoginTip = (callback) => {
  const app = getApp();
  app.showLoginTip(callback);
};

const showAdminTip = () => {
  wx.showToast({
    title: '您没有管理员权限',
    icon: 'none'
  });
};

const checkAdminPermission = () => {
  return new Promise((resolve, reject) => {
    const db = wx.cloud.database();
    db.collection('users')
      .where({
        openid: wx.getStorageSync('openid')
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0 && res.data[0].role === 'admin') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch(err => {
        console.error('检查管理员权限失败:', err);
        resolve(false);
      });
  });
};

const formatDateTime = (dateInput) => {
  try {
    if (typeof dateInput === 'string' && dateInput.includes('年') && dateInput.includes('周')) {
      return dateInput;
    }
    
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return typeof dateInput === 'string' ? dateInput : '无效日期';
    }
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}年${month}月${day}日 周${weekDay} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.error('日期格式化错误:', e);
    return typeof dateInput === 'string' ? dateInput : '格式化错误';
  }
};

const getDateKey = (dateStr) => {
  try {
    if (dateStr && dateStr.includes('年')) {
      const datePart = dateStr.split(' ')[0];
      return datePart;
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未知日期';
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } catch (e) {
    console.error('获取日期键错误:', e);
    return '未知日期';
  }
};

// 购物车数据缓存
let _cartCache = null;
let _lastCartUpdate = 0;
const CART_CACHE_DURATION = 3000; // 缓存有效期3秒

// 初始化购物车状态（带缓存）
const initCartStatus = () => {
  // 如果缓存有效，直接返回缓存数据
  const now = Date.now();
  if (_cartCache && now - _lastCartUpdate < CART_CACHE_DURATION) {
    return _cartCache;
  }
  
  const cartItems = wx.getStorageSync('cartItems') || [];
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  
  // 更新缓存
  _cartCache = {
    cartItems,
    cartCount: totalItems
  };
  _lastCartUpdate = now;
  
  return _cartCache;
};

// 更新购物车状态（带缓存）
const updateCartStatus = () => {
  // 强制刷新缓存
  const cartItems = wx.getStorageSync('cartItems') || [];
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  
  // 更新缓存
  _cartCache = {
    cartItems,
    cartCount: totalItems
  };
  _lastCartUpdate = Date.now();
  
  return _cartCache;
};

// 添加节流函数
let _throttleLock = false;
const throttle = (fn, delay = 500) => {
  return function(...args) {
    if (_throttleLock) return;
    _throttleLock = true;
    fn.apply(this, args);
    setTimeout(() => {
      _throttleLock = false;
    }, delay);
  };
};

// 添加到购物车（节流处理）
const addToCart = (dish) => {
  if (!checkLoginStatus()) {
    showLoginTip();
    return false;
  }
  
  if (!dish || !dish._id) {
    wx.showToast({
      title: '无效的菜品信息',
      icon: 'none'
    });
    return false;
  }
  
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  const existingItem = cartItems.find(item => item._id === dish._id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.push({
      _id: dish._id,
      name: dish.name,
      image: dish.image,
      quantity: 1
    });
  }
  
  wx.setStorageSync('cartItems', cartItems);
  
  // 强制更新缓存
  updateCartStatus();
  
  return true;
};

// 从购物车移除（带缓存更新）
const removeFromCart = (id) => {
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  cartItems = cartItems.filter(item => item._id !== id);
  
  wx.setStorageSync('cartItems', cartItems);
  
  // 强制更新缓存
  return updateCartStatus();
};

// 增加购物车商品数量
const increaseCartItemQuantity = (id) => {
  if (!checkLoginStatus()) {
    showLoginTip();
    return null;
  }
  
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  const item = cartItems.find(item => item._id === id);
  if (item) {
    item.quantity += 1;
    
    wx.setStorageSync('cartItems', cartItems);
  }
  
  // 强制更新缓存
  return updateCartStatus();
};

// 减少购物车商品数量
const decreaseCartItemQuantity = (id) => {
  if (!checkLoginStatus()) {
    showLoginTip();
    return null;
  }
  
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  const itemIndex = cartItems.findIndex(item => item._id === id);
  if (itemIndex > -1) {
    if (cartItems[itemIndex].quantity > 1) {
      cartItems[itemIndex].quantity -= 1;
    } else {
      cartItems.splice(itemIndex, 1);
    }
    
    wx.setStorageSync('cartItems', cartItems);
  }
  
  // 强制更新缓存
  return updateCartStatus();
};

// 清空购物车（带缓存更新）
const clearCart = (callback) => {
  wx.setStorageSync('cartItems', []);
  
  // 强制更新缓存
  updateCartStatus();
  
  if (callback && typeof callback === 'function') {
    callback();
  }
};

// 导出所有公共函数
module.exports = {
  checkLoginStatus,
  showLoginTip,
  showAdminTip,
  checkAdminPermission,
  formatDateTime,
  getDateKey,
  initCartStatus,
  updateCartStatus,
  addToCart,
  removeFromCart,
  increaseCartItemQuantity,
  decreaseCartItemQuantity,
  clearCart,
  throttle
};
