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
        const tempFilePath = res.tempFilePaths[0];
        
        // 检查图片大小（限制为2MB）
        wx.getFileInfo({
          filePath: tempFilePath,
          success: (fileInfo) => {
            if (fileInfo.size > 2 * 1024 * 1024) {
              wx.showToast({
                title: '图片大小不能超过2MB',
                icon: 'none'
              });
              return;
            }
            
            // 检查图片格式
            const fileExt = tempFilePath.split('.').pop().toLowerCase();
            if (!['jpg', 'jpeg', 'png'].includes(fileExt)) {
              wx.showToast({
                title: '只支持jpg/png格式图片',
                icon: 'none'
              });
              return;
            }
            
            this.setData({
              tempImagePath: tempFilePath
            });
          },
          fail: (err) => {
            console.error('获取文件信息失败：', err);
            wx.showToast({
              title: '图片处理失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败：', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 移除图片
  removeImage() {
    this.setData({
      tempImagePath: '',
      'dishData.image': ''
    });
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
    const formData = e.detail.value;
    const { selectedCategoryIndex, categories, tempImagePath, ingredients, isEdit, dishId } = this.data;
    
    // 表单验证
    if (!formData.name) {
      return wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      });
    }
    
    if (!formData.cookTime) {
      return wx.showToast({
        title: '请输入烹饪时间',
        icon: 'none'
      });
    }
    
    if (!categories || categories.length === 0) {
      return wx.showToast({
        title: '暂无分类数据，请先添加分类',
        icon: 'none'
      });
    }
    
    // 过滤空的配料
    const validIngredients = ingredients.filter(item => item.trim() !== '');
    
    wx.showLoading({
      title: '保存中...'
    });
    
    try {
      // 上传图片到云存储
      let imageUrl = this.data.dishData.image;
      
      if (tempImagePath) {
        // 生成唯一的文件名
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const fileExt = tempImagePath.split('.').pop().toLowerCase();
        const cloudPath = `dishes/${timestamp}-${random}.${fileExt}`;
        
        try {
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempImagePath,
            config: {
              env: 'family-menu-01-1gjtmbob2bba8eb5'
            }
          });
          
          if (uploadRes.fileID) {
            imageUrl = uploadRes.fileID;
          } else {
            throw new Error('上传失败：未获取到文件ID');
          }
        } catch (uploadErr) {
          console.error('图片上传失败：', uploadErr);
          wx.hideLoading();
          wx.showToast({
            title: '图片上传失败，请重试',
            icon: 'none'
          });
          return;
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
        categories: [categories[selectedCategoryIndex].name],
        ingredients: validIngredients,
        rating: isEdit ? this.data.dishData.rating || 5.0 : 5.0,
        updateTime: new Date()
      };
      
      const db = wx.cloud.database();
      
      if (isEdit) {
        // 更新菜品
        await db.collection('dishes').doc(dishId).update({
          data: dishData
        });
      } else {
        // 添加菜品
        await db.collection('dishes').add({
          data: {
            ...dishData,
            createTime: new Date()
          }
        });
      }
      
      wx.hideLoading();
      
      wx.showToast({
        title: isEdit ? '更新成功' : '添加成功',
        icon: 'success'
      });
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('保存菜品失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  }
}) 