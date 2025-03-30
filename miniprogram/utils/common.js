// 公共工具函数库

/**
 * 检查用户登录状态
 * @returns {boolean} 是否已登录
 */
const checkLoginStatus = () => {
  const app = getApp();
  return app.globalData && app.globalData.isLogin;
};

/**
 * 显示登录提示
 * @param {Function} callback 可选的回调函数
 */
const showLoginTip = (callback) => {
  const app = getApp();
  app.showLoginTip(callback);
};

/**
 * 显示管理员权限提示
 */
const showAdminTip = () => {
  wx.showToast({
    title: '您没有管理员权限',
    icon: 'none'
  });
};

/**
 * 检查管理员权限
 * @returns {Promise<boolean>} 是否为管理员
 */
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

/**
 * 格式化日期时间
 * @param {Date|string} dateInput 日期对象或日期字符串
 * @returns {string} 格式化后的日期字符串 "YYYY年MM月DD日 周X HH:MM:SS"
 */
const formatDateTime = (dateInput) => {
  try {
    // 如果时间已经是格式化过的，直接返回
    if (typeof dateInput === 'string' && dateInput.includes('年') && dateInput.includes('周')) {
      return dateInput;
    }
    
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // 检查日期是否有效
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

/**
 * 获取日期的简短格式用于分组
 * @param {string} dateStr 日期字符串
 * @returns {string} 简短格式的日期字符串 "YYYY年MM月DD日"
 */
const getDateKey = (dateStr) => {
  try {
    // 提取日期中的"年月日"部分作为分组键
    if (dateStr && dateStr.includes('年')) {
      const datePart = dateStr.split(' ')[0]; // "2023年4月1日"
      return datePart;
    }
    
    // 如果不是格式化后的日期字符串，尝试格式化
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

/**
 * 更新购物车状态
 * @returns {Object} 包含购物车项目和总数量的对象
 */
const updateCartStatus = () => {
  const cartItems = wx.getStorageSync('cartItems') || [];
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  
  return {
    cartItems,
    cartCount: totalItems
  };
};

/**
 * 添加商品到购物车
 * @param {Object} dish 菜品对象
 * @returns {boolean} 是否添加成功
 */
const addToCart = (dish) => {
  // 检查用户是否已登录
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
  
  // 获取当前购物车
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  // 检查菜品是否已在购物车中
  const existingItem = cartItems.find(item => item._id === dish._id);
  
  if (existingItem) {
    // 如果已存在，增加数量
    existingItem.quantity += 1;
  } else {
    // 如果不存在，添加到购物车
    cartItems.push({
      _id: dish._id,
      name: dish.name,
      image: dish.image,
      quantity: 1
    });
  }
  
  // 保存更新后的购物车
  wx.setStorageSync('cartItems', cartItems);
  
  wx.showToast({
    title: '已加入购物车',
    icon: 'success'
  });
  
  return true;
};

/**
 * 从购物车中移除商品
 * @param {string} id 商品ID
 * @returns {Object} 更新后的购物车状态
 */
const removeFromCart = (id) => {
  // 获取当前购物车
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  // 移除指定商品
  cartItems = cartItems.filter(item => item._id !== id);
  
  // 保存更新后的购物车
  wx.setStorageSync('cartItems', cartItems);
  
  return updateCartStatus();
};

/**
 * 增加购物车商品数量
 * @param {string} id 商品ID
 * @returns {Object} 更新后的购物车状态
 */
const increaseCartItemQuantity = (id) => {
  // 检查用户是否已登录
  if (!checkLoginStatus()) {
    showLoginTip();
    return null;
  }
  
  // 获取当前购物车
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  // 查找商品
  const item = cartItems.find(item => item._id === id);
  if (item) {
    item.quantity += 1;
    
    // 保存更新后的购物车
    wx.setStorageSync('cartItems', cartItems);
  }
  
  return {
    cartItems,
    cartCount: cartItems.reduce((total, item) => total + item.quantity, 0)
  };
};

/**
 * 减少购物车商品数量
 * @param {string} id 商品ID
 * @returns {Object} 更新后的购物车状态
 */
const decreaseCartItemQuantity = (id) => {
  // 检查用户是否已登录
  if (!checkLoginStatus()) {
    showLoginTip();
    return null;
  }
  
  // 获取当前购物车
  let cartItems = wx.getStorageSync('cartItems') || [];
  
  // 查找商品索引
  const itemIndex = cartItems.findIndex(item => item._id === id);
  if (itemIndex > -1) {
    if (cartItems[itemIndex].quantity > 1) {
      // 如果数量大于1，减少数量
      cartItems[itemIndex].quantity -= 1;
    } else {
      // 如果数量为1，从购物车移除
      cartItems.splice(itemIndex, 1);
    }
    
    // 保存更新后的购物车
    wx.setStorageSync('cartItems', cartItems);
  }
  
  return {
    cartItems,
    cartCount: cartItems.reduce((total, item) => total + item.quantity, 0)
  };
};

/**
 * 清空购物车
 * @param {Function} callback 清空后的回调函数
 */
const clearCart = (callback) => {
  // 检查用户是否已登录
  if (!checkLoginStatus()) {
    showLoginTip();
    return;
  }
  
  wx.showModal({
    title: '确认清空',
    content: '确定要清空购物车吗？',
    success: (res) => {
      if (res.confirm) {
        // 清空购物车数据
        wx.setStorageSync('cartItems', []);
        
        wx.showToast({
          title: '购物车已清空',
          icon: 'success'
        });
        
        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    }
  });
};

// 导出所有工具函数
module.exports = {
  checkLoginStatus,
  showLoginTip,
  showAdminTip,
  checkAdminPermission,
  formatDateTime,
  getDateKey,
  updateCartStatus,
  addToCart,
  removeFromCart,
  increaseCartItemQuantity,
  decreaseCartItemQuantity,
  clearCart
};
