# 云开发部署说明

## 1. 云环境
- 在 `app.js` 中把云环境 ID 配置成你的微信云开发环境 ID。
- 微信开发者工具中确认 `project.config.json` 已识别 `cloudfunctions/` 为云函数目录。

## 2. 数据库集合
请在云开发控制台创建以下集合：
- `nutrition_records`
- `daily_nutrition_summaries`

建议第一阶段将数据库权限设置为“仅创建者可读写”，并让云函数使用管理员权限完成写入和汇总。

## 3. 云函数依赖
部署前在开发者工具中对以下函数执行“安装依赖并上传”：
- `analyzeFoodImage`
- `saveNutritionRecord`
- `getDailySummary`
- `getUserProfile`
- `loginWithCode`

## 4. AI 服务环境变量
`analyzeFoodImage` 默认支持 OpenAI-compatible 多模态接口。
请在云函数环境变量中配置：
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_PROVIDER_NAME`
- `AI_MAX_TOKENS`

## 5. 微信官方登录环境变量
`loginWithCode` 使用官方登录链路：前端 `wx.login()` 获取 code，服务端调用 `code2Session`。
请在 `loginWithCode` 云函数环境变量中配置：
- `WECHAT_APP_ID`: 小程序 AppID
- `WECHAT_APP_SECRET`: 小程序 AppSecret

注意：不要把 `session_key` 下发到小程序，也不要在客户端保存。