const app = getApp();

Page({
  data: {
    users: [],
    loading: false,
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    searchKeyword: '',
    filterRole: '',  // '' 表示全部，'admin' 表示管理员，'user' 表示普通用户
  },

  onLoad() {
    console.log('页面加载，当前用户状态：', {
      isLogin: app.globalData.isLogin,
      isAdmin: app.globalData.isAdmin,
      userInfo: app.globalData.userInfo
    });

    // 检查管理员权限
    if (!app.globalData.isAdmin) {
      wx.showToast({
        title: '需要管理员权限',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
      return;
    }

    // 确保用户已登录
    if (!app.globalData.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/settings/settings'
            });
          }, 1500);
        }
      });
      return;
    }

    this.loadUsers();
  },

  onShow() {
    console.log('页面显示，当前用户状态：', {
      isLogin: app.globalData.isLogin,
      isAdmin: app.globalData.isAdmin
    });

    // 检查管理员权限
    if (!app.globalData.isAdmin) {
      wx.showToast({
        title: '需要管理员权限',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
      return;
    }

    // 如果没有用户数据，重新加载
    if (this.data.users.length === 0) {
      this.loadUsers();
    }
  },

  onPullDownRefresh() {
    this.setData({
      users: [],
      currentPage: 1,
      hasMore: true
    }, () => {
      this.loadUsers(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadUsers();
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '未知';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    
    return `${year}年${month}月${day}日 周${weekDay} ${hours}:${minutes}:${seconds}`;
  },

  // 加载用户列表
  async loadUsers(callback) {
    if (this.data.loading || (!this.data.hasMore && this.data.currentPage > 1)) {
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUsers',
          data: {
            page: this.data.currentPage,
            pageSize: this.data.pageSize,
            keyword: this.data.searchKeyword,
            role: this.data.filterRole === 'all' ? '' : this.data.filterRole
          }
        }
      });

      if (res.result && res.result.code === 0) {
        // 格式化时间
        const formattedUsers = res.result.data.users.map(user => ({
          ...user,
          createTime: this.formatTime(user.createTime)
        }));

        this.setData({
          users: this.data.currentPage === 1 ? formattedUsers : [...this.data.users, ...formattedUsers],
          hasMore: res.result.data.hasMore,
          loading: false
        });
      } else {
        throw new Error(res.result ? res.result.msg : '获取用户列表失败');
      }
    } catch (err) {
      console.error('加载用户列表失败：', err);
      wx.showToast({
        title: err.message || '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    }

    if (callback) callback();
  },

  // 搜索用户
  onSearch(e) {
    const keyword = e.detail.value;
    console.log('搜索关键词：', keyword);
    this.setData({
      searchKeyword: keyword,
      users: [],
      currentPage: 1,
      hasMore: true
    }, () => {
      this.loadUsers();
    });
  },

  // 筛选用户角色
  onFilterRole(e) {
    const role = e.currentTarget.dataset.role;
    console.log('筛选角色：', role);
    this.setData({
      filterRole: role,
      users: [],
      currentPage: 1,
      hasMore: true
    }, () => {
      this.loadUsers();
    });
  },

  // 设置用户角色
  async setUserRole(e) {
    const {userId, role} = e.currentTarget.dataset;
    const newRole = role === 'admin' ? 'user' : 'admin';
    
    try {
      console.log('更新用户角色：', { userId, currentRole: role, newRole });

      if (!userId) {
        throw new Error('用户ID不能为空');
      }

      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserRole',
          data: {
            userId: userId,
            role: newRole
          }
        }
      });

      console.log('更新角色返回结果：', res);

      if (res.result && res.result.code === 0) {
        // 更新本地数据
        const users = this.data.users.map(user => {
          if (user._id === userId) {
            return { ...user, role: newRole };
          }
          return user;
        });
        
        this.setData({ users });
        
        wx.showToast({
          title: '角色更新成功',
          icon: 'success'
        });
      } else {
        console.error('云函数返回错误：', res);
        throw new Error(res.result ? res.result.msg : '更新用户角色失败');
      }
    } catch (err) {
      console.error('设置用户角色失败：', {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        userId,
        currentRole: role,
        newRole
      });
      wx.showToast({
        title: err.message || '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 禁用/启用用户
  async toggleUserStatus(e) {
    const {userId, status} = e.currentTarget.dataset;
    const newStatus = status === 'disabled' ? 'normal' : 'disabled';
    
    try {
      console.log('更新用户状态：', { userId, currentStatus: status, newStatus });

      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserStatus',
          data: {
            userId: userId,
            status: newStatus
          }
        }
      });

      console.log('更新状态返回结果：', res);

      if (res.result && res.result.code === 0) {
        // 更新本地数据
        const users = this.data.users.map(user => {
          if (user._id === userId) {
            return { ...user, status: newStatus };
          }
          return user;
        });
        
        this.setData({ users });
        
        wx.showToast({
          title: newStatus === 'disabled' ? '已禁用' : '已启用',
          icon: 'success'
        });
      } else {
        throw new Error(res.result ? res.result.msg : '更新用户状态失败');
      }
    } catch (err) {
      console.error('切换用户状态失败：', err);
      wx.showToast({
        title: err.message || '操作失败，请重试',
        icon: 'none'
      });
    }
  }
}); 