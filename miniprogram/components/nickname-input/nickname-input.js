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

    onInput(e) {
      const nickname = e.detail.value;
      this.setData({
        nickname: nickname
      });
      this.triggerEvent('nicknameChange', { nickname });
    }
  }
}
