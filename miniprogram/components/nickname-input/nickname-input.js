Component({
  properties: {
    placeholder: {
      type: String,
      value: '请输入昵称'
    }
  },

  data: {
    nickname: '',
    isLogin: false,
    cartCount: 0
  },

  methods: {
    // 获取微信昵称
    getWxNickname() {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          const nickname = res.userInfo.nickName;
          this.setData({
            nickname: nickname
          });
          this.triggerEvent('nicknameChange', { nickname });
        },
        fail: (err) => {
          console.log('获取用户信息失败', err);
          wx.showToast({
            title: '获取昵称失败',
            icon: 'none'
          });
        }
      });
    },

    // 输入框内容变化
    onInput(e) {
      const nickname = e.detail.value;
      this.setData({
        nickname: nickname
      });
      this.triggerEvent('nicknameChange', { nickname });
    },

    onNicknameChange(e) {
      const nickname = e.detail.nickname;
      // 处理昵称变化
    }
  }
}); 