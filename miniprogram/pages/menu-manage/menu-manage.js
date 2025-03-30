Page({

  /**
   * 页面的初始数据
   */
  data: {
    dishes: [],
    loading: true,
    searchValue: '',
    filterVisible: false,
    categories: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getDishes()
    this.getCategories()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getDishes()
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.getDishes()
    wx.stopPullDownRefresh()
  },

  // 获取菜品数据
  async getDishes() {
    this.setData({ loading: true })
    
    try {
      const db = wx.cloud.database()
      const res = await db.collection('dishes').get()
      
      this.setData({
        dishes: res.data || [],
        loading: false
      })
    } catch (err) {
      console.error('获取菜品失败：', err)
      wx.showToast({
        title: '获取菜品失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },
  
  // 获取分类
  async getCategories() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('categories').get()
      
      this.setData({
        categories: res.data.map(item => item.name) || []
      })
    } catch (err) {
      console.error('获取分类失败：', err)
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const value = e.detail.value
    this.setData({ searchValue: value })
    
    if (value) {
      this.searchDishes(value)
    } else {
      this.getDishes()
    }
  },
  
  // 搜索菜品
  async searchDishes(keyword) {
    try {
      const db = wx.cloud.database()
      const _ = db.command
      
      const res = await db.collection('dishes')
        .where(_.or([
          {
            name: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          },
          {
            categories: _.all([keyword])
          }
        ]))
        .get()
      
      this.setData({
        dishes: res.data || []
      })
    } catch (err) {
      console.error('搜索菜品失败：', err)
    }
  },
  
  // 显示/隐藏筛选
  toggleFilter() {
    this.setData({
      filterVisible: !this.data.filterVisible
    })
  },
  
  // 筛选分类
  filterByCategory(e) {
    const category = e.currentTarget.dataset.category
    this.searchDishes(category)
    this.setData({
      filterVisible: false
    })
  },

  // 前往添加菜品页面
  goToAddDish() {
    wx.navigateTo({
      url: '/pages/add-dish/add-dish'
    })
  },

  // 编辑菜品
  editDish(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/add-dish/add-dish?id=${id}`
    })
  },

  // 删除菜品
  async deleteDish(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const db = wx.cloud.database()
            await db.collection('dishes').doc(id).remove()
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            
            // 重新获取菜品列表
            this.getDishes()
          } catch (err) {
            console.error('删除菜品失败：', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
}) 