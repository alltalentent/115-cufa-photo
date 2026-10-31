# CUFA PHOTO CONTROL｜單檔 Apps Script + GitHub Pages

## 確認採用的架構
- **Google Sheets**：個人資料、拍攝任務及流程，保持私有。
- **Google Apps Script**：只需要 `Code.gs`。沒有 `Index.html`，不使用 `HtmlService`。
- **GitHub Pages**：根目錄 `index.html` 是完整拍攝控制前端。
- API：GitHub 以 `fetch`、`POST`、`text/plain;charset=utf-8` 傳送 JSON，Apps Script 以 `doPost` 回傳 JSON。
- `doGet` 只回傳無個資的 API 狀態 JSON，用來檢查 /exec 部署。

## Google 端設定
1. 把 GitHub `apps-script/Code.gs` **全文**貼到 Apps Script 的 `Code.gs`。
2. 刪除 Apps Script 內的 `Index.html`（若存在）。GitHub 根目錄 `index.html` **不得刪除**。
3. 在 Apps Script「專案設定 → 指令碼屬性」設定：
   - `SPREADSHEET_ID`：你要使用的 Google Sheets 網址 `/d/` 和 `/edit` 中間的一段 ID。
   - `ADMIN_PASSWORD`：獨立強管理密碼。
4. 將 Apps Script 以執行身分「我」、存取「任何人」發布網頁應用，重新建立**版本**或更新部署。
5. Github `index.html` 中的 API URL 應指向部署的 /exec。現用網址：`AKfycbypwBfQXgB4eUmfK2qBmlKjYHvcr1V7m822Q8kf6G3AGwsSu0q5m3BbQDONAzrDTl0Z`。
6. 直接開啟 /exec 的 GET 回應應為 `api-online` JSON；它**不能**證明 JSON POST/CORS 已通過。

## 資料欄位
使用現存工作表：`拍攝學生名單`、`拍攝流程`、`ShootTasks`、`CheckIns`、`LiveControl`、`ActivityLogs`。不要在測試時修改正式學生資料。

## 注意事項
- 使用獨立 Apps Script 專案時，`getActiveSpreadsheet()` 可能是 `null`，因此新版優先使用設定的 `SPREADSHEET_ID` 配合 `SpreadsheetApp.openById()`，比照系服已成功系統。
- 用 `Code.gs` 代替 Apps Script HTML 頁面只能解決 HTML 檔案依賴，**不能自行解決 CORS 或 Google 網頁應用權限問題**。
- 系服使用者提供的 `Code.gs` 參考檔含 `doGet/HtmlService`，但無 `doPost`；不能直接替換拍攝系統後端。
- 不要把學生個資或管理密碼提交到 GitHub。
