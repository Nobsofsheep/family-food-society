const app = getApp();

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    nickname: '',
    isModified: false,
    formattedTime: ''
  },

  onLoad: function (options) {
    this.initUserInfo();
  },

  onShow: function () {
    this.initUserInfo();
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 初始化用户信息
  initUserInfo: function() {
    const userInfo = app.globalData.userInfo;
    const isAdmin = app.globalData.isAdmin;
    
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isAdmin: isAdmin,
        nickname: userInfo.nickname || '',
        formattedTime: this.formatTime(userInfo.createTime)
      });
    } else {
      // 用户未登录，返回设置页
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  },

  // 选择头像
  onChooseAvatar: async function(e) {
    const { avatarUrl } = e.detail;
    
    wx.showLoading({
      title: '上传中...'
    });
    
    try {
      // 生成唯一的文件名
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const fileExt = 'jpg';
      const cloudPath = `avatars/${timestamp}-${random}.${fileExt}`;
      
      // 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });
      
      if (uploadRes.fileID) {
        // 更新用户信息
        const res = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'updateUserInfo',
            data: {
              avatar: uploadRes.fileID
            }
          }
        });

        if (res.result.code === 0) {
          // 更新全局数据
          const userData = res.result.data;
          app.globalData.userInfo = userData;
          
          // 更新页面数据
          this.setData({
            userInfo: userData
          });

          wx.showToast({
            title: '头像更新成功',
            icon: 'success'
          });
        } else {
          throw new Error(res.result.msg || '更新失败');
        }
      }
    } catch (err) {
      console.error('更新头像失败：', err);
      wx.showToast({
        title: '更新失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 监听昵称输入
  onNicknameInput: function(e) {
    const newNickname = e.detail.value;
    this.setData({
      nickname: newNickname,
      isModified: newNickname !== this.data.userInfo.nickname
    });
  },

  // 获取手机号
  getPhoneNumber: async function(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '获取手机号失败',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '处理中...'
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getPhoneNumber',
          data: {
            cloudID: e.detail.cloudID
          }
        }
      });

      if (res.result.code === 0) {
        // 更新用户信息
        const updateRes = await wx.cloud.callFunction({
          name: 'user',
          data: {
            action: 'updateUserInfo',
            data: {
              phoneNumber: res.result.data.phoneNumber
            }
          }
        });

        if (updateRes.result.code === 0) {
          // 更新全局数据
          const userData = updateRes.result.data;
          app.globalData.userInfo = userData;
          
          // 更新页面数据
          this.setData({
            userInfo: userData
          });

          wx.showToast({
            title: '绑定成功',
            icon: 'success'
          });
        } else {
          throw new Error(updateRes.result.msg || '绑定失败');
        }
      } else {
        throw new Error(res.result.msg || '获取手机号失败');
      }
    } catch (err) {
      console.error('绑定手机号失败：', err);
      wx.showToast({
        title: err.message || '绑定失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 保存用户信息
  saveUserInfo: async function() {
    if (!this.data.isModified) {
      wx.showToast({
        title: '昵称未修改',
        icon: 'none'
      });
      return;
    }

    const nickname = this.data.nickname.trim();
    if (!nickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...'
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserInfo',
          data: {
            nickname: nickname
          }
        }
      });

      if (res.result.code === 0) {
        // 更新全局数据
        const userData = res.result.data;
        app.globalData.userInfo = userData;
        
        // 更新页面数据
        this.setData({
          userInfo: userData,
          isModified: false
        });

        wx.showToast({
          title: '昵称修改成功',
          icon: 'success',
          complete: () => {
            setTimeout(() => {
              wx.navigateBack({
                delta: 1
              });
            }, 1500);
          }
        });
      } else {
        throw new Error(res.result.msg || '保存失败');
      }
    } catch (err) {
      console.error('保存失败：', err);
      wx.showToast({
        title: err.message || '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
}); 