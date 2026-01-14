# 正式环境验证清单 (Production Verification Checklist)

在 `descu.ai` 上线后，请按照以下步骤进行详细验证，确保所有服务正常运行。

## 🌐 1. 前端基础检查
- [ ] **域名访问**: 浏览器访问 `https://descu.ai` 能正常加载首页。
- [ ] **SSL 证书**: 地址栏显示安全锁图标 🔒，无证书警告。
- [ ] **重定向**: 访问 `http://descu.ai` 会自动跳转到 `https`。

## 🔐 2. 认证功能 (Auth)
- [ ] **Google 登录**: 点击 "登录" -> "Google"，能弹出 Google 授权窗口。
- [ ] **回调正常**: 授权后能成功跳转回首页，并显示用户头像。
- [ ] **登出**: 点击头像 -> "退出登录"，状态能通过更新。

## 🛍 3. 核心业务流程
- [ ] **商品列表加载**: 首页能加载出商品（注意区分 Mock 数据和真实数据，真实数据 ID 通常不是 `mock-` 开头）。
- [ ] **发布商品 (核心)**:
    1. 点击 "卖闲置"。
    2. 上传一张图片。
    3. **观察 AI 分析**: 是否能自动填入标题和描述？(这验证了 `descu.ai` -> 后端 -> Gemini API 的链路)。
    4. 提交发布。
    5. 在首页刷新，确认能看到刚才发布的商品。

## 📡 4. 后端 API & CORS
- [ ] **开发者工具检查**:
    1. 按 `F12` 打开开发者工具。
    2. 切换到 **Console** 标签。
    3. 确认**没有红色报错** (特别是 `Access to fetch at ... from origin ... has been blocked by CORS policy`)。
    4. 如果有 CORS 错误，说明后端 `index.ts` 中的 `origin` 列表未生效，需要检查 Railway 部署是否更新。

## 👮‍♂️ 5. 管理后台
- [ ] **访问地址**: `https://descu.ai/admin/login`
- [ ] **管理员登录**: 使用也就是 Admin 账号登录。
- [ ] **数据仪表板**: 登录后能看到数据统计，且不报错（Verification API connectivity）。

---

## 🆘 故障排除速查

| 现象 | 可能原因 | 解决方案 |
| :--- | :--- | :--- |
| **Google 登录报错** | 重定向 URI 未配置 | 检查 Supabase Auth 设置，添加 `https://descu.ai` |
| **API 请求失败 (404/500)** | 后端 URL 错误 | 检查 Vercel 环境变量 `VITE_API_URL` |
| **AI 分析无反应** | 密钥或 CORS 问题 | 检查 Railway `GEMINI_API_KEY` 和 CORS 配置 |
| **图片无法上传** | 数据库策略 (RLS) | 检查 Supabase Storage 的 Policy 设置 |
