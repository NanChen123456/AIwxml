const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const recordCollection = db.collection('nutrition_records')
const summaryCollection = db.collection('daily_nutrition_summaries')
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const now = getChinaNow()
  const recordDate = event.recordDate || now.date

  validatePayload(event)

  const record = {
    openid: wxContext.OPENID,
    imageFileID: event.imageFileID,
    remark: event.remark || '',
    mealType: event.mealType,
    recognizedFoods: sanitizeFoods(event.recognizedFoods),
    totals: sanitizeTotals(event.totals),
    aiRawText: event.aiRawText || '',
    aiProvider: event.aiProvider || 'unknown-provider',
    recognitionStatus: 'success',
    recordDate,
    createdAt: now.dateTime,
    updatedAt: now.dateTime,
  }

  const addResult = await recordCollection.add({ data: record })

  try {
    await recomputeDailySummary(wxContext.OPENID, recordDate)
    return {
      recordId: addResult._id,
      recordDate,
    }
  } catch (error) {
    return {
      recordId: addResult._id,
      recordDate,
      warning: '记录已保存，但每日汇总重算失败，请稍后刷新或重新进入汇总页。',
      warningDetail: error.message,
    }
  }
}

async function recomputeDailySummary(openid, recordDate) {
  const records = await fetchAllByDate(openid, recordDate)
  const summary = buildSummary(openid, recordDate, records)
  const existing = await summaryCollection.where({ openid, date: recordDate }).limit(1).get()

  if (existing.data.length) {
    await summaryCollection.doc(existing.data[0]._id).update({ data: summary })
    return
  }

  await summaryCollection.add({ data: summary })
}

async function fetchAllByDate(openid, recordDate) {
  const pageSize = 100
  let skip = 0
  let all = []
  while (true) {
    const result = await recordCollection.where({ openid, recordDate }).skip(skip).limit(pageSize).get()
    all = all.concat(result.data)
    if (result.data.length < pageSize) {
      return all
    }
    skip += pageSize
  }
}

function buildSummary(openid, recordDate, records) {
  const baseMealBreakdown = {
    breakfast: emptyTotals(),
    lunch: emptyTotals(),
    dinner: emptyTotals(),
    snack: emptyTotals(),
  }

  const totals = emptyTotals()

  records.forEach((record) => {
    const normalized = sanitizeTotals(record.totals)
    totals.calories += normalized.calories
    totals.carbs += normalized.carbs
    totals.protein += normalized.protein
    totals.fat += normalized.fat

    if (!baseMealBreakdown[record.mealType]) {
      baseMealBreakdown[record.mealType] = emptyTotals()
    }
    baseMealBreakdown[record.mealType].calories += normalized.calories
    baseMealBreakdown[record.mealType].carbs += normalized.carbs
    baseMealBreakdown[record.mealType].protein += normalized.protein
    baseMealBreakdown[record.mealType].fat += normalized.fat
  })

  return {
    openid,
    date: recordDate,
    totalCalories: round(totals.calories),
    totalCarbs: round(totals.carbs),
    totalProtein: round(totals.protein),
    totalFat: round(totals.fat),
    mealBreakdown: normalizeMealBreakdown(baseMealBreakdown),
    recordCount: records.length,
    updatedAt: getChinaNow().dateTime,
  }
}

function validatePayload(payload) {
  if (!payload.imageFileID) {
    throw new Error('缺少 imageFileID')
  }
  if (!MEAL_TYPES.includes(payload.mealType)) {
    throw new Error('mealType 不合法')
  }
  if (!Array.isArray(payload.recognizedFoods) || !payload.recognizedFoods.length) {
    throw new Error('recognizedFoods 不能为空')
  }
}

function sanitizeFoods(foods) {
  return foods.map((food) => ({
    name: food.name || '未命名食物',
    portionText: food.portionText || '',
    calories: round(food.calories),
    carbs: round(food.carbs),
    protein: round(food.protein),
    fat: round(food.fat),
  }))
}

function sanitizeTotals(totals = {}) {
  return {
    calories: round(totals.calories),
    carbs: round(totals.carbs),
    protein: round(totals.protein),
    fat: round(totals.fat),
  }
}

function normalizeMealBreakdown(mealBreakdown) {
  return Object.keys(mealBreakdown).reduce((acc, key) => {
    acc[key] = sanitizeTotals(mealBreakdown[key])
    return acc
  }, {})
}

function emptyTotals() {
  return {
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
  }
}

function round(value) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 0
  }
  return Number(numeric.toFixed(1))
}

function getChinaNow() {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${shifted.getUTCDate()}`.padStart(2, '0')
  const hour = `${shifted.getUTCHours()}`.padStart(2, '0')
  const minute = `${shifted.getUTCMinutes()}`.padStart(2, '0')
  const second = `${shifted.getUTCSeconds()}`.padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    dateTime: `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`,
  }
}
