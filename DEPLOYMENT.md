# CUFA PHOTO CONTROL｜GitHub + Apps Script + Google Sheets

## 架構（對照系服平台）
GitHub Pages `index.html` → 瀏覽器直接 JSON POST `fetch` → Apps Script `doPost` → Google Sheets。

不需要 Cloudflare、iframe 或 Apps Script HTML 工作介面。

## 已知問題
同系服一樣的前端 fetch 寫法，在拍攝系統仍可能遇到 `Failed to fetch`。此錯誤不能單憑瀏覽器訊息判定原因。最值得優先對照：
1. 兩個 Apps Script 部署的「執行身分」與「誰可以存取」是否相同。
2. Apps Script 部署擁有者的 Google Workspace 管理員是否限制匿名存取。
3. `/exec` 是否為**最新版本**、是否為目前仍有效的部署網址。
4. 在 Network 檢查 POST 後的 HTTP status、location、CORS 訊息；若 Apps Script 執行記錄完全沒有請求，表示在抵達 doPost 前就失敗。

## 更新後端
將 `apps-script/Code.gs` 貼至與資料庫綁定的 Apps Script 專案；設定 Script Properties `ADMIN_PASSWORD`；更新網頁應用部署（執行身分為擁有者、使用者可存取依單位允許的公開設定），並確認前端 `config.js` 指向該 /exec。

## 注意
公開 GitHub 不能放密碼或學生資料。正式使用前務必確認匿名 Web App 是否允許，若不能允許，不得透過公開憑證繞過校方政策。每次操作在 Apps Script 伺服器驗證密碼。
