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
      const _ = db.command;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 实现批量获取所有菜品数据，突破20条限制
      const MAX_LIMIT = 20; // 每次最多获取20条
      
      // 先获取数据总数
      const countResult = await db.collection('dishes').count();
      const total = countResult.total;
      console.log(`菜品总数: ${total}`);
      
      // 计算需要分几次请求
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      console.log(`需要进行 ${batchTimes} 次请求获取所有数据`);
      
      // 批量请求数据
      let allDishes = [];
      
      if (batchTimes === 0) {
        console.log('没有菜品数据');
      } else {
        // 使用循环依次获取数据，而不是并行请求
        for (let i = 0; i < batchTimes; i++) {
          const skipCount = i * MAX_LIMIT;
          console.log(`正在获取第 ${i+1}/${batchTimes} 批数据, 跳过前 ${skipCount} 条`);
          
          const res = await db.collection('dishes')
            .orderBy('updateTime', 'desc')
            .skip(skipCount)
            .limit(MAX_LIMIT)
            .get();
            
          console.log(`第 ${i+1} 批获取到 ${res.data.length} 条数据`);
          allDishes = allDishes.concat(res.data);
        }
        
        console.log(`共获取到菜品数量: ${allDishes.length}, 总数应该是: ${total}`);
      }
      
      // 获取今日推荐菜品
      const recommendResult = await db.collection('dishes')
        .where({
          isRecommend: true,
          recommendDate: _.gte(today)
        })
        .get();
      
      console.log(`推荐菜品数量: ${recommendResult.data.length}`);
      
      // 标记今日推荐状态并排序（推荐的排在前面）
      const dishes = allDishes.map(dish => {
        const isRecommend = recommendResult.data.some(rec => rec._id === dish._id);
        return {
          ...dish,
          isRecommend,
          canBeRecommended: !dish.isTop // 如果是置顶菜品，则不能被推荐
        };
      }).sort((a, b) => {
        // 推荐的排在前面，相同推荐状态下按更新时间倒序
        if (a.isRecommend && !b.isRecommend) return -1;
        if (!a.isRecommend && b.isRecommend) return 1;
        return new Date(b.updateTime) - new Date(a.updateTime);
      });
      
      this.setData({
        dishes,
        loading: false
      });
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      this.setData({ loading: true });
      
      // 使用正则表达式构建搜索条件
      const regex = db.RegExp({
        regexp: keyword,
        options: 'i'
      });
      
      const searchCondition = _.or([
        { name: regex },
        { description: regex }
      ]);
      
      // 先获取匹配条件的数据总数
      const countResult = await db.collection('dishes')
        .where(searchCondition)
        .count();
      const total = countResult.total;
      console.log(`搜索菜品总数: ${total}`);
      
      // 计算需要分几次请求
      const MAX_LIMIT = 20; // 每次最多获取20条
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      console.log(`搜索需要进行 ${batchTimes} 次请求获取所有数据`);
      
      // 批量请求数据
      let allDishes = [];
      
      if (batchTimes === 0) {
        console.log('没有匹配的菜品数据');
      } else {
        // 使用循环依次获取数据，而不是并行请求
        for (let i = 0; i < batchTimes; i++) {
          const skipCount = i * MAX_LIMIT;
          console.log(`搜索中：正在获取第 ${i+1}/${batchTimes} 批数据, 跳过前 ${skipCount} 条`);
          
          const res = await db.collection('dishes')
            .where(searchCondition)
            .orderBy('updateTime', 'desc')
            .skip(skipCount)
            .limit(MAX_LIMIT)
            .get();
            
          console.log(`搜索第 ${i+1} 批获取到 ${res.data.length} 条数据`);
          allDishes = allDishes.concat(res.data);
        }
        
        console.log(`搜索共获取到菜品数量: ${allDishes.length}, 总数应该是: ${total}`);
      }
      
      // 获取今日推荐菜品
      const recommendResult = await db.collection('dishes')
        .where({
          isRecommend: true,
          recommendDate: _.gte(today)
        })
        .get();
      
      console.log(`推荐菜品数量: ${recommendResult.data.length}`);
      
      // 标记今日推荐状态并排序（推荐的排在前面）
      const dishes = allDishes.map(dish => {
        const isRecommend = recommendResult.data.some(rec => rec._id === dish._id);
        return {
          ...dish,
          isRecommend,
          canBeRecommended: !dish.isTop // 如果是置顶菜品，则不能被推荐
        };
      }).sort((a, b) => {
        // 推荐的排在前面，相同推荐状态下按更新时间倒序
        if (a.isRecommend && !b.isRecommend) return -1;
        if (!a.isRecommend && b.isRecommend) return 1;
        return new Date(b.updateTime) - new Date(a.updateTime);
      });
      
      this.setData({
        dishes,
        loading: false
      });
    } catch (err) {
      console.error('搜索菜品失败：', err);
      this.setData({ loading: false });
    }
  },

  // 设置/取消今日推荐
  async toggleRecommendDish(e) {
    const { id, isrecommend, cantop } = e.currentTarget.dataset;
    const app = getApp();
    
    // 如果是置顶菜品，不允许设置为推荐
    if (cantop && !isrecommend) {
      wx.showToast({
        title: '置顶菜品不能设为推荐',
        icon: 'none'
      });
      return;
    }
    
    try {
      const result = await app.setDishRecommend(id, !isrecommend);
      
      wx.showToast({
        title: result.msg,
        icon: 'success'
      });
      
      // 刷新菜品列表
      this.getDishes();
    } catch (err) {
      console.error('设置推荐菜品失败：', err);
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    }
  }
}); 