const {
  EMPTY_TOTALS,
  MEAL_OPTIONS,
  enrichFood,
  formatDate,
  mealLabelOf,
  normalizeTotals,
  summaryRowFromData,
  toFixedNumber,
} = require('../../utils/util')

const HOME_SUMMARY_DAYS = 7
const MAX_AI_IMAGE_SIZE = 7 * 1024 * 1024
const COMPRESSION_QUALITIES = [80, 60, 40, 25]

function mapFood(food = {}) {
  const enriched = enrichFood(food)
  return {
    ...enriched,
    caloriesText: toFixedNumber(enriched.calories),
    carbsText: toFixedNumber(enriched.carbs),
    proteinText: toFixedNumber(enriched.protein),
    fatText: toFixedNumber(enriched.fat),
  }
}

function mapRecord(record = {}) {
  const totals = normalizeTotals(record.totals)
  const foods = Array.isArray(record.recognizedFoods) ? record.recognizedFoods.map(mapFood) : []
  const firstFoodName = foods.length ? foods[0].name : '未命名食物'
  return {
    ...record,
    recognizedFoods: foods,
    mealTypeLabel: mealLabelOf(record.mealType),
    createdAtText: record.createdAt ? record.createdAt.replace('T', ' ').slice(0, 16) : '',
    historyTitle: `${firstFoodName}${foods.length > 1 ? ' 等' : ''}`,
    totalsText: {
      calories: toFixedNumber(totals.calories),
      carbs: toFixedNumber(totals.carbs),
      protein: toFixedNumber(totals.protein),
      fat: toFixedNumber(totals.fat),
    },
  }
}

function getReadableErrorMessage(error) {
  const message = String((error && error.message) || '')
  if (message.includes('合法 JSON') || message.includes('JSON')) {
    return 'AI 返回格式异常，请重试一次。'
  }
  if (message.includes('超时')) {
    return 'AI 识别超时，请稍后重试。'
  }
  if (message.includes('请求失败')) {
    return 'AI 服务请求失败，请稍后重试。'
  }
  return '识别失败，请稍后重试。'
}

Page({
  data: {
    mealOptions: MEAL_OPTIONS,
    mealType: 'breakfast',
    remark: '',
    localImagePath: '',
    compressedImagePath: '',
    uploadedFileID: '',
    analyzeState: 'idle',
    statusText: '上传一张食物照片，补充备注后开始识别。',
    recognizedFoods: [],
    totals: { ...EMPTY_TOTALS },
    totalsText: {
      calories: '0.0',
      carbs: '0.0',
      protein: '0.0',
      fat: '0.0',
    },
    aiRawText: '',
    aiProvider: '',
    latestSummary: summaryRowFromData({ date: formatDate(new Date()) }),
    recentRecords: [],
    isBusy: false,
  },

  onLoad() {
    this.refreshHomeData()
  },

  onShow() {
    this.refreshHomeData()
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value })
  },

  onMealTypeChange(event) {
    this.setData({ mealType: event.currentTarget.dataset.value })
  },

  chooseImage() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: ({ tapIndex }) => {
        const sourceType = tapIndex === 0 ? ['camera'] : ['album']
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType,
          success: (res) => {
            const file = (res.tempFiles || [])[0] || {}
            const sizeText = this.formatSize(file.size)
            this.setData({
              localImagePath: file.tempFilePath || '',
              compressedImagePath: '',
              uploadedFileID: '',
              analyzeState: 'idle',
              statusText: file.size ? `图片已选择，原图大小约 ${sizeText}，上传前会自动压缩。` : '图片已选择，可以开始 AI 识别。',
              recognizedFoods: [],
              totals: { ...EMPTY_TOTALS },
              totalsText: {
                calories: '0.0',
                carbs: '0.0',
                protein: '0.0',
                fat: '0.0',
              },
              aiRawText: '',
              aiProvider: '',
            })
          },
          fail: () => {
            wx.showToast({ title: '未选择图片', icon: 'none' })
          },
        })
      },
    })
  },

  clearImage() {
    this.setData({
      localImagePath: '',
      compressedImagePath: '',
      uploadedFileID: '',
      analyzeState: 'idle',
      statusText: '已清空图片，请重新上传。',
      recognizedFoods: [],
      totals: { ...EMPTY_TOTALS },
      totalsText: {
        calories: '0.0',
        carbs: '0.0',
        protein: '0.0',
        fat: '0.0',
      },
      aiRawText: '',
      aiProvider: '',
    })
  },

  async analyzeImage() {
    if (!this.data.localImagePath) {
      wx.showToast({ title: '请先上传图片', icon: 'none' })
      return
    }

    try {
      this.setData({ analyzeState: 'uploading', isBusy: true, statusText: '正在检查并压缩图片...' })
      const uploadedFileID = await this.ensureUploadedFile()
      this.setData({ uploadedFileID, analyzeState: 'analyzing', statusText: 'AI 正在识别食物和营养数据...' })

      const result = await this.callCloudFunction('analyzeFoodImage', {
        imageFileID: uploadedFileID,
        remark: this.data.remark,
      })

      const recognizedFoods = Array.isArray(result.recognizedFoods) ? result.recognizedFoods.map(mapFood) : []
      const totals = normalizeTotals(result.totals)

      if (!recognizedFoods.length) {
        throw new Error('AI 返回的食物列表为空')
      }

      this.setData({
        analyzeState: 'analyzeSuccess',
        isBusy: false,
        recognizedFoods,
        totals,
        totalsText: {
          calories: toFixedNumber(totals.calories),
          carbs: toFixedNumber(totals.carbs),
          protein: toFixedNumber(totals.protein),
          fat: toFixedNumber(totals.fat),
        },
        aiRawText: result.aiRawText || '',
        aiProvider: result.aiProvider || '',
        statusText: `识别完成，当前服务：${result.aiProvider || '未命名模型'}`,
      })
    } catch (error) {
      console.error(error)
      const readableMessage = getReadableErrorMessage(error)
      this.setData({ analyzeState: 'analyzeFailed', isBusy: false, statusText: readableMessage })
      wx.showToast({ title: '识别失败', icon: 'none' })
    }
  },

  async saveRecord() {
    if (this.data.analyzeState !== 'analyzeSuccess') {
      wx.showToast({ title: '请先完成识别', icon: 'none' })
      return
    }

    try {
      this.setData({ analyzeState: 'saving', isBusy: true, statusText: '正在保存营养记录...' })
      const result = await this.callCloudFunction('saveNutritionRecord', {
        imageFileID: this.data.uploadedFileID,
        remark: this.data.remark,
        mealType: this.data.mealType,
        recognizedFoods: this.data.recognizedFoods,
        totals: this.data.totals,
        aiRawText: this.data.aiRawText,
        aiProvider: this.data.aiProvider,
      })

      wx.showToast({ title: result.warning ? '记录已保存' : '保存成功', icon: 'success' })
      this.setData({
        mealType: 'breakfast',
        remark: '',
        localImagePath: '',
        compressedImagePath: '',
        uploadedFileID: '',
        analyzeState: 'idle',
        isBusy: false,
        statusText: result.warning || '记录已保存，可以继续识别下一餐。',
        recognizedFoods: [],
        totals: { ...EMPTY_TOTALS },
        totalsText: {
          calories: '0.0',
          carbs: '0.0',
          protein: '0.0',
          fat: '0.0',
        },
        aiRawText: '',
        aiProvider: '',
      })
      this.refreshHomeData()
    } catch (error) {
      console.error(error)
      this.setData({ analyzeState: 'analyzeSuccess', isBusy: false, statusText: '保存失败，请稍后再试。' })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async refreshHomeData() {
    try {
      const today = formatDate(new Date())
      const result = await this.callCloudFunction('getDailySummary', {
        date: today,
        summaryDays: HOME_SUMMARY_DAYS,
        recordLimit: 5,
      }, false)

      const summary = result.summary || {}
      this.setData({
        latestSummary: summaryRowFromData({
          date: summary.date || today,
          totalCalories: summary.totalCalories,
          totalCarbs: summary.totalCarbs,
          totalProtein: summary.totalProtein,
          totalFat: summary.totalFat,
          recordCount: summary.recordCount,
        }),
        recentRecords: Array.isArray(result.records) ? result.records.map(mapRecord) : [],
      })
    } catch (error) {
      console.error(error)
    }
  },

  async ensureUploadedFile() {
    if (this.data.uploadedFileID) {
      return this.data.uploadedFileID
    }

    const preparedFilePath = await this.prepareUploadImage()
    const ext = this.getFileExtension(preparedFilePath)
    this.setData({ statusText: '正在上传图片到云存储...' })
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath: `nutrition/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`,
      filePath: preparedFilePath,
    })
    return uploadRes.fileID
  },

  async prepareUploadImage() {
    if (this.data.compressedImagePath) {
      return this.data.compressedImagePath
    }

    const originalPath = this.data.localImagePath
    const originalSize = await this.getFileSize(originalPath)
    if (!originalSize || originalSize <= MAX_AI_IMAGE_SIZE) {
      this.setData({ statusText: originalSize ? `图片大小约 ${this.formatSize(originalSize)}，无需压缩。` : '图片已就绪，准备上传。' })
      return originalPath
    }

    let currentPath = originalPath
    let currentSize = originalSize
    for (let i = 0; i < COMPRESSION_QUALITIES.length; i += 1) {
      const quality = COMPRESSION_QUALITIES[i]
      this.setData({ statusText: `图片较大，正在压缩（质量 ${quality}%）...` })
      currentPath = await this.compressImage(currentPath, quality)
      currentSize = await this.getFileSize(currentPath)
      if (currentSize && currentSize <= MAX_AI_IMAGE_SIZE) {
        this.setData({ compressedImagePath: currentPath, statusText: `图片已压缩到约 ${this.formatSize(currentSize)}，准备上传。` })
        return currentPath
      }
    }

    throw new Error(`图片压缩后仍大于 ${this.formatSize(MAX_AI_IMAGE_SIZE)}，请换一张更小的照片再试。`)
  },

  compressImage(src, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({ src, quality, success: ({ tempFilePath }) => resolve(tempFilePath), fail: reject })
    })
  },

  getFileSize(filePath) {
    return new Promise((resolve) => {
      wx.getFileInfo({ filePath, success: (res) => resolve(Number(res.size) || 0), fail: () => resolve(0) })
    })
  },

  getFileExtension(filePath) {
    const matched = String(filePath || '').split('?')[0].match(/\.([a-zA-Z0-9]+)$/)
    return matched ? matched[1].toLowerCase() : 'jpg'
  },

  formatSize(size) {
    const numeric = Number(size) || 0
    return numeric >= 1024 * 1024 ? `${(numeric / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(numeric / 1024))}KB`
  },

  callCloudFunction(name, data, showError = true) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: ({ result }) => resolve(result || {}),
        fail: (error) => {
          if (showError) {
            wx.showToast({ title: '云函数调用失败', icon: 'none' })
          }
          reject(error)
        },
      })
    })
  },
})