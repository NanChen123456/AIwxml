const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const DEFAULT_DAILY_TARGET_CALORIES = 2000

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const [recordRes, summaryRes] = await Promise.all([
    db.collection('nutrition_records').where({ openid }).count(),
    db.collection('daily_nutrition_summaries').where({ openid }).count(),
  ])

  let dailyTargetCalories = DEFAULT_DAILY_TARGET_CALORIES
  let hasCustomDailyTarget = false

  try {
    const settingRes = await db.collection('user_settings').where({ openid }).limit(1).get()
    const setting = (settingRes.data || [])[0] || {}
    if (Number(setting.dailyTargetCalories) > 0) {
      dailyTargetCalories = Number(setting.dailyTargetCalories)
      hasCustomDailyTarget = true
    }
  } catch (error) {
    console.error('getUserProfile user_settings read failed:', error)
  }

  return {
    openid,
    recordCount: recordRes.total,
    summaryCount: summaryRes.total,
    dailyTargetCalories,
    hasCustomDailyTarget,
  }
}
