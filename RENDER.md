# Render 部署設定

在現有 Web Service 的 Settings 設定：

- Build Command：`npm ci && npm run build`
- Start Command：`npm start`
- Node.js：24.12.0 以上（建議使用 Node 24）。

正式伺服器同時提供 `dist` 前端與 `/api`，監聽 `0.0.0.0`，優先使用 Render 自動提供的 `PORT`（通常是 `10000`）。不需另外手動設定 PORT。不要用 `npm run dev` 或 `npm run preview` 作為 Start Command。

## Persistent disk 與環境變數

先在 Render 的 Disks 查看已掛載磁碟的 Mount Path。假設是 `/var/data`，在 Environment 設定：

```text
AU5800_DB=/var/data/au5800.sqlite
AU5800_PUBLIC_ORIGIN=https://labmeched.onrender.com
AU5800_COOKIE_SECURE=true
```

若 Mount Path 不同，請把 `/var/data` 換成實際路徑。SQLite 檔案及其 WAL、SHM 檔需放在 persistent disk 內；程式會自動建立資料庫目錄。既有資料庫若位於其他位置，不會自動搬移，請先備份再遷移。

將程式變更推送到 Render 連接的 Git 分支，再執行 Deploy latest commit。啟動日誌應顯示 `AU5800 server listening on http://0.0.0.0:10000`（連接埠依 PORT 而定）。部署後確認首頁及 `/api/auth/status` 能正常回應。
