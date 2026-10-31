# CUFA PHOTO CONTROL — GitHub 直接操作版

## 架構
GitHub Pages 的 `index.html` 是完整操作介面。它用 Google Identity Services 取得 Google ID Token，透過 `text/plain` POST 傳給 Apps Script `doPost`。Apps Script **每次請求**向 Google tokeninfo 驗證 ID Token 的 audience、email_verified，再檢查私人 Google Sheets 的 `Users` 授權名單，才執行讀寫。不要在 GitHub 放任何學生資料、工作人員密碼或服務帳號金鑰。

## 上線前必須完成
1. 在 Google Cloud 建立「網頁應用程式」OAuth Client ID，將 `https://alltalentent.github.io` 設為授權 JavaScript 來源。OAuth Client ID 可公開，但不是 Client Secret。
2. 在綁定正式試算表的 Apps Script 中，更新 `Code.gs` 為儲存庫 `apps-script/Code.gs` 的內容，並於「專案設定 → 指令碼屬性」新增 `GOOGLE_CLIENT_ID`，值為上一步的 Client ID。
3. Apps Script 網頁應用建立**新版本**，以擁有試算表存取權的部署者身分執行，存取權限設為「任何人」以便接收跨來源請求。**這不代表 API 公開學生資料**：每次 API 呼叫必須驗證 ID Token 與 Users allowlist。若無法接受對外公開的 API 端點，不要使用這種模式。
4. 將新版本的 `/exec` URL 放入 `config.js` 的 `appsScriptUrl`；將 OAuth Client ID 放入 `googleClientId`。
5. GitHub Settings → Pages 啟用 GitHub Actions，確認部署成功。

## 強制驗收
- 先以**測試試算表**與測試 Google 帳號進行測試，不要直接寫入正式學生資料。
- 使用無權限帳號登入：API 必須拒絕；不能取得名單。
- 已授權帳號：能讀取儀表板；測試報到、叫號、開始拍攝、結束拍攝、任務狀態。
- 兩位工作人員同時報到不同學生：號碼不可重複。
- CALL 不改電子試鏡單；START 更新；FINISH 保留。
- **必須先驗證瀏覽器跨來源 POST、Apps Script 重新導向與 CORS 是否能實際完成**。系服系統的公開 POST 模式不代表受 Google 身分保護的 API 一定在所有瀏覽器可用。若瀏覽器擋住，不能用關閉驗證或公開 Sheets 來繞過；應改用可正確處理 CORS 的受保護後端或同源工作介面。

## 尚未完成
Google OAuth Client ID 尚未提供，`config.js` 中為空。Apps Script 程式碼只在 GitHub 更新，尚未同步至實際 Apps Script 專案、也未重新部署。故正式功能目前不可用。
