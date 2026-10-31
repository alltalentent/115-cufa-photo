# CUFA PHOTO CONTROL｜正式部署指南

## 架構
GitHub Pages (完整 UI) → Cloudflare Worker (CORS proxy) → Apps Script JSON API → Google Sheets。

本次新加 Worker 的原因：Google Apps Script ContentService 使用 302 redirect 到 script.googleusercontent.com，瀏覽器端跨網域 fetch 在某些環境無法完成。Worker 以伺服器對伺服器方式跟隨 redirect，然後回應 GitHub Pages 前端。

## 第一步：部署免費 Cloudflare Worker
1. 建立或登入 https://dash.cloudflare.com/ 。
2. 開啟 Workers & Pages → Create → Worker，建立 Worker。免費方案可用，依帳戶方案及配額為準。
3. 使用 Edit code，把 GitHub 的 `worker/proxy.js` **完整貼入**並儲存、部署。
4. 複製 Cloudflare 提供的 `https://<name>.<subdomain>.workers.dev` 網址。

## 第二步：提供 Worker 網址
將該 `workers.dev` 網址貼給 ChatGPT，我會直接更新 GitHub 的 `config.js` 中 `proxyUrl`，不需再更動前端其它檔案。

## Apps Script
- 原 `apps-script/Code.gs` 必須已部署含 `doPost` 的最新版本。
- 執行身分：我。存取：任何人。
- `ADMIN_PASSWORD` 只設在 Apps Script Script Properties，絕不放到 GitHub。
- 由於 Google Workspace 網域政策，即使選了「任何人」，也可能無法匿名存取；若 Worker 回報 HTML/非 JSON，就需要處理 Apps Script 部署或網域權限。

## 安全與保護
- 公開 GitHub、Cloudflare Worker 程式中不含密碼與學生個資。
- Worker 限制網頁 Origin，但 Origin/CORS **不是**身份驗證；真正資料操作均在 Apps Script 後端驗證密碼。
- 不支援匿名資料 API。
- 對管理密碼建議加上 Cloudflare Rate Limiting/Turnstile 等措施，正式處理個資前應審查權限、傳輸與稽核設計。
- 請勿將 `ADMIN_PASSWORD` 提供給聊天或提交 GitHub。
- Google API 如果在傳回 302 時已完成寫入而後續回應失敗，**不要盲目重試同一個寫入操作**，應先重新整理資料檢查。
