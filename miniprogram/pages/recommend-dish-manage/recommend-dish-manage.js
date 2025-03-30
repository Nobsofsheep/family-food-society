Page({

  /**
   * 页面的初始数据
   */
  data: {
    dishes: [],
    recommendDishes: [],
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
        // 推荐菜品
        const recommendDishes = allDishes.filter(dish => dish.isRecommended);
        
        this.setData({
          dishes: allDishes,
          recommendDishes: recommendDishes,
          loading: false
        });
      } else {
        this.setData({ 
          dishes: [],
          recommendDishes: [],
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
      const recommendDishes = allDishes.filter(dish => dish.isRecommended);
      
      this.setData({
        dishes: allDishes,
        recommendDishes: recommendDishes,
        loading: false
      });
    } catch (err) {
      console.error('搜索菜品失败：', err);
      this.setData({ loading: false });
    }
  },

  // 设置/取消今日推荐
  async toggleRecommendDish(e) {
    const id = e.currentTarget.dataset.id;
    const isRecommended = e.currentTarget.dataset.isrecommended;
    
    const newStatus = !isRecommended;
    
    // 如果要设置为推荐菜品，先检查当前推荐菜品数量
    if (newStatus && this.data.recommendDishes.length >= 3) {
      wx.showModal({
        title: '提示',
        content: '推荐菜品最多设置3个，请先取消一个当前推荐菜品',
        showCancel: false
      });
      return;
    }
    
    this.updateRecommendDish(id, newStatus);
  },
  
  // 更新推荐菜品状态
  async updateRecommendDish(id, newStatus) {
    wx.showLoading({
      title: newStatus ? '设为今日推荐中...' : '取消今日推荐中...'
    });
    
    try {
      const db = wx.cloud.database();
      
      // 设置当前菜品的推荐状态
      await db.collection('dishes').doc(id).update({
        data: {
          isRecommended: newStatus,
          updateTime: new Date()
        }
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: newStatus ? '已设为今日推荐' : '已取消今日推荐',
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
  }
}); 