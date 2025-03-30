Page({

  /**
   * 页面的初始数据
   */
  data: {
    isEdit: false,
    dishId: '',
    dishData: {
      name: '',
      cookTime: '',
      description: '',
      image: '',
      categoryId: ''
    },
    ingredients: [''],
    categories: [],
    categoryNames: [],
    selectedCategoryIndex: 0,
    tempImagePath: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取分类列表
    this.getCategories()

    if (options.id) {
      // 编辑模式
      this.setData({
        isEdit: true,
        dishId: options.id
      })
      this.getDishDetail(options.id)
    } else {
      // 添加模式
      this.setData({
        isEdit: false,
        dishId: ''
      })
    }
  },

  // 获取分类列表
  async getCategories() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('categories')
        .orderBy('order', 'asc')
        .get()
      
      if (res.data && res.data.length > 0) {
        this.setData({
          categories: res.data,
          categoryNames: res.data.map(item => item.name)
        })
      }
    } catch (err) {
      console.error('获取分类失败：', err)
      wx.showToast({
        title: '获取分类失败',
        icon: 'none'
      })
    }
  },

  // 获取菜品详情
  async getDishDetail(id) {
    try {
      wx.showLoading({
        title: '加载中...'
      })
      
      const db = wx.cloud.database()
      const res = await db.collection('dishes').doc(id).get()
      
      if (res.data) {
        const dish = res.data
        
        // 找到分类在数组中的索引
        const categoryIndex = this.data.categories.findIndex(
          category => category._id === dish.categoryId
        )
        
        this.setData({
          dishData: {
            name: dish.name || '',
            cookTime: dish.cookTime || '',
            description: dish.description || '',
            image: dish.image || '',
            categoryId: dish.categoryId || ''
          },
          ingredients: dish.ingredients || [''],
          selectedCategoryIndex: categoryIndex > -1 ? categoryIndex : 0
        })
      }
      
      wx.hideLoading()
    } catch (err) {
      console.error('获取菜品详情失败：', err)
      wx.hideLoading()
      wx.showToast({
        title: '获取菜品详情失败',
        icon: 'none'
      })
    }
  },

  // 选择分类
  onCategoryChange(e) {
    const index = e.detail.value
    
    this.setData({
      selectedCategoryIndex: index
    })
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.setData({
          tempImagePath: tempFilePath
        })
      }
    })
  },

  // 移除图片
  removeImage() {
    this.setData({
      tempImagePath: '',
      'dishData.image': ''
    })
  },

  // 添加配料
  addIngredient() {
    const ingredients = this.data.ingredients
    ingredients.push('')
    
    this.setData({
      ingredients
    })
  },

  // 更新配料
  updateIngredient(e) {
    const { index } = e.currentTarget.dataset
    const value = e.detail.value
    const ingredients = this.data.ingredients
    
    ingredients[index] = value
    
    this.setData({
      ingredients
    })
  },

  // 移除配料
  removeIngredient(e) {
    const { index } = e.currentTarget.dataset
    const ingredients = this.data.ingredients
    
    if (ingredients.length > 1) {
      ingredients.splice(index, 1)
      
      this.setData({
        ingredients
      })
    } else {
      wx.showToast({
        title: '至少保留一个配料',
        icon: 'none'
      })
    }
  },

  // 取消编辑
  cancelEdit() {
    wx.navigateBack()
  },

  // 提交表单
  async submitForm(e) {
    const formData = e.detail.value
    const { selectedCategoryIndex, categories, tempImagePath, ingredients, isEdit, dishId } = this.data
    
    // 表单验证
    if (!formData.name) {
      return wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      })
    }
    
    if (!formData.cookTime) {
      return wx.showToast({
        title: '请输入烹饪时间',
        icon: 'none'
      })
    }
    
    if (!categories || categories.length === 0) {
      return wx.showToast({
        title: '暂无分类数据，请先添加分类',
        icon: 'none'
      })
    }
    
    // 过滤空的配料
    const validIngredients = ingredients.filter(item => item.trim() !== '')
    
    wx.showLoading({
      title: '保存中...'
    })
    
    try {
      // 上传图片到云存储
      let imageUrl = this.data.dishData.image
      
      if (tempImagePath) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `dishes/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`,
          filePath: tempImagePath
        })
        
        if (uploadRes.fileID) {
          imageUrl = uploadRes.fileID
        }
      }
      
      // 获取选中的分类ID
      const categoryId = categories[selectedCategoryIndex]._id;
      
      // 准备菜品数据
      const dishData = {
        name: formData.name,
        cookTime: parseInt(formData.cookTime),
        description: formData.description,
        image: imageUrl,
        categoryId: categoryId,
        ingredients: validIngredients,
        rating: isEdit ? this.data.dishData.rating || 5.0 : 5.0,
        updateTime: new Date()
      }
      
      const db = wx.cloud.database()
      
      if (isEdit) {
        // 更新菜品
        await db.collection('dishes').doc(dishId).update({
          data: dishData
        })
      } else {
        // 添加菜品
        await db.collection('dishes').add({
          data: {
            ...dishData,
            createTime: new Date()
          }
        })
      }
      
      wx.hideLoading()
      
      wx.showToast({
        title: isEdit ? '更新成功' : '添加成功',
        icon: 'success'
      })
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      console.error('保存菜品失败：', err)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    }
  }
}) 