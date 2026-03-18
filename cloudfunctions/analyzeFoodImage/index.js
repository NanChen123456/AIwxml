const cloud = require("wx-server-sdk")
const http = require("http")
const https = require("https")
const { URL } = require("url")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MOCK_NUTRITION_LIBRARY = [
  { keyword: "米饭", food: { name: "米饭", portionText: "约 1 碗", calories: 232, carbs: 50.2, protein: 4.3, fat: 0.4 } },
  { keyword: "面", food: { name: "面食", portionText: "约 1 碗", calories: 320, carbs: 58, protein: 11, fat: 4.5 } },
  { keyword: "鸡胸", food: { name: "鸡胸肉", portionText: "约 120g", calories: 198, carbs: 0, protein: 37.1, fat: 4.3 } },
  { keyword: "牛肉", food: { name: "牛肉", portionText: "约 100g", calories: 235, carbs: 2.5, protein: 26.4, fat: 12.1 } },
  { keyword: "鸡蛋", food: { name: "鸡蛋", portionText: "约 1 个", calories: 78, carbs: 0.6, protein: 6.3, fat: 5.3 } },
  { keyword: "沙拉", food: { name: "蔬菜沙拉", portionText: "约 1 份", calories: 96, carbs: 8.2, protein: 3.2, fat: 5.1 } },
  { keyword: "奶茶", food: { name: "奶茶", portionText: "约 1 杯", calories: 280, carbs: 42, protein: 4.5, fat: 11 } },
  { keyword: "咖啡", food: { name: "拿铁咖啡", portionText: "约 1 杯", calories: 146, carbs: 13, protein: 7, fat: 7 } },
  { keyword: "苹果", food: { name: "苹果", portionText: "约 1 个", calories: 95, carbs: 25.1, protein: 0.5, fat: 0.3 } },
  { keyword: "香蕉", food: { name: "香蕉", portionText: "约 1 根", calories: 105, carbs: 27, protein: 1.3, fat: 0.4 } },
  { keyword: "酸奶", food: { name: "酸奶", portionText: "约 1 杯", calories: 135, carbs: 17.1, protein: 11.4, fat: 3.8 } },
]

exports.main = async (event) => {
  const imageFileID = event.imageFileID
  const remark = (event.remark || "").trim()

  if (!imageFileID) {
    throw new Error("缺少 imageFileID，无法开始识别")
  }

  const downloadResult = await cloud.downloadFile({ fileID: imageFileID })
  const analysis = await analyzeNutrition({
    imageBuffer: downloadResult.fileContent,
    imageFileID,
    remark,
  })

  return normalizeAnalysisResult(analysis)
}

async function analyzeNutrition({ imageBuffer, imageFileID, remark }) {
  const baseUrl = process.env.AI_BASE_URL
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL
  const provider = process.env.AI_PROVIDER_NAME || "mock-estimator"

  if (!baseUrl || !apiKey || !model) {
    return buildMockAnalysis(remark)
  }

  const imageBase64 = Buffer.from(imageBuffer).toString("base64")
  const mimeType = guessMimeType(imageFileID)
  const promptText = buildPrompt(remark)
  const payload = {
    model,
    temperature: 0.1,
    max_tokens: Number(process.env.AI_MAX_TOKENS) || 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "你是营养识别助手。你必须只返回一个 JSON 对象，不要返回解释、不要返回 Markdown、不要返回代码块。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  }

  if (isQwenProvider(provider, baseUrl, model)) {
    payload.enable_thinking = false
  }

  const response = await requestJson({ url: baseUrl, apiKey, payload })
  const content = extractContent(response)
  const parsed = parseStructuredContent(content)

  return {
    ...parsed,
    aiProvider: provider,
    aiRawText: typeof content === "string" ? content : JSON.stringify(content),
    recognitionStatus: "success",
  }
}

function buildPrompt(remark) {
  return [
    "请识别图片中的食物，并结合备注估算营养。",
    "你必须输出 JSON。",
    "不要输出解释，不要输出 Markdown，不要输出 ```json 代码块。",
    "JSON 结构必须如下：",
    "{",
    '  "recognizedFoods": [{',
    '    "name": "食物名称",',
    '    "portionText": "分量描述",',
    '    "calories": 123.4,',
    '    "carbs": 12.3,',
    '    "protein": 8.8,',
    '    "fat": 4.5',
    "  }],",
    '  "totals": {',
    '    "calories": 123.4,',
    '    "carbs": 12.3,',
    '    "protein": 8.8,',
    '    "fat": 4.5',
    "  }",
    "}",
    "若无法完全确定，请输出合理估算值，不要返回 null。",
    `用户备注：${remark || "无"}`,
  ].join("\n")
}

function buildMockAnalysis(remark) {
  const matches = MOCK_NUTRITION_LIBRARY.filter((item) => remark.includes(item.keyword)).slice(0, 4)
  const foods = matches.length ? matches.map((item) => item.food) : [
    {
      name: "综合餐食",
      portionText: remark || "约 1 份",
      calories: 420,
      carbs: 42,
      protein: 24,
      fat: 16,
    },
  ]

  const totals = foods.reduce((acc, food) => ({
    calories: acc.calories + Number(food.calories || 0),
    carbs: acc.carbs + Number(food.carbs || 0),
    protein: acc.protein + Number(food.protein || 0),
    fat: acc.fat + Number(food.fat || 0),
  }), { calories: 0, carbs: 0, protein: 0, fat: 0 })

  return {
    recognizedFoods: foods,
    totals,
    aiProvider: "mock-estimator",
    aiRawText: JSON.stringify({ source: "mock", remark }),
    recognitionStatus: "success",
  }
}

function normalizeAnalysisResult(result = {}) {
  const foods = Array.isArray(result.recognizedFoods) ? result.recognizedFoods : []
  if (!foods.length) {
    throw new Error("AI 未返回可用食物数据")
  }

  const normalizedFoods = foods.map((food) => ({
    name: food.name || "未命名食物",
    portionText: food.portionText || "",
    calories: round(food.calories),
    carbs: round(food.carbs),
    protein: round(food.protein),
    fat: round(food.fat),
  }))

  const computedTotals = normalizedFoods.reduce((acc, food) => ({
    calories: acc.calories + food.calories,
    carbs: acc.carbs + food.carbs,
    protein: acc.protein + food.protein,
    fat: acc.fat + food.fat,
  }), { calories: 0, carbs: 0, protein: 0, fat: 0 })

  const totals = result.totals || computedTotals

  return {
    recognizedFoods: normalizedFoods,
    totals: {
      calories: round(totals.calories != null ? totals.calories : computedTotals.calories),
      carbs: round(totals.carbs != null ? totals.carbs : computedTotals.carbs),
      protein: round(totals.protein != null ? totals.protein : computedTotals.protein),
      fat: round(totals.fat != null ? totals.fat : computedTotals.fat),
    },
    aiProvider: result.aiProvider || "unknown-provider",
    aiRawText: result.aiRawText || "",
    recognitionStatus: result.recognitionStatus || "success",
  }
}

function extractContent(response = {}) {
  const choice = (((response || {}).choices || [])[0] || {}).message || {}
  const content = choice.content
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").join("")
  }
  throw new Error("AI 返回格式不支持，无法解析 content")
}

function parseStructuredContent(content) {
  const raw = String(content || "").trim()
  if (!raw) {
    throw new Error("AI 返回内容为空")
  }

  const candidates = [raw]
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    candidates.push(fenced[1].trim())
  }

  const firstBrace = raw.indexOf("{")
  const lastBrace = raw.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1))
  }

  for (let i = 0; i < candidates.length; i += 1) {
    try {
      return JSON.parse(candidates[i])
    } catch (error) {
      // continue
    }
  }

  console.error("AI raw content parse failed:", raw)
  throw new Error("AI 返回内容不是合法 JSON")
}

function requestJson({ url, apiKey, payload }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const body = JSON.stringify(payload)
    const requestOptions = {
      method: "POST",
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${apiKey}`,
      },
    }

    const requester = parsedUrl.protocol === "http:" ? http : https
    const req = requester.request(requestOptions, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8")
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`AI 服务请求失败: ${res.statusCode} ${rawBody}`))
          return
        }
        try {
          resolve(JSON.parse(rawBody))
        } catch (error) {
          reject(new Error(`AI 服务返回非 JSON 内容: ${rawBody}`))
        }
      })
    })

    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

function isQwenProvider(provider, baseUrl, model) {
  const providerText = String(provider || "").toLowerCase()
  const baseUrlText = String(baseUrl || "").toLowerCase()
  const modelText = String(model || "").toLowerCase()
  return providerText.includes("qwen") || baseUrlText.includes("dashscope") || modelText.includes("qwen")
}

function guessMimeType(fileID) {
  const lower = String(fileID || "").toLowerCase()
  if (lower.endsWith(".png")) {
    return "image/png"
  }
  if (lower.endsWith(".webp")) {
    return "image/webp"
  }
  return "image/jpeg"
}

function round(value) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return 0
  }
  return Number(numeric.toFixed(1))
}