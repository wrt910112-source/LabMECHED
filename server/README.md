# 本地評量 API

2026-10-21：新日保養考試使用 `AU5800-2026-10-21-v2`，必要順序為 A→B、C→D、Cleaning＋三次 Prime→校正，試劑任意排序、其他項目全數完成→Rack。舊 v1 日保養可繼續操作及交卷；API 將考試版本傳入操作判定與評分，不重算歷史結果。周保養仍使用 v1。

Node.js 24.12+；`node server/index.mjs` 綁定 `127.0.0.1:3001`。`AU5800_DB` 指定 SQLite 檔案；預設 `data/au5800.sqlite`。首頁提供 `dist` 的正式建置。開發時使用 `npm.cmd run dev`，Vite 代理 `/api` 到後端。

| API | 用途 |
| --- | --- |
| `GET /api/auth/status` | 是否需首次建帳、目前使用者 |
| `POST /api/auth/setup` | 首次教師帳號 `{username,name,password}` |
| `POST /api/auth/login`、`logout` | 登入／登出 |
| `GET/POST /api/admin/users` | 教師查詢／建立學員 |
| `PATCH /api/admin/users/:id` | 重設密碼或 `{enabled:false}`；撤銷登入工作階段 |
| `GET /api/attempts/active` | 本人未交卷考試及模型狀態 |
| `POST /api/attempts` | `{kind:"daily"或"weekly"}` 開始考試 |
| `GET /api/attempts` | 本人歷程；教師可查全部。篩選 `user,kind,from,to` |
| `GET /api/attempts/:id` | 權限範圍內的單次紀錄；交卷後包含事件 |
| `POST /api/attempts/:id/events` | `{id,revision,source,command}` 保存操作 |
| `POST /api/attempts/:id/submit` | `{revision}` 後端評分及不可修改的交卷 |
| `POST /api/attempts/:id/abandon` | 放棄本次；保留歷史 |
| `GET /api/admin/export` | 相同篩選條件的學員交卷 CSV |

事件格式與模擬狀態型別在 `shared/exam.ts`。`id` 使用 UUID；`source` 為 `model`／`workstation`。同一 ID 與相同內容重送不重複執行；ID 重用不同內容或版本衝突回傳 409，前端重新載入狀態。交卷重送回傳原結果。前端不送入評分、完成旗標或整份狀態；後端從合法操作推導，保存評分版本與檢核依據。

未交卷回應只提供儀器狀態，不提供錯誤清單、評分 ledger 或進度清單。SOP 違誤留在伺服器，交卷後揭示；硬性限制只回應當下狀態。網路中斷時前端保存待確認事件的 ID，禁止後續操作並提供重試。401 回到登入，409 載入最新紀錄。SQLite 交易同時保存事件與狀態，資料庫唯一索引限制每人一份進行中考試。

密碼使用隨機 salt 與 scrypt，登入 Cookie 為 HttpOnly、SameSite=Strict，工作階段隨機值以雜湊保存於資料庫；後端核對本人／教師權限。僅供本地測試，沒有自助註冊、Email 或預設管理員密碼。向網路開放時需另行配置 HTTPS 與部署設定。

時間為伺服器收到事件／交卷的時間。W2 30 分鐘與 Photocal 10 秒為教學模擬等待；程序採持久化截止時間，關閉瀏覽器後繼續計時，重新開啟時推導完成狀態。快轉保存實際等待與跳過時間。首次／最新比較及連續成就限同種類、同評分版本；前後差距不是對照研究證據。
