const cloud = require("wx-server-sdk")
const https = require("https")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const code = event.code
  if (!code) {
    throw new Error("缺少 wx.login 返回的 code")
  }

  const appId = process.env.WECHAT_APP_ID
  const appSecret = process.env.WECHAT_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error("云函数未配置 WECHAT_APP_ID 或 WECHAT_APP_SECRET")
  }

  const session = await code2Session({ appId, appSecret, code })
  if (!session.openid) {
    throw new Error("code2Session 未返回 openid")
  }

  const [recordRes, summaryRes] = await Promise.all([
    db.collection("nutrition_records").where({ openid: session.openid }).count(),
    db.collection("daily_nutrition_summaries").where({ openid: session.openid }).count(),
  ])

  return {
    openid: session.openid,
    unionid: session.unionid || "",
    recordCount: recordRes.total,
    summaryCount: summaryRes.total,
  }
}

function code2Session({ appId, appSecret, code }) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8")
          const result = JSON.parse(body)
          if (result.errcode) {
            reject(new Error(`code2Session 失败: ${result.errcode} ${result.errmsg || ""}`))
            return
          }
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
    }).on("error", reject)
  })
}