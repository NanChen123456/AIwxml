const { DEFAULT_DAILY_TARGETS } = require('../../utils/util')

function getSaveTargetErrorMessage(error) {
  const message = String((error && error.message) || (error && error.errMsg) || '')
  if (message.includes('collection') || message.includes('user_settings')) {
    return '请先在云开发里创建 user_settings 集合，再重试保存。'
  }
  if (message.includes('Cloud function') || message.includes('callFunction')) {
    return '请重新上传 updateUserTarget 云函数后再试。'
  }
  return '保存失败，请稍后重试。'
}

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
    dailyTargetCalories: DEFAULT_DAILY_TARGETS.calories,
    dailyTargetCarbs: DEFAULT_DAILY_TARGETS.carbs,
    dailyTargetProtein: DEFAULT_DAILY_TARGETS.protein,
    dailyTargetFat: DEFAULT_DAILY_TARGETS.fat,
    targetInputCalories: String(DEFAULT_DAILY_TARGETS.calories),
    targetInputCarbs: String(DEFAULT_DAILY_TARGETS.carbs),
    targetInputProtein: String(DEFAULT_DAILY_TARGETS.protein),
    targetInputFat: String(DEFAULT_DAILY_TARGETS.fat),
    hasCustomDailyTarget: false,
    savingTarget: false,
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
            loading: false,
          })
          await this.loadUserStats()
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

  onTargetInput(event) {
    const field = event.currentTarget.dataset.field
    const value = String(event.detail.value || '').replace(/[^0-9]/g, '')
    this.setData({ [field]: value })
  },

  async saveDailyTarget() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const payload = {
      dailyTargetCalories: Number(this.data.targetInputCalories),
      dailyTargetCarbs: Number(this.data.targetInputCarbs),
      dailyTargetProtein: Number(this.data.targetInputProtein),
      dailyTargetFat: Number(this.data.targetInputFat),
    }

    if (!payload.dailyTargetCalories || !payload.dailyTargetCarbs || !payload.dailyTargetProtein || !payload.dailyTargetFat) {
      wx.showToast({ title: '请完整填写四项目标', icon: 'none' })
      return
    }

    this.setData({ savingTarget: true })
    try {
      const result = await this.callCloudFunction('updateUserTarget', payload)
      this.setData({
        dailyTargetCalories: Number(result.dailyTargetCalories) || payload.dailyTargetCalories,
        dailyTargetCarbs: Number(result.dailyTargetCarbs) || payload.dailyTargetCarbs,
        dailyTargetProtein: Number(result.dailyTargetProtein) || payload.dailyTargetProtein,
        dailyTargetFat: Number(result.dailyTargetFat) || payload.dailyTargetFat,
        targetInputCalories: String(Number(result.dailyTargetCalories) || payload.dailyTargetCalories),
        targetInputCarbs: String(Number(result.dailyTargetCarbs) || payload.dailyTargetCarbs),
        targetInputProtein: String(Number(result.dailyTargetProtein) || payload.dailyTargetProtein),
        targetInputFat: String(Number(result.dailyTargetFat) || payload.dailyTargetFat),
        hasCustomDailyTarget: true,
        savingTarget: false,
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error(error)
      this.setData({ savingTarget: false })
      wx.showToast({ title: getSaveTargetErrorMessage(error), icon: 'none', duration: 3000 })
    }
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
      dailyTargetCalories: DEFAULT_DAILY_TARGETS.calories,
      dailyTargetCarbs: DEFAULT_DAILY_TARGETS.carbs,
      dailyTargetProtein: DEFAULT_DAILY_TARGETS.protein,
      dailyTargetFat: DEFAULT_DAILY_TARGETS.fat,
      targetInputCalories: String(DEFAULT_DAILY_TARGETS.calories),
      targetInputCarbs: String(DEFAULT_DAILY_TARGETS.carbs),
      targetInputProtein: String(DEFAULT_DAILY_TARGETS.protein),
      targetInputFat: String(DEFAULT_DAILY_TARGETS.fat),
      hasCustomDailyTarget: false,
      savingTarget: false,
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
        dailyTargetCalories: Number(result.dailyTargetCalories) || DEFAULT_DAILY_TARGETS.calories,
        dailyTargetCarbs: Number(result.dailyTargetCarbs) || DEFAULT_DAILY_TARGETS.carbs,
        dailyTargetProtein: Number(result.dailyTargetProtein) || DEFAULT_DAILY_TARGETS.protein,
        dailyTargetFat: Number(result.dailyTargetFat) || DEFAULT_DAILY_TARGETS.fat,
        targetInputCalories: String(Number(result.dailyTargetCalories) || DEFAULT_DAILY_TARGETS.calories),
        targetInputCarbs: String(Number(result.dailyTargetCarbs) || DEFAULT_DAILY_TARGETS.carbs),
        targetInputProtein: String(Number(result.dailyTargetProtein) || DEFAULT_DAILY_TARGETS.protein),
        targetInputFat: String(Number(result.dailyTargetFat) || DEFAULT_DAILY_TARGETS.fat),
        hasCustomDailyTarget: Boolean(result.hasCustomDailyTarget),
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