const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const summaryCollection = db.collection('daily_nutrition_summaries')
const recordCollection = db.collection('nutrition_records')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const date = event.date || getChinaDate()
  const summaryDays = Number(event.summaryDays) || 14
  const recordLimit = Number(event.recordLimit) || 20

  const summary = await getSummary(wxContext.OPENID, date)
  const table = await getSummaryTable(wxContext.OPENID, summaryDays)
  const records = await getRecords(wxContext.OPENID, date, recordLimit)

  return {
    summary,
    table,
    records,
  }
}

async function getSummary(openid, date) {
  const result = await summaryCollection.where({ openid, date }).limit(1).get()
  if (result.data.length) {
    return result.data[0]
  }
  return buildZeroSummary(openid, date)
}

async function getSummaryTable(openid, limit) {
  const result = await summaryCollection.where({ openid }).orderBy('date', 'desc').limit(limit).get()
  return result.data
}

async function getRecords(openid, date, limit) {
  const result = await recordCollection.where({ openid, recordDate: date }).orderBy('createdAt', 'desc').limit(limit).get()
  return result.data
}

function buildZeroSummary(openid, date) {
  return {
    openid,
    date,
    totalCalories: 0,
    totalCarbs: 0,
    totalProtein: 0,
    totalFat: 0,
    mealBreakdown: {
      breakfast: emptyTotals(),
      lunch: emptyTotals(),
      dinner: emptyTotals(),
      snack: emptyTotals(),
    },
    recordCount: 0,
    updatedAt: `${date}T00:00:00+08:00`,
  }
}

function emptyTotals() {
  return {
    calories: 0,
    carbs: 0,
    protein: 0,
    fat: 0,
  }
}

function getChinaDate() {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${shifted.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
