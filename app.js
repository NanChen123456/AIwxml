const CLOUD_ENV_ID = 'cloud1-7gqhrdyj857f5c4c'

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 及以上基础库以支持云能力')
      return
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    })

    this.globalData.cloudEnvId = CLOUD_ENV_ID
  },

  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
  },
})
