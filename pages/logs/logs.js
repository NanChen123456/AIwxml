const { formatDate, toFixedNumber } = require('../../utils/util')

function mapTableRow(row = {}) {
  return {
    date: row.date || '',
    totalCaloriesText: toFixedNumber(row.totalCalories),
    totalCarbsText: toFixedNumber(row.totalCarbs),
    totalProteinText: toFixedNumber(row.totalProtein),
    totalFatText: toFixedNumber(row.totalFat),
    recordCount: Number(row.recordCount) || 0,
  }
}

Page({
  data: {
    rows: [],
    loading: false,
    errorText: '',
    isLoggedIn: false,
  },

  onLoad() {
    this.refreshLoginState()
  },

  onShow() {
    this.refreshLoginState()
  },

  refreshLoginState() {
    const profile = wx.getStorageSync('userProfile') || {}
    const isLoggedIn = Boolean(profile.loggedIn)
    this.setData({
      isLoggedIn,
      rows: isLoggedIn ? this.data.rows : [],
      errorText: '',
    })
    if (isLoggedIn) {
      this.loadSummaryRows()
    }
  },

  retryLoad() {
    if (this.data.isLoggedIn) {
      this.loadSummaryRows()
    }
  },

  goToUserTab() {
    wx.switchTab({
      url: '/pages/user/user',
    })
  },

  async loadSummaryRows() {
    this.setData({ loading: true, errorText: '' })
    try {
      const result = await this.callCloudFunction('getDailySummary', {
        date: formatDate(new Date()),
        summaryDays: 60,
        recordLimit: 0,
      })
      this.setData({
        rows: Array.isArray(result.table) ? result.table.map(mapTableRow) : [],
        loading: false,
      })
    } catch (error) {
      console.error(error)
      this.setData({ loading: false, errorText: error.message || '每日汇总加载失败，请稍后重试。' })
    }
  },

  callCloudFunction(name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({ name, data, success: ({ result }) => resolve(result || {}), fail: reject })
    })
  },
})