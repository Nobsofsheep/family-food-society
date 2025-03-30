Page({

  /**
   * 页面的初始数据
   */
  data: {
    dishes: [],
    featureDishes: [],
    loading: true,
    searchValue: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getDishes();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getDishes();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.getDishes();
    wx.stopPullDownRefresh();
  },

  // 获取所有菜品数据
  async getDishes() {
    try {
      this.setData({ loading: true });
      
      const db = wx.cloud.database();
      const result = await db.collection('dishes').get();
      
      if (result.data) {
        // 所有菜品
        const allDishes = result.data || [];
        // 特色菜品
        const featureDishes = allDishes.filter(dish => dish.isFeature);
        
        this.setData({
          dishes: allDishes,
          featureDishes: featureDishes,
          loading: false
        });
      } else {
        this.setData({ 
          dishes: [],
          featureDishes: [],
          loading: false 
        });
      }
    } catch (err) {
      console.error('获取菜品失败：', err);
      wx.showToast({
        title: '获取菜品失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const value = e.detail.value;
    this.setData({ searchValue: value });
    
    if (value) {
      this.searchDishes(value);
    } else {
      this.getDishes();
    }
  },
  
  // 搜索菜品
  async searchDishes(keyword) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      this.setData({ loading: true });
      
      const result = await db.collection('dishes')
        .where(_.or([
          {
            name: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          }
        ]))
        .get();
      
      const allDishes = result.data || [];
      const featureDishes = allDishes.filter(dish => dish.isFeature);
      
      this.setData({
        dishes: allDishes,
        featureDishes: featureDishes,
        loading: false
      });
    } catch (err) {
      console.error('搜索菜品失败：', err);
      this.setData({ loading: false });
    }
  },

  // 设置/取消今日特色
  async toggleFeatureDish(e) {
    const id = e.currentTarget.dataset.id;
    const isFeature = e.currentTarget.dataset.isfeature;
    
    const newStatus = !isFeature;
    
    // 如果要设置为特色菜，先确认是否已有特色菜
    if (newStatus && this.data.featureDishes.length > 0) {
      wx.showModal({
        title: '提示',
        content: '已存在今日特色菜品，设置新的今日特色将会替换当前的特色菜品，确定继续吗？',
        success: (res) => {
          if (res.confirm) {
            this.updateFeatureDish(id, newStatus);
          }
        }
      });
    } else {
      this.updateFeatureDish(id, newStatus);
    }
  },
  
  // 更新特色菜品状态
  async updateFeatureDish(id, newStatus) {
    wx.showLoading({
      title: newStatus ? '设为今日特色中...' : '取消今日特色中...'
    });
    
    try {
      const db = wx.cloud.database();
      
      // 如果设置新的特色菜，先取消所有现有特色菜
      if (newStatus) {
        // 查找所有特色菜
        const featureResult = await db.collection('dishes')
          .where({
            isFeature: true
          })
          .get();
        
        // 取消所有特色菜的特色标记
        if (featureResult.data && featureResult.data.length > 0) {
          for (const dish of featureResult.data) {
            await db.collection('dishes').doc(dish._id).update({
              data: {
                isFeature: false,
                updateTime: new Date()
              }
            });
          }
        }
      }
      
      // 设置当前菜品的特色状态
      await db.collection('dishes').doc(id).update({
        data: {
          isFeature: newStatus,
          updateTime: new Date()
        }
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: newStatus ? '已设为今日特色' : '已取消今日特色',
        icon: 'success'
      });
      
      // 触发全局菜品更新事件
      const app = getApp();
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', { 
          type: 'update',
          id: id
        });
      }
      
      // 刷新菜品列表
      this.getDishes();
    } catch (err) {
      console.error('更新菜品状态失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 编辑菜品
  editDish(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/add-dish/add-dish?id=${id}`
    });
  },

  // 前往添加菜品页面
  goToAddDish() {
    wx.navigateTo({
      url: '/pages/add-dish/add-dish'
    });
  }
}); 