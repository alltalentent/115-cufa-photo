# CUFA PHOTO CONTROL｜部署（系服同款架構）

## 已完成
- GitHub Pages：完整前端 `index.html` + `config.js`。
- Google Apps Script：`apps-script/Code.gs`，用 `doPost` 提供 JSON API。
- Google Sheets：沿用原資料表，不需重新匯入。

## Apps Script（唯一需要人工更新的後端）
1. 在**原有綁定 Google Sheets 的 Apps Script 專案**中，以 GitHub `apps-script/Code.gs` 全文取代 `Code.gs`。
2. 在「專案設定 → 指令碼屬性」設定 `ADMIN_PASSWORD` 為獨立強密碼（請勿放進 GitHub）。
3. 「部署 → 管理部署作業 → 編輯」建立新版本，執行身分選「我」，誰可以存取選「任何人」，更新正式 /exec 部署。
4. `config.js` 已設定既有 /exec 網址。若 Google 配發新網址，必須一併更新。
5. 由 https://alltalentent.github.io/115-cufa-photo/ 進入完整工作介面，不再透過 Apps Script HTML 頁面。

## 連線方式
前端：`fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action, password, ...}) })`
後端：`doPost(e)` → `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(ContentService.MimeType.JSON)`。

## 注意
- 正式讀取與寫入依靠 Apps Script 以擁有者身分存取 Google Sheets。所有 API 動作需密碼。
- 這是完整程式部署，並不代表已在使用者帳號/正式瀏覽器上驗證通訊與每個操作。
- 不要在公開 GitHub 儲存學生個資或管理密碼。
- 若前端仍顯示 Failed to fetch，必須確認 Apps Script /exec 的匿名可用性、Google 跳轉與 CORS；系服同款程式碼不能保證不同 Apps Script 部署自動通過跨來源限制。
