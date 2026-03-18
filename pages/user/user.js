Page({
  data: {
    profile: {
      avatarUrl: '',
      nickName: '',
    },
    openid: '',
    unionid: '',
    recordCount: 0,
    summaryCount: 0,
    loading: false,
    isLoggedIn: false,
  },

  onLoad() {
    this.loadProfile()
    if (this.data.isLoggedIn) {
      this.loadUserStats()
    }
  },

  onShow() {
    this.loadProfile()
    if (this.data.isLoggedIn) {
      this.loadUserStats()
    }
  },

  loadProfile() {
    const profile = wx.getStorageSync('userProfile') || {}
    const isLoggedIn = Boolean(profile.loggedIn)
    this.setData({
      profile: {
        avatarUrl: profile.avatarUrl || '',
        nickName: profile.nickName || '',
      },
      isLoggedIn,
      openid: isLoggedIn ? (profile.openid || this.data.openid) : '',
      unionid: isLoggedIn ? (profile.unionid || this.data.unionid) : '',
      recordCount: isLoggedIn ? this.data.recordCount : 0,
      summaryCount: isLoggedIn ? this.data.summaryCount : 0,
    })
  },

  handleLogin() {
    this.setData({ loading: true })
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) {
          this.setData({ loading: false })
          wx.showToast({ title: '获取登录凭证失败', icon: 'none' })
          return
        }

        try {
          const result = await this.callCloudFunction('loginWithCode', { code: loginRes.code })
          const cachedProfile = wx.getStorageSync('userProfile') || {}
          const profile = {
            avatarUrl: cachedProfile.avatarUrl || '',
            nickName: cachedProfile.nickName || '',
            loggedIn: true,
            openid: result.openid || '',
            unionid: result.unionid || '',
          }
          wx.setStorageSync('userProfile', profile)
          this.setData({
            profile: {
              avatarUrl: profile.avatarUrl,
              nickName: profile.nickName,
            },
            isLoggedIn: true,
            openid: result.openid || '',
            unionid: result.unionid || '',
            recordCount: Number(result.recordCount) || 0,
            summaryCount: Number(result.summaryCount) || 0,
            loading: false,
          })
          wx.showToast({ title: '登录成功', icon: 'success' })
        } catch (error) {
          console.error(error)
          this.setData({ loading: false })
          wx.showToast({ title: '登录失败', icon: 'none' })
        }
      },
      fail: (error) => {
        console.error(error)
        this.setData({ loading: false })
        wx.showToast({ title: '获取 code 失败', icon: 'none' })
      },
    })
  },

  chooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl || ''
    const profile = {
      ...this.data.profile,
      avatarUrl,
      loggedIn: this.data.isLoggedIn,
      openid: this.data.openid,
      unionid: this.data.unionid,
    }
    this.persistProfile(profile)
  },

  onNicknameInput(event) {
    const profile = {
      ...this.data.profile,
      nickName: event.detail.value,
      loggedIn: this.data.isLoggedIn,
      openid: this.data.openid,
      unionid: this.data.unionid,
    }
    this.persistProfile(profile)
  },

  persistProfile(profile) {
    wx.setStorageSync('userProfile', profile)
    this.setData({
      profile: {
        avatarUrl: profile.avatarUrl || '',
        nickName: profile.nickName || '',
      },
      openid: profile.openid || this.data.openid,
      unionid: profile.unionid || this.data.unionid,
    })
  },

  logout() {
    wx.removeStorageSync('userProfile')
    this.setData({
      profile: {
        avatarUrl: '',
        nickName: '',
      },
      openid: '',
      unionid: '',
      recordCount: 0,
      summaryCount: 0,
      isLoggedIn: false,
    })
  },

  async loadUserStats() {
    this.setData({ loading: true })
    try {
      const result = await this.callCloudFunction('getUserProfile', {})
      this.setData({
        openid: result.openid || this.data.openid,
        recordCount: Number(result.recordCount) || 0,
        summaryCount: Number(result.summaryCount) || 0,
        loading: false,
      })
    } catch (error) {
      console.error(error)
      this.setData({ loading: false })
      wx.showToast({ title: '用户信息加载失败', icon: 'none' })
    }
  },

  callCloudFunction(name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: ({ result }) => resolve(result || {}),
        fail: reject,
      })
    })
  },
})