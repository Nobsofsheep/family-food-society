const app = getApp();

Page({
  data: {
    orders: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad: function() {
    this.loadOrders();
    // 监听订单更新事件
    app.globalData.eventBus.on('orderUpdate', this.handleOrderUpdate.bind(this));
  },

  onUnload: function() {
    // 移除订单更新事件监听
    app.globalData.eventBus.off('orderUpdate', this.handleOrderUpdate.bind(this));
  },

  // 处理订单更新
  handleOrderUpdate(snapshot) {
    if (snapshot.docChanges && snapshot.docChanges.length > 0) {
      // 重新加载订单列表
      this.setData({
        page: 1,
        hasMore: true
      });
      this.loadOrders();
    }
  },

  // 加载订单列表
  loadOrders: async function() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const db = wx.cloud.database();
      const countResult = await db.collection('orders')
        .where({
          _openid: app.globalData.openid
        })
        .count();

      const total = countResult.total;
      const skip = (this.data.page - 1) * this.data.pageSize;

      if (skip >= total) {
        this.setData({
          hasMore: false,
          loading: false
        });
        return;
      }

      const result = await db.collection('orders')
        .where({
          _openid: app.globalData.openid
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get();

      const orders = result.data.map(order => {
        // 格式化时间
        order.createTime = this.formatTime(order.createTime);
        return order;
      });

      this.setData({
        orders: this.data.page === 1 ? orders : [...this.data.orders, ...orders],
        page: this.data.page + 1,
        loading: false
      });
    } catch (err) {
      console.error('加载订单失败：', err);
      wx.showToast({
        title: '加载订单失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 格式化时间
  formatTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours();
    const minute = d.getMinutes();
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      hasMore: true
    });
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom: function() {
    this.loadOrders();
  }
}); 