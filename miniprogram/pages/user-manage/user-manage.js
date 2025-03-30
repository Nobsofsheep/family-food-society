const app = getApp();

Page({
  data: {
    userList: []
  },

  onLoad: function (options) {
    this.checkAdminPermission();
    this.getUserList();
  },

  onShow: function () {
    this.checkAdminPermission();
  },

  onPullDownRefresh: function () {
    this.getUserList();
  },

  // 检查管理员权限
  checkAdminPermission: function() {
    if (!app.globalData.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
      return;
    }
    
    if (!app.globalData.isAdmin) {
      wx.showToast({
        title: '您没有管理员权限',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
      return;
    }
  },

  // 获取用户列表
  getUserList: function() {
    wx.showLoading({
      title: '加载中...',
    });
    
    wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getUserList'
      },
      success: (res) => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        
        if (res.result.code === 0) {
          this.setData({
            userList: res.result.data || []
          });
        } else {
          wx.showToast({
            title: res.result.message || '获取用户列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取用户列表失败', err);
        wx.hideLoading();
        wx.stopPullDownRefresh();
        wx.showToast({
          title: '获取用户列表失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 切换用户权限
  toggleUserRole: function(e) {
    const openid = e.currentTarget.dataset.openid;
    const currentRole = e.currentTarget.dataset.role;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    wx.showModal({
      title: '确认操作',
      content: `确定要将该用户${currentRole === 'admin' ? '降级为普通用户' : '升级为管理员'}吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...',
          });
          
          wx.cloud.callFunction({
            name: 'user',
            data: {
              action: 'updateUserRole',
              openid: openid,
              role: newRole
            },
            success: (res) => {
              wx.hideLoading();
              
              if (res.result.code === 0) {
                // 更新列表中的用户角色
                const userList = this.data.userList.map(user => {
                  if (user.openid === openid) {
                    user.role = newRole;
                  }
                  return user;
                });
                
                this.setData({
                  userList: userList
                });
                
                wx.showToast({
                  title: '操作成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result.message || '操作失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              console.error('切换用户权限失败', err);
              wx.hideLoading();
              wx.showToast({
                title: '操作失败，请重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
}) 