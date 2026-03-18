const { DEFAULT_DAILY_TARGETS, formatDate, toFixedNumber } = require('../../utils/util')

function buildMetricDisplay(value, target) {
  const actual = Number(value) || 0
  const targetValue = Number(target) || 0
  const lower = targetValue * 0.9
  const upper = targetValue * 1.05
  const inRange = targetValue > 0 && actual >= lower && actual <= upper
  return {
    text: toFixedNumber(actual),
    className: inRange ? 'metric-good' : 'metric-bad',
  }
}

function mapTableRow(row = {}, targets = DEFAULT_DAILY_TARGETS) {
  return {
    date: row.date || '',
    totalCaloriesText: toFixedNumber(row.totalCalories),
    totalCarbsText: toFixedNumber(row.totalCarbs),
    totalProteinText: toFixedNumber(row.totalProtein),
    totalFatText: toFixedNumber(row.totalFat),
    recordCount: Number(row.recordCount) || 0,
    caloriesDisplay: buildMetricDisplay(row.totalCalories, targets.calories),
    carbsDisplay: buildMetricDisplay(row.totalCarbs, targets.carbs),
    proteinDisplay: buildMetricDisplay(row.totalProtein, targets.protein),
    fatDisplay: buildMetricDisplay(row.totalFat, targets.fat),
  }
}

Page({
  data: {
    rows: [],
    loading: false,
    errorText: '',
    isLoggedIn: false,
    targetCard: {
      caloriesText: toFixedNumber(DEFAULT_DAILY_TARGETS.calories),
      carbsText: toFixedNumber(DEFAULT_DAILY_TARGETS.carbs),
      proteinText: toFixedNumber(DEFAULT_DAILY_TARGETS.protein),
      fatText: toFixedNumber(DEFAULT_DAILY_TARGETS.fat),
    },
    hasCustomDailyTarget: false,
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
      const [summaryResult, profileResult] = await Promise.all([
        this.callCloudFunction('getDailySummary', {
          date: formatDate(new Date()),
          summaryDays: 60,
          recordLimit: 0,
        }),
        this.callCloudFunction('getUserProfile', {}),
      ])

      const targets = {
        calories: Number(profileResult.dailyTargetCalories) || DEFAULT_DAILY_TARGETS.calories,
        carbs: Number(profileResult.dailyTargetCarbs) || DEFAULT_DAILY_TARGETS.carbs,
        protein: Number(profileResult.dailyTargetProtein) || DEFAULT_DAILY_TARGETS.protein,
        fat: Number(profileResult.dailyTargetFat) || DEFAULT_DAILY_TARGETS.fat,
      }

      this.setData({
        rows: Array.isArray(summaryResult.table) ? summaryResult.table.map((row) => mapTableRow(row, targets)) : [],
        targetCard: {
          caloriesText: toFixedNumber(targets.calories),
          carbsText: toFixedNumber(targets.carbs),
          proteinText: toFixedNumber(targets.protein),
          fatText: toFixedNumber(targets.fat),
        },
        hasCustomDailyTarget: Boolean(profileResult.hasCustomDailyTarget),
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