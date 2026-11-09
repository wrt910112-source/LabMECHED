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

本專案已依目前的 Mount Path `/var/data` 設定 Render 預設值：未設定 `AU5800_DB` 時，伺服器、管理員初始化與備份指令都會使用 `/var/data/au5800.sqlite`。本機仍預設使用專案內的 `data/au5800.sqlite`。若有明確設定 `AU5800_DB`，則以該設定為準；Render 上仍拒絕相對路徑。程式無法單靠路徑判斷磁碟是否真的掛載，請在 Disks 確認 Mount Path 與設定一致。

啟動日誌應包含 `AU5800 database: /var/data/au5800.sqlite`。可在服務的 Shell 執行 `npm run db:backup`，一致性備份會存入 `/var/data/backups`（依實際資料庫目錄而定）。請在服務執行期間操作磁碟，Build Command 與 Pre-deploy Command 無法存取 persistent disk。

將程式變更推送到 Render 連接的 Git 分支，再執行 Deploy latest commit。啟動日誌應顯示 `AU5800 server listening on http://0.0.0.0:10000`（連接埠依 PORT 而定）。部署後確認首頁及 `/api/auth/status` 能正常回應。

## 首次建立管理員

新的磁碟資料庫不含本機帳號。若登入頁顯示尚無管理員，請在同一個 Web Service 的 Render Shell 執行：

```sh
AU5800_DB=/var/data/au5800.sqlite npm run account:bootstrap
```

依提示輸入兩次管理員初始密碼，輸入時不會顯示字元。預設帳號為 `000029220`（若設定 `AU5800_BOOTSTRAP_USERNAME` 則使用該值），首次登入須更換密碼。若已有設定 `AU5800_BOOTSTRAP_PASSWORD`，指令會使用該值而不再詢問密碼。

這個指令必須在已掛載磁碟的服務 Shell 執行，在本機執行只會初始化本機資料庫。已有管理員時指令會拒絕執行，不會覆寫帳密。若要保留原有帳號與紀錄，請遷移原資料庫，而非初始化新的管理員。

## 課程邀請碼與自行註冊

部署前可在現有 Render Shell 執行 `npm run db:backup` 保留一份一致性備份。新版程式會在啟動時將資料庫從 v1／v2 遷移至 v3，遷移前也會自動備份；不會刪除既有帳號、背景資料或考試紀錄。不需新增環境變數或寄信服務。

1. 管理員登入後，在「學員與帳號管理」建立「班別／課程」。
2. 按「課程邀請碼」，選擇該課程、設定到期時間與名額（預設 7 天、30 人；時間以 Asia/Taipei 顯示及輸入）。
3. 建立後立即複製完整邀請碼；完整碼只顯示一次，不會儲存在瀏覽器儲存空間或伺服器明文欄位。若遺失，停用舊碼並另外建立新碼。
4. 參與者在登入頁按「持邀請碼註冊」，填寫邀請碼、帳號及兩次密碼。成功後自動登入並填寫背景資料，不必再改一次密碼。
5. 管理員可依班別／課程篩選名單，沿用停用帳號與重設密碼功能。停用邀請碼不會停用既有學員；停用學員也不會退還邀請碼名額。每組碼的名額獨立計算。

先以測試課程實際驗證建立邀請碼、註冊、分班、填寫資料及停用後拒絕新註冊，再發放正式邀請碼。邀請碼是加入課程的憑證，請只交付給課程參與者。

公開註冊每連線來源每分鐘最多 60 次、全服務每分鐘 120 次，密碼雜湊最多同時 2 件、等待 30 件。超量回傳 429／503 與 Retry-After，前端不會自動重送。只使用 socket 來源，不信任瀏覽器自行傳入的轉送 IP 標頭；Render 代理可能讓多人共用來源額度。限流計數保留於執行個體記憶體，重啟後重設；邀請碼使用名額則持久保存在資料庫。

Render Logs 可依 `registration_created`、`registration_rejected` 事件觀察註冊結果及 429／503／500 狀態，不記錄密碼、完整邀請碼或帳號。配合 Metrics 觀察同時進站時 CPU、記憶體與回應情況。本機 30 人並發測試不等於 Render 低規格方案的容量保證；實際開課前應以測試課程確認。

若需回復舊版程式，請先停止服務並依備份還原流程切換至相容版本的資料庫，不要直接用只支援 v2 的舊程式開啟 v3 資料庫。
