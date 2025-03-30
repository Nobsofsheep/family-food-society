Page({

  /**
   * 页面的初始数据
   */
  data: {
    dishes: [],
    newDishes: [],
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
        // 新品菜品
        const newDishes = allDishes.filter(dish => dish.isNew);
        
        this.setData({
          dishes: allDishes,
          newDishes: newDishes,
          loading: false
        });
      } else {
        this.setData({ 
          dishes: [],
          newDishes: [],
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
      const newDishes = allDishes.filter(dish => dish.isNew);
      
      this.setData({
        dishes: allDishes,
        newDishes: newDishes,
        loading: false
      });
    } catch (err) {
      console.error('搜索菜品失败：', err);
      this.setData({ loading: false });
    }
  },

  // 设置/取消新品标记
  async toggleNewDish(e) {
    const id = e.currentTarget.dataset.id;
    const isNew = e.currentTarget.dataset.isnew;
    
    const newStatus = !isNew;
    
    wx.showLoading({
      title: newStatus ? '设为新品中...' : '取消新品中...'
    });
    
    try {
      const db = wx.cloud.database();
      
      await db.collection('dishes').doc(id).update({
        data: {
          isNew: newStatus,
          updateTime: new Date()
        }
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: newStatus ? '已设为新品' : '已取消新品',
        icon: 'success'
      });
      
      // 触发全局菜品更新事件
      const app = getApp();
      if (app.triggerEvent) {
        app.triggerEvent('dishUpdate', { 
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