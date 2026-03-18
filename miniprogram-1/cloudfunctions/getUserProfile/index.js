const cloud = require("wx-server-sdk")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const DEFAULT_DAILY_TARGETS = {
  calories: 2000,
  carbs: 250,
  protein: 75,
  fat: 60,
}

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const [recordRes, summaryRes] = await Promise.all([
    db.collection("nutrition_records").where({ openid }).count(),
    db.collection("daily_nutrition_summaries").where({ openid }).count(),
  ])

  const targets = { ...DEFAULT_DAILY_TARGETS }
  let hasCustomDailyTarget = false

  try {
    const settingRes = await db.collection("user_settings").where({ openid }).limit(1).get()
    const setting = (settingRes.data || [])[0] || {}
    if (
      Number(setting.dailyTargetCalories) > 0 ||
      Number(setting.dailyTargetCarbs) > 0 ||
      Number(setting.dailyTargetProtein) > 0 ||
      Number(setting.dailyTargetFat) > 0
    ) {
      targets.calories = Number(setting.dailyTargetCalories) || DEFAULT_DAILY_TARGETS.calories
      targets.carbs = Number(setting.dailyTargetCarbs) || DEFAULT_DAILY_TARGETS.carbs
      targets.protein = Number(setting.dailyTargetProtein) || DEFAULT_DAILY_TARGETS.protein
      targets.fat = Number(setting.dailyTargetFat) || DEFAULT_DAILY_TARGETS.fat
      hasCustomDailyTarget = true
    }
  } catch (error) {
    console.error("getUserProfile user_settings read failed:", error)
  }

  return {
    openid,
    recordCount: recordRes.total,
    summaryCount: summaryRes.total,
    dailyTargetCalories: targets.calories,
    dailyTargetCarbs: targets.carbs,
    dailyTargetProtein: targets.protein,
    dailyTargetFat: targets.fat,
    hasCustomDailyTarget,
  }
}