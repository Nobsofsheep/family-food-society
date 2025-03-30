Page({

  /**
   * 页面的初始数据
   */
  data: {
    categories: [],
    newCategory: '',
    editIndex: -1,
    editValue: '',
    loading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getCategories()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getCategories()
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.getCategories()
    wx.stopPullDownRefresh()
  },

  // 获取分类列表
  async getCategories() {
    try {
      this.setData({ loading: true })
      
      const db = wx.cloud.database()
      const res = await db.collection('categories').orderBy('createTime', 'desc').get()
      
      this.setData({
        categories: res.data || [],
        loading: false
      })
    } catch (err) {
      console.error('获取分类失败：', err)
      wx.showToast({
        title: '获取分类失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 输入框变化
  onInputChange(e) {
    this.setData({
      newCategory: e.detail.value
    })
  },

  // 编辑输入框变化
  onEditInputChange(e) {
    this.setData({
      editValue: e.detail.value
    })
  },

  // 添加分类
  async addCategory() {
    const { newCategory } = this.data
    
    if (!newCategory.trim()) {
      return wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      })
    }

    // 检查是否存在相同名称的分类
    const existingCategory = this.data.categories.find(
      c => c.name.toLowerCase() === newCategory.trim().toLowerCase()
    )

    if (existingCategory) {
      return wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      })
    }
    
    try {
      wx.showLoading({
        title: '添加中...'
      })
      
      const db = wx.cloud.database()
      
      await db.collection('categories').add({
        data: {
          name: newCategory.trim(),
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      
      wx.hideLoading()
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
      
      // 清空输入框
      this.setData({
        newCategory: ''
      })
      
      // 重新获取分类列表
      this.getCategories()
    } catch (err) {
      console.error('添加分类失败：', err)
      wx.hideLoading()
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  // 编辑分类
  editCategory(e) {
    const index = e.currentTarget.dataset.index
    const category = this.data.categories[index]
    
    this.setData({
      editIndex: index,
      editValue: category.name
    })
  },

  // 取消编辑
  cancelEdit() {
    this.setData({
      editIndex: -1,
      editValue: ''
    })
  },

  // 保存编辑
  async saveEdit(e) {
    const id = e.currentTarget.dataset.id
    const { editValue } = this.data
    
    if (!editValue.trim()) {
      return wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      })
    }

    // 检查是否存在相同名称的分类
    const existingCategory = this.data.categories.find(
      c => c.name.toLowerCase() === editValue.trim().toLowerCase() && c._id !== id
    )

    if (existingCategory) {
      return wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      })
    }
    
    try {
      wx.showLoading({
        title: '保存中...'
      })
      
      const db = wx.cloud.database()
      
      await db.collection('categories').doc(id).update({
        data: {
          name: editValue.trim(),
          updateTime: new Date()
        }
      })
      
      wx.hideLoading()
      
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 退出编辑模式
      this.setData({
        editIndex: -1,
        editValue: ''
      })
      
      // 重新获取分类列表
      this.getCategories()
    } catch (err) {
      console.error('保存分类失败：', err)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 删除分类
  deleteCategory(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${name}"分类吗？这可能会影响已使用此分类的菜品。`,
      confirmColor: '#FF6B35',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '删除中...'
            })
            
            const db = wx.cloud.database()
            
            // 1. 删除分类
            await db.collection('categories').doc(id).remove()
            
            // 2. 更新使用该分类的菜品
            const _ = db.command
            await db.collection('dishes').where({
              categories: _.all([name])
            }).update({
              data: {
                categories: _.pull(name)
              }
            })
            
            wx.hideLoading()
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            
            // 重新获取分类列表
            this.getCategories()
          } catch (err) {
            console.error('删除分类失败：', err)
            wx.hideLoading()
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