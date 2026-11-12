# 練習保存與教學成效追蹤

日保養 v7 的考試順序與各架上機缺失判定另見 [DAILY_V7_DELIVERY.md](DAILY_V7_DELIVERY.md)。v7 事件與步驟 CSV 使用 `training-v2` 分析；舊版本沿用 `training-v1`，不重算已交卷結果。

本版為教學管理及歷次表現分析，不新增研究收案、同意或正式前後測。僅追蹤目前開放的日保養與 QC 異常處理；自由探索不建立練習輪次、不計有效時間。

## 操作

1. 先登入並完成既有背景資料，從任務中心開始／繼續練習。
2. 儀器與操作工作站共用同一輪狀態。每次操作由伺服器驗證並依序保存；保存失敗會鎖住新操作，使用「重試保存」確認原事件，避免重複計次。
3. 「返回探索（保留練習）」停止活動回報並保存；重新登入後可接續。
4. 全部評分檢核完成，自動封存並停止有效計時。要再實作需按「開始新一輪」；未完成時重新開始會封存舊輪，歷史不刪除。
5. 同帳號僅一個視窗持有操作權。第二視窗必須按「接手操作」，原視窗停止保存及計時。單純讀取紀錄不取得操作權。
6. 「登入／考試 → 學習成效」查看個人歷程；管理員可查看班級總覽與三份 CSV。

視角、縮放、選單展開狀態不跨登入保存。機蓋、Maintenance、試劑、杯子、備料／檢體架及 QC 判讀、重測、校正、回溯等狀態均保存。考試共用既有模擬介面與狀態機，維持原評分及交卷規則，考試不顯示操作提示。

## 時間定義

- 15 秒回報一次；進出任務、可見性變更及暫停即時回報。滑鼠、觸控、鍵盤與滾動只更新記憶體內最後活動時間，不保存軌跡或輸入內容。
- 背景頁面、離開任務或閒置 120 秒後停止累計。回到前景或恢復活動後重新開始。
- 使用伺服器時間計算連續區間；缺報超過 30 秒的整段不追補。45 秒租約需續期；過期可重新連線，跨視窗則明確接手。
- 符合活動條件的閱讀、觀察與模擬等待都計入有效時間。模擬等待／快轉分列，不從有效時間全部扣除。QC 程序另保存伺服器觀察到的等待區間，封存後停止增加；舊 QC 成績未記錄的等待不沿用原評分器的零值，而顯示未記錄。原分數與結果不改寫。
- 活動資料只累加一列，不為每次活動建立事件。舊資料與尚無輪次的學員時間為「未記錄」，升級中途才開始追蹤的考試為「部分紀錄」。本版啟用前只存在頁面記憶體的練習無法回補；零筆保存紀錄不代表從未練習。
- 有效時間僅為活動估計，不能代表真實專注程度。練習與考試有效時間分開統計。

## 統計與匯出

日期以台北時區的輪次開始時間篩選，時間為入選輪次目前已記錄的累積時間；不切割成每日時數。課程歸屬依當輪快照，轉班、停用或後續背景修改不回寫舊資料。管理員建立的測試輪次預設排除。

已交卷分數才納入考試平均數／中位數，另列交卷次數與學員數。最初與最新比較僅限同任務、同評分版本，只有一次考試時不計差值。未新增及格門檻或及格率，也不把交卷等同全部步驟完成。

伺服器以穩定評分步驟代碼與 `training-v1` 分析版本建立新事件分類，不以中文錯誤原文當統計鍵。分類包含前置條件、順序、材料、容器／檢體架、判讀、資料格式及其他。保留原始錯誤供明細查看，舊事件不回填猜測分類。

首次成功率分母為有實際標準化評量嘗試的「輪次—步驟」。未嘗試、未記錄、未完成分開列示；出錯學員比例分母為曾嘗試該步驟的學員。同輪同評量步驟的一次後續成功最多補正一個未解決錯誤，不會抵銷所有舊錯誤。正常返回、必要 Prime 與原事件重送不算新錯誤。非同步上傳／執行的操作嘗試以伺服器接受啟動為準，程序完成證據與未完成狀態另列，不因接受啟動就標成全部完成。

匯出沿用畫面篩選：

- 學員彙總：學員代碼、練習／考試有效時間、參與與完成／交卷／放棄數、時間完整性。
- 輪次與考試明細：輪次代碼、學員代碼、模式、版本、狀態、開始／結束時間、有效／模擬等待／快轉時間、完成分、錯誤及補正。
- 步驟明細：每位學員每一輪的評量步驟、嘗試、首次結果、錯誤、補正、完成與分析完整性。

CSV 不含姓名、帳號及原始背景問卷；UTF-8 BOM，文字欄位防止試算表公式注入。為控制管理端查詢記憶體，先篩選輪次 metadata，再逐筆讀取狀態。單次查詢／彙總匯出最多 5,000 輪；逐步明細 CSV 最多 1,000 輪。超過會明確要求縮小篩選，不靜默截斷統計。只有步驟 CSV 會產生逐輪明細，其他匯出不載入該明細陣列。

## API

所有路徑皆要求登入並沿用來源檢查、安全 Cookie 與既有角色權限。

| 路徑 | 用途 |
| --- | --- |
| `POST /api/practice-sessions` | `{kind}` 建立／接續，僅開放 daily、troubleshooting |
| `GET /api/practice-sessions/active` | 本人各任務尚未完成紀錄 |
| `GET /api/practice-sessions/:id` | 本人／管理員查閱，含操作與檢核明細 |
| `POST /api/practice-sessions/:id/events` | `{id,revision,source,command}`，不接受整份狀態或自訂完成結果 |
| `POST /api/practice-sessions/:id/poll` | 推進持久化模擬等待 |
| `POST /api/practice-sessions/:id/restart` | 封存並開始新輪 |
| `POST /api/training/lease` | `{mode,sessionId,viewId,takeover?}` 取得／接手 45 秒操作權 |
| `POST /api/training/activity` | `{mode,sessionId,sequence,visible,lastActivityAgeMs,release?}` 累加活動時間 |
| `GET /api/analytics/me` | 本人的統計 |
| `GET /api/admin/analytics` | 管理員全班統計 |
| `GET /api/admin/analytics/export` | 相同篩選加 `table=learners/sessions/steps` |

事件、活動、重開、輪詢及新 UI 的考試操作以 `X-Training-Lease` 傳入租約憑證。事件 UUID 重送只回原結果；版本落後回 409，操作權衝突／過期回 423，登入失效回 401。活動序號不遞增不重複計時。舊考試 API／CSV 保持原契約；既有未使用租約的 API 用戶仍可操作，輪次開始追蹤後即須遵守操作權，釋放或過期不會恢復無租約寫入。

統計篩選：`cohort,user,kind,version,from,to`。學員不能藉 `user` 讀取別人紀錄；管理 API、匯出與跨使用者明細都由伺服器檢查。

## 資料庫與上線

資料庫 v4 新增 `practice_sessions`、`practice_events`、`training_activity`、`training_leases`，考試事件新增 nullable 分析欄位、考試新增參與者快照。舊帳號、邀請碼、密碼、背景與成績原文保留，不重算舊分數。

1. 保持 Render `AU5800_DB=/var/data/au5800.sqlite` 與 `/var/data` persistent disk。先以現有 `npm run db:backup` 備份並下載異地副本。
2. 部署新程式，啟動時自動產生同目錄 `backups/before-accounts-*.sqlite` 一致性備份，檢查完整性，再於交易內升至 v4；失敗回滾。
3. 先以測試班別／學員完整操作兩任務；比較成效畫面與三份 CSV、重新整理／登入、接手與斷線重試，再發正式課程碼。
4. 觀察 Render CPU、記憶體與磁碟、保存失敗及租約衝突／計時中斷；本機 30 人負載測試不能代替正式服務監測。
5. 還原使用 `npm run db:restore -- 備份檔 新資料庫路徑`，不覆寫現有檔。停止應用後切換 `AU5800_DB`，以相符程式版本啟動。工具支援最高 v4；還原 v3 後以本版啟動會先備份再遷移。

本次不會代替你部署 Render 或在正式班級建立測試帳號。資料量隨操作事件累積，需要持續監測磁碟及備份容量。

## 驗證

- `npm run test:server`：既有帳號／考試／邀請碼回歸，加上練習、租約、可控制時鐘、重送、並發、分析、快照與遷移／還原驗證。
- `npx playwright test tests/training.spec.ts tests/daily.spec.ts tests/troubleshooting.spec.ts tests/exam.spec.ts tests/accounts.spec.ts`：Chrome／Edge，保存接續、完整日保養與 QC、無提示考試、接手、遺失回應重試、成效與 CSV。
- `npm run build`：TypeScript 與正式 Vite 建置。

測試資料庫均為暫存檔，不修改正式資料。成效頁截圖在 `artifacts/training/`。


### 本機驗收結果（2026-11-12）

- 後端：105 項測試通過，包含舊帳號、邀請碼、考試回歸、v3→v4、v4 備份還原、QC 等待及舊資料未記錄判定。
- Chrome／Edge：18 項核心流程通過，涵蓋完整日保養考試、QC 練習與考試、保存／重登、成效／CSV、接手與遺失回應重試。完整十三組日保養練習也已於兩種瀏覽器驗證完成與重開。
- 額外計時邊界：4 項檢查通過（兩種瀏覽器各兩項），驗證初始租約回應延遲時離開，以及前一筆回報未完成時切到背景。
- 正式建置成功。Vite 仍有大型 3D bundle 的大小提醒，不影響建置通過。
- 30 人本機磁碟樣本：120 次活動回報、30 次操作保存，批次約 1.4 秒，RSS 增約 27 MB，SQLite 邏輯容量增約 260 KiB；只有 30 筆累加活動列，未出現 SQLite 鎖定錯誤。這是本機測試資料，不代表 Render 的實測容量。

核心瀏覽器重現指令：

```powershell
npx playwright test tests/training.spec.ts tests/exam.spec.ts tests/troubleshooting.spec.ts --project=chrome-1366 --project=edge-1920 --grep "saved practice|administrator analytics|two windows|leaving while|daily model and native|daily exam mode buttons|HUD exam preserves|UIBC practice completes|UIBC exam preserves" --reporter=line
npx playwright test tests/training.spec.ts --project=chrome-1366 --project=edge-1920 --grep "leaving while|visibility changes" --reporter=line
```
