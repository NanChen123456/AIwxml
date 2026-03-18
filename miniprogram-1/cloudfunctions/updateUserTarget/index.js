const cloud = require("wx-server-sdk")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const dailyTargetCalories = Number(event.dailyTargetCalories)
  const dailyTargetCarbs = Number(event.dailyTargetCarbs)
  const dailyTargetProtein = Number(event.dailyTargetProtein)
  const dailyTargetFat = Number(event.dailyTargetFat)

  if (!dailyTargetCalories || dailyTargetCalories <= 0) {
    throw new Error("每日目标热量必须大于 0")
  }
  if (!dailyTargetCarbs || dailyTargetCarbs <= 0) {
    throw new Error("每日目标碳水必须大于 0")
  }
  if (!dailyTargetProtein || dailyTargetProtein <= 0) {
    throw new Error("每日目标蛋白质必须大于 0")
  }
  if (!dailyTargetFat || dailyTargetFat <= 0) {
    throw new Error("每日目标脂肪必须大于 0")
  }

  const now = new Date().toISOString()
  const settingRes = await db.collection("user_settings").where({ openid }).limit(1).get()
  const existing = (settingRes.data || [])[0]
  const payload = {
    dailyTargetCalories,
    dailyTargetCarbs,
    dailyTargetProtein,
    dailyTargetFat,
    updatedAt: now,
  }

  if (existing && existing._id) {
    await db.collection("user_settings").doc(existing._id).update({
      data: payload,
    })
  } else {
    await db.collection("user_settings").add({
      data: {
        openid,
        ...payload,
        createdAt: now,
      },
    })
  }

  return {
    openid,
    dailyTargetCalories,
    dailyTargetCarbs,
    dailyTargetProtein,
    dailyTargetFat,
    hasCustomDailyTarget: true,
  }
}