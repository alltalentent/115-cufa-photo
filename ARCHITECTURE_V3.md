# CUFA PHOTO CONTROL — 免費架構

- GitHub Pages: 公開靜態入口頁，不載入任何學生資料。
- Google Apps Script HtmlService: 工作人員實際操作介面，使用 google.script.run 呼叫同一 Apps Script 專案的伺服器函式。
- Google Sheets: 私人學生與拍攝資料庫。
- 不使用 Cloud Run / Firestore，不需要付費 GitHub 方案。

## 為什麼不直接從 GitHub Pages fetch Apps Script API？

Apps Script 網頁應用的跨來源請求、登入身分與重新導向機制，不等同一般可自由設定 CORS 的 REST API。尤其是受 Google 帳號保護的 Apps Script，無法只靠 GitHub Pages 的 JavaScript 保證安全地直接 fetch 學生資料。

因此此版先使用 GitHub Pages **入口** → Apps Script **工作介面** → Sheets 的可靠模式。工作人員須在 Apps Script 網頁內完成操作。不要把 Apps Script 部署成「任何人」以規避登入限制。

## 管理者上線步驟

1. 使用綁定既有私人 Google Sheets 的 Apps Script 專案，保留 `apps-script/Code.gs` 與 `apps-script/Index.html`。
2. Apps Script 網頁應用部署設定為只允許授權的 Google 帳號存取，並驗證 `Session.getActiveUser().getEmail()` 可取得登入者電子郵件；若為空則拒絕。
3. 在私人 Sheets 的 `Users` 工作表啟用授權工作人員。
4. 將正式 Apps Script 網頁應用 `/exec` 網址填入根目錄 `config.js` 的 `appsScriptUrl`，此網址是公開入口連結，**不是密碼**。
5. 在 GitHub Settings → Pages 選擇 GitHub Actions。現有 `.github/workflows/pages.yml` 僅發布 `index.html` 與 `config.js`。
6. 使用測試試算表與測試帳號驗證權限、報到、叫號、拍攝狀態，確認後才開放正式工作人員使用。

## 安全邊界

GitHub 公開意味著所有版本的原始碼可被查看。不要提交 Sheets 匯出、學生資料、憑證或 API 密鑰。GitHub 入口不是權限檢查點；真正的資料授權在 Apps Script 伺服器端。對外公開的叫號螢幕如需不登入觀看，應另設**不含個資**的資料通道，不能直接公開管理 API。

原 Cloud Run 程式保留在 `backend/` 供歷史參考，但此版本不使用它。
