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
    this.initCategoriesOrder()
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

  // 初始化分类顺序
  async initCategoriesOrder() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('categories').get()
      
      if (res.data && res.data.length > 0) {
        // 检查是否已经有order字段
        const hasOrder = res.data.some(item => item.order !== undefined)
        
        if (!hasOrder) {
          // 为每个分类添加order字段
          const batch = []
          res.data.forEach((item, index) => {
            batch.push({
              _id: item._id,
              order: index + 1
            })
          })
          
          // 批量更新
          for (const item of batch) {
            await db.collection('categories').doc(item._id).update({
              data: {
                order: item.order,
                updateTime: new Date()
              }
            })
          }
          
          console.log('分类顺序初始化完成')
        }
      }
    } catch (err) {
      console.error('初始化分类顺序失败：', err)
    }
  },

  // 获取分类列表
  async getCategories() {
    try {
      this.setData({ loading: true })
      
      const db = wx.cloud.database()
      const res = await db.collection('categories')
        .orderBy('order', 'asc')
        .get()
      
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
      
      // 获取当前最大order值
      const maxOrderRes = await db.collection('categories')
        .orderBy('order', 'desc')
        .limit(1)
        .get()
      
      const maxOrder = maxOrderRes.data.length > 0 ? maxOrderRes.data[0].order : 0
      
      await db.collection('categories').add({
        data: {
          name: newCategory.trim(),
          order: maxOrder + 1,
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

      // 触发分类更新事件
      const app = getApp();
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('categoryUpdate', {
          type: 'add',
          name: newCategory.trim()
        });
      }
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

      // 触发分类更新事件
      const app = getApp();
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('categoryUpdate', {
          type: 'update',
          id: id,
          name: editValue.trim()
        });
      }
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

            // 触发分类更新事件
            const app = getApp();
            if (app.globalData && app.globalData.eventBus) {
              app.globalData.eventBus.emit('categoryUpdate', {
                type: 'delete',
                id: id,
                name: name
              });
            }
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
  },

  // 上移分类
  async moveCategoryUp(e) {
    console.log('上移分类', e)
    const index = e.currentTarget.dataset.index
    if (index <= 0) return

    try {
      const db = wx.cloud.database()
      const categories = this.data.categories
      const currentCategory = categories[index]
      const prevCategory = categories[index - 1]

      console.log('当前分类:', currentCategory)
      console.log('上一个分类:', prevCategory)

      // 交换order值
      const currentOrder = currentCategory.order
      const prevOrder = prevCategory.order

      console.log('交换order值:', currentOrder, prevOrder)

      if (currentOrder === undefined || prevOrder === undefined) {
        // 如果发现没有order字段，重新初始化
        await this.initCategoriesOrder()
        this.getCategories()
        return
      }

      await db.collection('categories').doc(currentCategory._id).update({
        data: {
          order: prevOrder,
          updateTime: new Date()
        }
      })

      await db.collection('categories').doc(prevCategory._id).update({
        data: {
          order: currentOrder,
          updateTime: new Date()
        }
      })
      
      // 重新获取分类列表
      this.getCategories()

      // 触发分类更新事件
      const app = getApp();
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('categoryUpdate', {
          type: 'orderChange',
          id: currentCategory._id,
          order: prevOrder
        });
      }
    } catch (err) {
      console.error('移动分类失败：', err)
      wx.showToast({
        title: '移动失败',
        icon: 'none'
      })
    }
  },

  // 下移分类
  async moveCategoryDown(e) {
    console.log('下移分类', e)
    const index = e.currentTarget.dataset.index
    if (index >= this.data.categories.length - 1) return

    try {
      const db = wx.cloud.database()
      const categories = this.data.categories
      const currentCategory = categories[index]
      const nextCategory = categories[index + 1]

      console.log('当前分类:', currentCategory)
      console.log('下一个分类:', nextCategory)

      // 交换order值
      const currentOrder = currentCategory.order
      const nextOrder = nextCategory.order

      console.log('交换order值:', currentOrder, nextOrder)

      if (currentOrder === undefined || nextOrder === undefined) {
        // 如果发现没有order字段，重新初始化
        await this.initCategoriesOrder()
        this.getCategories()
        return
      }

      await db.collection('categories').doc(currentCategory._id).update({
        data: {
          order: nextOrder,
          updateTime: new Date()
        }
      })

      await db.collection('categories').doc(nextCategory._id).update({
        data: {
          order: currentOrder,
          updateTime: new Date()
        }
      })
      
      // 重新获取分类列表
      this.getCategories()

      // 触发分类更新事件
      const app = getApp();
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('categoryUpdate', {
          type: 'orderChange',
          id: currentCategory._id,
          order: nextOrder
        });
      }
    } catch (err) {
      console.error('移动分类失败：', err)
      wx.showToast({
        title: '移动失败',
        icon: 'none'
      })
    }
  }
}) 