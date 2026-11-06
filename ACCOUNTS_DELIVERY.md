# 2026-11-02 LabMECHED／AU5800 帳號管理

本輪為帳號管理階段：完成登入、帳號與班別、背景調查、背景快照與雙任務限制。不是整份科內試辦／研究分析／正式部署規格的完成宣告。

## 操作入口與權限

- 在平台點「登入／考試」。既有指定管理員的登入帳號、密碼雜湊與使用者 ID 保留；首次改版登入須更換初始密碼，不能將同一密碼再次設為新密碼。初始密碼不寫入程式或文件。
- 管理員登入後進入「帳號管理」。左側為實際帳號表格與組別／身分／狀態／背景／班別篩選，右側為選取帳號詳情、權限、班別、背景修正、密碼重設、啟用／停用及既有紀錄。
- 新建與重設均由伺服器產生臨時密碼，只顯示一次，首次使用須改密碼。管理員透過科內核准方式私下發放；沒有寄信功能、不保存明碼、不使用瀏覽器儲存空間保存臨時密碼。
- CSV 先驗證及預覽，再整批建立；上限 200 筆／1 MB。UTF-8 欄位固定 `username,name,cohort`，名稱與班別可空白；非空班別須先建立。不能匯入密碼或權限，不覆寫重複帳號。下載模板只有表頭，不帶示範學員。
- 登入帳號保留前導零；另外的 `L-…` 學員代碼產生後固定，不隨改名、轉組或權限修改變動。
- 學員只能讀取自己的紀錄與背景，不能操作管理 API 或自行升權。最後一位啟用管理員不能降權或停用。停用、重設密碼與權限變動會撤銷相關 Session，保留所有教學紀錄。
- 若建立操作的回覆在網路中斷時遺失，先按「重新載入」確認帳號是否已建立；已建立而未取得密碼時，使用重設功能產生新臨時密碼，不重複建立。

## 背景資料與任務

背景包含暱稱、八種組別、三種主要身分、總月數年資、AU5800 使用經驗、曾親自執行的保養，以及最近一年使用／保養頻率。兩種頻率皆採五級：從未、少於每月一次、每月 1–3 次、每週 1–4 天、幾乎每日。

年資定義為正式臨床檢驗工作累計，不含在學實習，已正式任職的 PGY 計入。無親自保養經驗須明確勾選，不以未回答當作無經驗。背景身分與系統管理權限分開。

- 學員須完成背景資料才能新開訓練，之後可更新。管理員修正背景會記錄操作者、對象、時間及變動欄位，不把整份背景或密碼寫進稽核。
- 新考試由伺服器保存當次背景、班別 ID／名稱快照與 `LabMECHED-background-2026-11-02-v1`，更新個人背景不回寫既有快照。舊 Attempt 的背景維持未提供，不推測回填。
- 前後端只允許新開日保養與 QC 異常處理；周／雙周入口未開放。舊關閉任務可讀及中止，但不能新增事件或交卷，保留程式與紀錄。
- 日保養保持 `AU5800-2026-10-28-v6`。QC 保持 `AU5800-UIBC-2026-10-30-v4`，校正與兩濃度 QC 同批執行，再回 L-J 圖確認判讀後進回溯。
- 自由探索與教材保留。練習仍只保留本頁會話，尚未跨登入保存；介面明示此限制。
- 研究使用顯示未啟用，不設研究同意勾選。任務指派、評量階段、教師配對、成效分析、去識別研究匯出及完整手機測驗留待後續。既有含識別資料的管理 CSV 不標為去識別研究資料，新管理頁不提供研究匯出入口。

## 資料與主要檔案

SQLite schema 由 1 遷移到 2。擴充 `users` 的固定代碼、強制改密碼與班別；新增 `cohorts`、`learner_profiles`、`account_audit`；`attempts` 新增背景快照與定義版本欄位。使用交易執行，失敗會回復，較新 schema 拒絕降版寫入。

- `server/database.mjs`：版本化遷移與遷移前一致性備份。
- `server/accounts.mjs`、`server/index.mjs`：沿用 scrypt 與 Session，擴充帳號、背景、班別、稽核及任務權限。
- `shared/accounts.ts`、`shared/availability.ts`：背景定義／驗證、CSV 解析、雙任務開放設定。
- `src/ExamPortal.tsx`、`src/AdminAccounts.tsx`、`src/AccountProfile.tsx`、`src/accountSession.ts`：管理畫面、表單及與任務中心共用的登入狀態。

新 API：`/api/me/profile`、`/api/auth/change-password`、`/api/admin/users/import`、`/api/admin/cohorts`、`/api/admin/audit`、`/api/admin/users/:id/profile`、`/api/admin/users/:id/reset-password`。公開 `/api/auth/setup` 已關閉，沒有公開註冊。

現有資料庫遷移前已產生 `data/backups/before-accounts-1793600815119-7127253c-bc98-4640-a8ce-6d22653a899c.sqlite`。以唯讀比對確認：8 個帳號的原欄位與密碼雜湊、4 個 Attempt 的原欄位／狀態／結果，以及 154 個事件完全相同。未加入測試學員、背景或成績；指定管理員只新增首次改密碼要求。

## 本機啟動、備份及還原

需 Node.js 24.12 或以上、可寫入的本機持久資料目錄。這是單一 Node 應用與 SQLite 的本機交付，尚未完成院內主機、HTTPS 及手機實機部署驗證。

```powershell
npm ci
npm run build
npm start
```

正式建置由 Node 同源提供，開啟 `http://127.0.0.1:3001`；不要把 `npm run dev` 或 Vite preview 當正式主機。開發時可執行 `npm run dev`，開啟 `http://127.0.0.1:5173`。

可將 `.env.example` 複製為本機 `.env`：`AU5800_DB` 指向持久資料庫，`AU5800_PORT` 設連接埠；`AU5800_PUBLIC_ORIGIN` 設實際來源，HTTPS 部署時才將 `AU5800_COOKIE_SECURE` 設為 `true`。本輪不會自行發布到主機。

空資料庫才需要初始化：

```powershell
npm run account:bootstrap
```

預設登入帳號來自 `AU5800_BOOTSTRAP_USERNAME`，密碼以隱藏輸入提示提供；不要放在指令參數。已有管理員時初始化會拒絕執行，不覆寫帳密。既有指定管理員不需重新初始化。

一致性備份與還原到新檔：

```powershell
npm run db:backup
npm run db:restore -- "備份檔完整路徑" "尚未存在的新資料庫路徑"
```

備份使用 SQLite `VACUUM INTO`，還原使用 SQLite backup API，兩者均做完整性檢查，不在寫入中直接複製主檔。還原不覆寫現有檔案；確認後先停止應用，再修改 `.env` 的 `AU5800_DB` 指向新檔並啟動。保持單一應用實例，勿讓多實例共用本機 SQLite。

回退舊程式時須同時選用遷移前備份與相符程式；不能讓舊程式寫入 schema 2。先保留新資料庫及備份，回退備份後不會包含備份時間之後的新紀錄。

`.env`、資料庫、備份、測試輸出及密碼皆不得提交 Git。此專案沒有 AGENTS.md，實作依實際程式與 schema 盤點進行。

## 驗證及畫面

自動化測試使用獨立 SQLite；Playwright 自行啟動的前端服務也使用暫存資料庫，不在正式資料庫建立測試學員。

執行 `npm run test:server` 以及相關 Playwright 測試，涵蓋權限隔離、臨時密碼、整批建立、最後管理員、背景快照、關閉任務、舊成績、遷移及一致性備份還原。帳號畫面與手機表單以 Chrome／Edge 驗證；手機為瀏覽器尺寸模擬，未宣稱完整手機 3D 測驗支援。

本次驗證結果：

- `npm run build` 通過；既有大型 JavaScript bundle 提醒仍存在。
- `npm run test:server`：81 項通過，0 項失敗，包含獨立資料庫的備份／還原與遷移回復驗證。
- Chrome 1366×768、Edge 1920×1080：22 項不同的瀏覽器案例通過，涵蓋帳號／匯入／背景／登入門檻、完整日保養練習與考試、自由備料、QC 練習與考試，以及歷史 QC v3 成績相容性。新入口關閉的周保養介面測試明確略過，未計入通過數。
- 原資料庫比對結果如上；所有測試學員及測試紀錄均留在獨立測試資料庫。

以下截圖全部取自獨立測試資料庫，學員名稱標示測試用途，不代表正式學員或研究結果：

- [1920×1080 帳號管理](artifacts/accounts/edge-1920-management-test-database.png)
- [1366×768 帳號管理](artifacts/accounts/chrome-1366-management-test-database.png)
- [桌面背景調查](artifacts/accounts/edge-1920-desktop-background-test-database.png)
- [CSV 預覽](artifacts/accounts/chrome-1366-import-preview-test-database.png)
- [390px 手機背景表單](artifacts/accounts/chrome-1366-mobile-background-test-database.png)
