Page({

  /**
   * 页面的初始数据
   */
  data: {
    dishes: [],
    filteredDishes: [], // 添加过滤后的菜品列表
    loading: true,
    searchValue: '',
    filterVisible: false,
    categories: [], // 完整的分类数据
    categoryNames: [], // 仅分类名称
    selectedCategory: '全部'  // 默认显示全部
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
    this.getCategories() // 每次显示页面时重新获取分类
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
      
      // 先获取分类数据
      const categoriesRes = await db.collection('categories').get()
      const categories = categoriesRes.data || []

      // 实现获取所有菜品，突破20条限制
      const MAX_LIMIT = 20 // 每次最多获取20条
      
      // 先获取数据总数
      const countResult = await db.collection('dishes').count()
      const total = countResult.total
      console.log(`菜品总数: ${total}`)
      
      // 计算需要分几次请求
      const batchTimes = Math.ceil(total / MAX_LIMIT)
      console.log(`需要进行 ${batchTimes} 次请求获取所有数据`)
      
      // 批量请求数据
      let allDishes = []
      
      if (batchTimes === 0) {
        console.log('没有菜品数据')
      } else {
        // 使用循环依次获取数据，而不是并行请求
        for (let i = 0; i < batchTimes; i++) {
          const skipCount = i * MAX_LIMIT
          console.log(`正在获取第 ${i+1}/${batchTimes} 批数据, 跳过前 ${skipCount} 条`)
          
          const res = await db.collection('dishes')
            .skip(skipCount)
            .limit(MAX_LIMIT)
            .get()
            
          console.log(`第 ${i+1} 批获取到 ${res.data.length} 条数据`)
          allDishes = allDishes.concat(res.data)
        }
        
        console.log(`共获取到菜品数量: ${allDishes.length}, 总数应该是: ${total}`)
      }
      
      // 处理菜品数据，确保每个菜品都有categories字段
      const processedDishes = allDishes.map(dish => {
        // 如果没有categories字段，根据categoryId查找对应的分类名称
        if (!dish.categories) {
          const category = categories.find(c => c._id === dish.categoryId)
          dish.categories = category ? [category.name] : []
        }
        return dish
      })
      
      // 自定义排序规则：置顶菜品排在首位，其他菜品按order值排序，新添加菜品排在末尾
      processedDishes.sort((a, b) => {
        // 如果a是置顶的而b不是，a排在前面
        if (a.isTop && !b.isTop) return -1
        // 如果b是置顶的而a不是，b排在前面
        if (!a.isTop && b.isTop) return 1
        
        // 对于都是置顶或都不是置顶的情况，按order值排序
        // 如果有createTime或updateTime，将没有order值的新菜品放在末尾
        if ((!a.order && a.createTime) && b.order) return 1 // a是新菜品，b不是，a排后面
        if (a.order && (!b.order && b.createTime)) return -1 // b是新菜品，a不是，b排后面
        
        // 否则按order值升序排列
        return (a.order || 999999) - (b.order || 999999)
      })
      
      this.setData({
        dishes: processedDishes,
        loading: false
      }, () => {
        this.filterByCategory()  // 获取数据后立即进行分类过滤
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
      const res = await db.collection('categories')
        .orderBy('order', 'asc')  // 按order字段排序
        .get()
      
      this.setData({
        categories: res.data || [], // 保存完整的分类数据
        categoryNames: res.data.map(item => item.name) || []
      })
    } catch (err) {
      console.error('获取分类失败：', err)
    }
  },

  // 筛选分类
  filterByCategory(e) {
    let category = this.data.selectedCategory
    if (e) {
      category = e.currentTarget.dataset.category
      this.setData({ 
        selectedCategory: category,
        searchValue: ''
      })
    }

    let filtered = [...this.data.dishes]
    
    // 如果不是"全部"分类，则进行过滤
    if (category !== '全部') {
      filtered = filtered.filter(dish => 
        dish.categories && dish.categories.includes(category)
      )
    }

    // 排序逻辑已经在getDishes中处理，保持filtered顺序
    // 确保筛选不改变菜品的显示顺序

    this.setData({
      filteredDishes: filtered
    })
  },

  // 搜索输入
  onSearchInput(e) {
    const value = e.detail.value.toLowerCase()
    this.setData({ 
      searchValue: value
    })
    
    if (!value) {
      this.filterByCategory()  // 如果搜索框为空，恢复显示当前分类的菜品
      return
    }

    // 使用后端搜索而不是前端过滤
    this.searchDishes(value)
  },
  
  // 搜索菜品 - 使用批量请求
  async searchDishes(keyword) {
    try {
      const db = wx.cloud.database()
      const _ = db.command
      
      this.setData({ loading: true })
      
      // 先获取分类数据
      const categoriesRes = await db.collection('categories').get()
      const categories = categoriesRes.data || []
      
      // 使用正则表达式构建搜索条件
      const regex = db.RegExp({
        regexp: keyword,
        options: 'i'
      })
      
      // 构建搜索条件
      let searchCondition = _.or([
        { name: regex },
        { description: regex }
      ])
      
      // 如果选择了特定分类，添加分类过滤条件
      if (this.data.selectedCategory !== '全部') {
        const categoryId = categories.find(c => c.name === this.data.selectedCategory)?._id
        if (categoryId) {
          searchCondition = _.and([
            searchCondition,
            { categoryId: categoryId }
          ])
        }
      }
      
      // 先获取匹配条件的数据总数
      const countResult = await db.collection('dishes')
        .where(searchCondition)
        .count()
      const total = countResult.total
      console.log(`搜索菜品总数: ${total}`)
      
      // 计算需要分几次请求
      const MAX_LIMIT = 20 // 每次最多获取20条
      const batchTimes = Math.ceil(total / MAX_LIMIT)
      console.log(`搜索需要进行 ${batchTimes} 次请求获取所有数据`)
      
      // 批量请求数据
      let allDishes = []
      
      if (batchTimes === 0) {
        console.log('没有匹配的菜品数据')
      } else {
        // 使用循环依次获取数据，而不是并行请求
        for (let i = 0; i < batchTimes; i++) {
          const skipCount = i * MAX_LIMIT
          console.log(`搜索中：正在获取第 ${i+1}/${batchTimes} 批数据, 跳过前 ${skipCount} 条`)
          
          const res = await db.collection('dishes')
            .where(searchCondition)
            .skip(skipCount)
            .limit(MAX_LIMIT)
            .get()
            
          console.log(`搜索第 ${i+1} 批获取到 ${res.data.length} 条数据`)
          allDishes = allDishes.concat(res.data)
        }
        
        console.log(`搜索共获取到菜品数量: ${allDishes.length}, 总数应该是: ${total}`)
      }
      
      // 处理菜品数据，确保每个菜品都有categories字段
      const processedDishes = allDishes.map(dish => {
        // 如果没有categories字段，根据categoryId查找对应的分类名称
        if (!dish.categories) {
          const category = categories.find(c => c._id === dish.categoryId)
          dish.categories = category ? [category.name] : []
        }
        return dish
      })
      
      // 自定义排序规则：置顶菜品排在首位，其他菜品按order值排序，新添加菜品排在末尾
      processedDishes.sort((a, b) => {
        // 如果a是置顶的而b不是，a排在前面
        if (a.isTop && !b.isTop) return -1
        // 如果b是置顶的而a不是，b排在前面
        if (!a.isTop && b.isTop) return 1
        
        // 对于都是置顶或都不是置顶的情况，按order值排序
        // 如果有createTime或updateTime，将没有order值的新菜品放在末尾
        if ((!a.order && a.createTime) && b.order) return 1 // a是新菜品，b不是，a排后面
        if (a.order && (!b.order && b.createTime)) return -1 // b是新菜品，a不是，b排后面
        
        // 否则按order值升序排列
        return (a.order || 999999) - (b.order || 999999)
      })
      
      // 更新数据
      this.setData({
        filteredDishes: processedDishes,
        loading: false
      })
    } catch (err) {
      console.error('搜索菜品失败：', err)
      this.setData({ loading: false })
    }
  },
  
  // 显示/隐藏筛选
  toggleFilter() {
    this.setData({
      filterVisible: !this.data.filterVisible
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
  },

  // 向上移动菜品
  async moveDishUp(e) {
    const index = e.currentTarget.dataset.index
    const dishes = [...this.data.filteredDishes]
    const currentDish = dishes[index]
    
    // 如果已经是第一个，则不移动
    if (index === 0) return
    
    try {
      const db = wx.cloud.database()
      
      // 只交换order值，保持各自的置顶状态
      const dish1 = dishes[index - 1]
      const dish2 = currentDish
      const order1 = dish1.order || 0
      const order2 = dish2.order || 0
      
      // 先更新数据库
      await db.collection('dishes').doc(dish1._id).update({
        data: { 
          order: order2
        }
      })
      await db.collection('dishes').doc(dish2._id).update({
        data: { 
          order: order1
        }
      })
      
      // 创建新对象而不是修改原对象
      const updatedDishes = [...dishes];
      
      // 创建新的菜品对象，而不是直接修改原对象
      updatedDishes[index - 1] = {...updatedDishes[index - 1], order: order2};
      updatedDishes[index] = {...updatedDishes[index], order: order1};
      
      // 交换位置
      [updatedDishes[index - 1], updatedDishes[index]] = [updatedDishes[index], updatedDishes[index - 1]];
      
      // 更新全部菜品列表
      const allDishes = [...this.data.dishes];
      
      // 在全部菜品中找到对应项并创建新对象
      for (let i = 0; i < allDishes.length; i++) {
        if (allDishes[i]._id === dish1._id) {
          allDishes[i] = {...allDishes[i], order: order2};
        } else if (allDishes[i]._id === dish2._id) {
          allDishes[i] = {...allDishes[i], order: order1};
        }
      }
      
      // 更新数据
      this.setData({
        filteredDishes: updatedDishes,
        dishes: allDishes
      })
      
      // 触发菜品排序更新事件
      const app = getApp()
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', {
          type: 'orderChange',
          ids: [dish1._id, dish2._id]
        })
      }
    } catch (err) {
      console.error('移动菜品失败：', err)
      wx.showToast({
        title: '移动失败',
        icon: 'none'
      })
    }
  },

  // 向下移动菜品
  async moveDishDown(e) {
    const index = e.currentTarget.dataset.index
    const dishes = [...this.data.filteredDishes]
    const currentDish = dishes[index]
    
    // 如果已经是最后一个，则不移动
    if (index === dishes.length - 1) return
    
    try {
      const db = wx.cloud.database()
      
      // 只交换order值，保持各自的置顶状态
      const dish1 = currentDish
      const dish2 = dishes[index + 1]
      const order1 = dish1.order || 0
      const order2 = dish2.order || 0
      
      // 先更新数据库
      await db.collection('dishes').doc(dish1._id).update({
        data: { 
          order: order2
        }
      })
      await db.collection('dishes').doc(dish2._id).update({
        data: { 
          order: order1
        }
      })
      
      // 创建新对象而不是修改原对象
      const updatedDishes = [...dishes];
      
      // 创建新的菜品对象，而不是直接修改原对象
      updatedDishes[index] = {...updatedDishes[index], order: order2};
      updatedDishes[index + 1] = {...updatedDishes[index + 1], order: order1};
      
      // 交换位置
      [updatedDishes[index], updatedDishes[index + 1]] = [updatedDishes[index + 1], updatedDishes[index]];
      
      // 更新全部菜品列表
      const allDishes = [...this.data.dishes];
      
      // 在全部菜品中找到对应项并创建新对象
      for (let i = 0; i < allDishes.length; i++) {
        if (allDishes[i]._id === dish1._id) {
          allDishes[i] = {...allDishes[i], order: order2};
        } else if (allDishes[i]._id === dish2._id) {
          allDishes[i] = {...allDishes[i], order: order1};
        }
      }
      
      // 更新数据
      this.setData({
        filteredDishes: updatedDishes,
        dishes: allDishes
      })
      
      // 触发菜品排序更新事件
      const app = getApp()
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', {
          type: 'orderChange',
          ids: [dish1._id, dish2._id]
        })
      }
    } catch (err) {
      console.error('移动菜品失败：', err)
      wx.showToast({
        title: '移动失败',
        icon: 'none'
      })
    }
  },

  // 更新菜品顺序到数据库
  async updateDishOrder() {
    try {
      const db = wx.cloud.database()
      
      // 分别计算置顶和非置顶菜品的顺序
      const updatePromises = this.data.filteredDishes.map((dish, index) => {
        return db.collection('dishes').doc(dish._id).update({
          data: {
            order: index
          }
        })
      })

      await Promise.all(updatePromises)

      // 触发菜品排序更新事件
      const app = getApp()
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', {
          type: 'orderChange',
          data: this.data.filteredDishes
        })
      }

      wx.showToast({
        title: '排序已更新',
        icon: 'success'
      })
      
      // 重新获取菜品列表
      await this.getDishes()
    } catch (err) {
      console.error('更新菜品顺序失败：', err)
      wx.showToast({
        title: '更新顺序失败',
        icon: 'none'
      })
    }
  },

  // 切换置顶状态
  async toggleTop(e) {
    const { id, index } = e.currentTarget.dataset
    const dish = this.data.filteredDishes[index]
    const newTopStatus = !dish.isTop
    
    try {
      const db = wx.cloud.database()
      const _ = db.command
      let orderValue = 0
      
      // 如果是取消置顶
      if (!newTopStatus) {
        // 获取所有置顶菜品
        const topDishesResult = await db.collection('dishes')
          .where({
            isTop: true,
            _id: _.neq(id) // 排除当前操作的菜品
          })
          .get()
        
        if (topDishesResult.data && topDishesResult.data.length > 0) {
          // 获取所有置顶菜品的order值
          const topDishOrders = topDishesResult.data.map(d => d.order || 0)
          // 找出最大的order值
          const maxTopOrder = Math.max(...topDishOrders)
          // 将取消置顶的菜品order设为最大置顶order+1
          orderValue = maxTopOrder + 1
          console.log(`取消置顶：将菜品放在最后一个置顶菜品后，order值设为: ${orderValue}`)
        } else {
          // 如果没有其他置顶菜品，保持原位置不变
          orderValue = dish.order || 0
          console.log(`取消置顶：没有其他置顶菜品，保持原位置，order值: ${orderValue}`)
        }
      }
      
      // 更新置顶状态和order
      await db.collection('dishes').doc(id).update({
        data: {
          isTop: newTopStatus,
          order: newTopStatus ? 0 : orderValue,
          updateTime: new Date()
        }
      })
      
      // 获取过滤前的所有菜品
      const allDishes = [...this.data.dishes]
      // 更新本地数据（过滤后的列表）
      const filteredDishes = [...this.data.filteredDishes]
      
      // 更新过滤后菜品列表中的数据
      filteredDishes[index].isTop = newTopStatus
      filteredDishes[index].order = newTopStatus ? 0 : orderValue
      filteredDishes[index].updateTime = new Date()
      
      // 更新全部菜品列表中的对应数据
      const allIndex = allDishes.findIndex(d => d._id === id)
      if (allIndex >= 0) {
        allDishes[allIndex].isTop = newTopStatus
        allDishes[allIndex].order = newTopStatus ? 0 : orderValue
        allDishes[allIndex].updateTime = new Date()
      }
      
      // 重新排序
      const sort = (list) => {
        return list.sort((a, b) => {
          // 如果a是置顶的而b不是，a排在前面
          if (a.isTop && !b.isTop) return -1
          // 如果b是置顶的而a不是，b排在前面
          if (!a.isTop && b.isTop) return 1
          
          // 对于都是置顶或都不是置顶的情况，按order值排序
          // 如果有createTime或updateTime，将没有order值的新菜品放在末尾
          if ((!a.order && a.createTime) && b.order) return 1 // a是新菜品，b不是，a排后面
          if (a.order && (!b.order && b.createTime)) return -1 // b是新菜品，a不是，b排后面
          
          // 否则按order值升序排列
          return (a.order || 999999) - (b.order || 999999)
        })
      }
      
      // 对两个列表排序
      const sortedFiltered = sort(filteredDishes)
      const sortedAll = sort(allDishes)
      
      this.setData({ 
        filteredDishes: sortedFiltered,
        dishes: sortedAll
      })
      
      // 触发菜品更新事件
      const app = getApp()
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', {
          type: 'update',
          data: sortedAll
        })
      }

      wx.showToast({
        title: newTopStatus ? '已置顶' : '已取消置顶',
        icon: 'success'
      })
      
      // 触发菜品排序更新事件
      if (app.globalData && app.globalData.eventBus) {
        app.globalData.eventBus.emit('dishUpdate', {
          type: 'orderChange',
          id: id,
          isTop: newTopStatus
        })
      }
    } catch (err) {
      console.error('更新置顶状态失败：', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },
}) 