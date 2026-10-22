 HEAD
# AU5800 Learning Lab

## 2026-10-22 日保養 v4

新日保養測驗使用 `AU5800-2026-10-22-v4`，共十二組等權任務。新增十二瓶 CLN-1／Diluent／DET-1／DET-2 逐瓶補滿（Reagent Check 前）、前方四支及後方整組 syringe 的水氣與漏水檢查（Rack 前），以及 ISE Standard／Buffer／Reference 液量檢查（Prime／校正前）。Standard、Buffer 初始不足，須更換；Reference 初始足夠。液量是訓練示意，未推定實際容量或門檻。

工作站的「日保養補充與檢查」提供同一份狀態的操作入口，模型亦可選 syringe／ISE 瓶子操作。瓶子需開對應櫃門；洗滌液沿用對應上蓋與 Maintenance 條件。ISE 瓶子更換會使 Prime 次數與校正失效，須重新做三次 Prime 及校正；洗滌液配置改變須重新 Reagent Check 並確認 Calibration Entry。考試會保存嘗試、異常及補正，不因事後補齊就追認先前無效操作。

ISE Maintenance 未勾選時，右側 Maintenance 方格反黑停用，Cleaning 與校正可選；勾選後方格亮起，Cleaning 與校正停用。操作仍須符合停機、module 鐵蓋關閉等限制。未實作功能只顯示入口訊息，不產生完成證據。舊進行中的 v1／v2／v3 考試仍沿用原規則；已交卷成績不重算，周保養評分版本不變。

ISE 上罩使用固定中央拱架與前後獨立 90° 開蓋，中層黑罩縮小；新增後方 syringe 櫃門、Sample probe／ISE probe 後方視角與 ISE 內部斜上方視角。選擇視角不自動開蓋。後方模型依後續確認呈現兩支 syringe，檢查維持整組記錄；細部尺寸及管路仍為示意。馬達必須先拔除兩個插頭再拆主體，先裝主體再接插頭；「全部裝回」分兩階段顯示。

後續視角微調：杯子改由前側斜看並置中；馬達使用前側斜視、稍微退遠。Standard／Buffer 層架及瓶子同步下降，下方 Reference 櫃體縮短，避免瓶蓋被上方結構遮住。模型下方提供「開啟／關閉前方 syringe 櫃門」按鈕，日保養工具及新版考試儀器狀態亦提供相同開關，獨立於分析單元主蓋。評分版本與後方整組檢查方式維持不變。

以下較早版本章節為開發歷程；最新日保養規則以上述 v4 為準。

## 2026-10-21 日保養順序調整

日保養只限制必要的先後關係：六支探針擦拭（A）→ 排水與攪拌檢查（B）；ISE Cleaning（C）→ 三次 Total Prime（D）→ ISE 校正與結果檢查。AB 與 CD 兩條流程可交錯，ABCD、ACBD、ACDB、CABD、CADB、CDAB 均可。試劑補充、紀錄與 All positions 不綁定校正，可提前完成。

溫度、New Index、擦拭、排水／攪拌、Cleaning、三次 Prime、四杯校正及結果檢查、CLEAN 杯移除、試劑與 All positions 全部完成後，才可進行 Rack Requisition。練習會依這些條件開放 Start Entry／Entry；Cleaning 完成後仍可補做排水檢查。未開始日保養的自由選單導覽維持原操作方式。

考試仍允許自由操作，但不符合必要順序的排水／攪拌、Prime、校正及 Rack 不計有效完成，錯誤留到交卷後顯示；補好前置項目後，須重新執行原本做早的操作。新日保養考試版本為 `AU5800-2026-10-21-v2`，舊 v1 考試沿用原規則，已交卷成績不重算；周保養仍用 v1。

## 周保養互動教學

左側選「周保養」開啟與日保養同樣排列的九步清單，按「到模型操作」執行清潔。模型與工作站共用本次周保養狀態；「Home 主選單」固定返回 Home。W2 從 Home → Analyzer Maintenance → W2 開啟；Photocal 結果從 Analyzer Maintenance → Photocal Monitor 查看。切換畫面保留進度，重新整理或重新開始會清除本次練習。日保養進度獨立，瓶槽共用模型。

流程：準備及 R1/R2 下方櫃內四支 syringe 水氣檢查 → 後方 Sample 兩支與 ISE 一支，在模型上旋開鎖頭、滴乾、取出、擦拭、通針、裝回、鎖緊及排水檢查 → 左右兩組攪拌棒清潔 → 棉棒沾取 Cleaning Solution，逐個點選模型上 18 孔清潔 → 攪拌檢查 → 七瓶 W2、CLEAN 滿杯 → W2 加 Photocal 與 ISE Enhanced Cleaning → 結果確認、Diluent 清潔紀錄及原配置復原。

「取下清潔 mixer bar 並裝回」分右側 R1/S 12 支、左側 R2 6 支，各按一次播放整組升降動畫，不需要逐支處理。保留損傷確認與 DIAG 結果，重複清潔不會清除異常。18 孔清潔逐孔記錄且不重複計數。三處綠色 DIAG 位於前方 R1/R2、後方 Sample、ISE，須先確認對應程序。ISE 煙燻色上罩分成前後兩片可獨立開啟。W2 顯示 30 分鐘倒數，可使用「教學快轉」；Photocal 為短時間教學示意，不代表實機耗時。結果畫面為模擬資料，未提供量測值。兩瓶 Diluent 只記錄依科內 SOP 完成清潔，不推定清洗方法。

ISE 新增兩個瓶槽，DET-2 在 W2 期間保留。Sample 的 DET-2 取出留空；W2 位於 61／63。每次 W2 為分析單元六瓶、ISE 一瓶，均裝滿同一種清洗液，HCl 與漂白水每周交替；初次由學員選本周種類，尚未保存跨周排程。

來源：使用者提供之 SOP 5.7.2.1–5.7.2.3 截圖及後續實機照片／文字更正。Cleaning Solution 大瓶尚未提供照片，使用具名工具；探針與瓶槽尺寸按既有模型估算。周保養狀態與頁面在 `src/WeeklyTraining.tsx`，模型操作動畫在 `src/weeklyModel.ts`。

## v0.9 Reagent 與 Rack Requisition

Reagent Main 改為照片的五欄試劑概覽；Details 顯示位置、R1/R2、Shots、Onboard、RB／Cal Stability Remaining、Expiration、Lot、Bottle、Seq.、Comment。資料為照片示例，CRE 改用 7H 示範：嚴格小於 8 小時才顯示黃色，8H 不變黃，可用下方欄位測試。依使用者提供的 Creatinine 每 24 小時校正／大夜執行情境呈現，未自行延伸成其他儀器規範。舊日保養更換紀錄保留在 Details 下方展開區。

Rack Requisition 可進入 Sample、Calibration、QC。Calibration 按 Start Entry 後逐項選 RB（青色）與 Cal.（黃色），按 Entry 儲存；Exit 放棄草稿。QC 可選 Serum／Urine，Start Entry 啟用 Profile，選擇一組或多組後按 OK 套用，再按 Entry 儲存。兩種 Type 獨立保存；切換頁面與關閉螢幕會保留已 Entry 的資料，重新整理或開始新一輪日保養會清除。

QC 群組依補充答覆：CRPHS 為 hsCRP，AMM／ETOH 同組，CO2 獨立，圖七右側其餘為 MAS；ITA 與 URINE TOXO 停用。依此最新對應，圖七列出的 41 項中 MAS 有 37 項，四組全選共 41 項（不硬設為前一張結果照片的 33）；URINE QC 為圖九的 13 項。每個 Profile 的成員與選取數量可在畫面預覽，資料集中於 `src/requisitionData.ts`。

日保養第九步接上已 Entry 的 Serum Calibration、Serum QC 與 Urine QC 申請，仍不代表校正／QC 已執行或合格。Sample 個案、杯架配置、Auto CAL/QC 等未提供的細節保留入口。

## v0.8 在模型上操作日保養

開始日保養、在電腦選 Cleaning Probe 或 Inspect Probe & Mixing Bar 後，按「到模型操作」。點模型上的探針／攪拌單元或對應位置標籤，在右側使用酒精棉、確認排水及攪拌結果。探針擦拭有酒精棉往返動畫；排水與攪拌為正常情境示意，動畫本身不會自動勾選完成。

ISE Maintenance／Calibration 頁的「到模型操作」切到四個杯位。在 U-L 放入 CLEAN 杯，返回電腦執行 Cleaning 與三次 Prime，再回模型丟棄 CLEAN 杯、逐杯放置校正杯並逐滴加入對應校正液。模型杯子的有無與液位會更新，滴数仍以紀錄為準，液位不是容量量測。最後按「返回電腦繼續程序」執行校正。兩邊共用進度，可保留原操作卡作替代入口。

新檔案 `src/ModelPractice.tsx` 提供模型工具面板，`src/dailyModel.ts` 管理部件選取與動畫。模型放置為定位示意，未加入手部拖曳、實機液路計算或清洗循環的實際時間。

## v0.7 日保養教學流程

由左側「日保養」或操作工作站上方「日保養」進入，按「開始日保養」。流程包含登記兩項溫度、Start Condition 的 Edit → New Index、勾選 Analyzer Maintenance 後擦拭六支探針、排水與左右攪拌檢查、ISE Cleaning、三次 Total Prime、四杯校正與結果檢查，以及試劑記錄／更換 → Reagent Check → All positions。

實體操作目前以工作站內的探針與杯位操作卡記錄，未加入 3D 擦拭、液流或實際馬達動畫。檢查選擇異常不計完成。CLEAN 杯清洗後須取出並丟棄，四杯校正液各至少 10 滴才能執行校正練習。校正數字與 Normal Range 重現照片示例，不是本次量測或實機放行判定。

試劑明細使用清楚標示的教學情境，分別包含用完、量不足、即將到期及足夠的瓶子；ALT 的 R1、R2 都需更換。逐瓶記錄且確認需求量後才可完成 All positions。Details 圖五尚未收到，表格依文字需求暫建。Reagent Inventory／Consumption、Cleaning (Enhanced) 保留入口待補流程。

第 9 步 Rack Requisition 的 calibrators／QC 畫面待提供，前八步完成仍不代表整套日保養完成。進度在關閉工作站後保留，重新整理或開始新一輪會清除；所有操作均為教學練習。新增流程與狀態集中於 `src/DailyTraining.tsx`，樣式為 `src/daily.css`。

## v0.6 操作工作站選單

點選「操作工作站」即可開啟接近全視窗的電腦介面；按「退出螢幕」或 Esc 返回 3D 儀器。主選單提供兩個 Status 入口與五個底部選單，Analyzer／ISE Maintenance 的分頁、右側按鈕及底部選單依提供照片排列，PRO Service 停用。

Analyzer Status 提供 Bath Temp. 與 Coolant Temp. 的每次保養檢查勾選，可重設開始下一次檢查。37.0／8.2 °C 為照片示意數值，非即時讀值或合格標準；紀錄在關閉螢幕後保留，重新整理則清除。

此版先建立選單與操作入口，尚未加入各按鈕的實際保養流程；點擊會顯示所選功能，不會執行儀器動作。表格日期留空，未沿用照片中的過期紀錄。畫面文字依照片使用 Wash Syringe、Wash Nozzle。介面與選單資料位於 `src/Workstation.tsx`、`src/workstationData.ts`。

## v0.5 外觀與櫃體更新

- 後方 Sample probe 同側新增連續分段黑色檢體運送軌道罩，沿進架區、ISE 及分析單元延伸，兩側保留白色邊框。樣品區圓盤及瓶槽位置重新留出軌道間距；尚未模擬檢體運送。
- ISE 三層可獨立開啟：上層黑色探針罩、中層黑色試劑罩、下層白色 Reference 櫃門。中層為左 Mid Standard、右 Buffer；下層獨立放置 Reference。
- ISE 原有內部維護蓋與五個部件拆装功能保留。選取內部部件會自動開啟上層罩；關閉上層罩時會同步關閉內部維護蓋。全域「顯示內部」不再代替這些獨立櫃門的開關。
- 進架區下方櫃體縮窄，保留上方檯面懸伸。右側鉸鏈門可開啟，內含 Clean Solution 桶、雙蓋、提把、管線及金屬托盤。本版桶子固定放置，未加入抽換與液路斷接操作。
- 新增 `src/enclosures.ts` 與 `src/EnclosurePanel.tsx`，門狀態獨立保存於本次頁面使用期間。新增部件 ID：`ise-reference`、`clean-solution`、`sample-track`。

供檢驗科生化組 PGY／新人使用的繁體中文 3D 儀器導覽。v0.4 增加 ISE 維護蓋與內部部件示意拆裝，保留 R1／R2 的 12 孔、Sample 的 4 孔洗滌劑槽操作，以及四支注射器的水氣檢查。

## v0.4 ISE 模組

點選「ISE 電解質模組」，按「打開 ISE 維護蓋」觀察內部。主蓋向左掀起；「顯示內部」控制外部深色罩，與 ISE 維護蓋分開。

右側面板四個透明試劑杯由左至右為 S-H（SEL-Na／CRS-H）、S-L（SEL-K／CRS-M）、U-H（CRS-L）、U-L（CLEAN）。點選「ISE 保養試劑杯」可放大查看，說明面板列出完整對照。

混合杯、T 型橡膠管、馬達主體及兩個插頭可由模型或部件清單選取，再按「拆下選定部件／裝回選定部件」。拆下以抬起展示表示，可用「全部裝回」恢復。狀態在模組切換間保留，重新整理頁面則重設。插頭 A／B 是模型識別名稱，非廠商編號。

此版是構造與自由拆裝示意，尚無正式保養順序、工具操作、電氣／液路斷接判定及成績。部件大小與管線依照片估算，不作量測或維修規範。

建模與杯位資料集中在 `src/iseModel.ts`，操作 UI 在 `src/IsePanel.tsx`。新增固定 ID：`ise-cups`、`ise-mixing-cup`、`ise-t-tube`、`ise-motor`、`ise-plug-a`、`ise-plug-b`。馬達、插頭及管線各保留獨立物件，後續可加入已核對的維護條件。

## v0.3 模型及操作

- 左右以儀器後方看：左側黃色攪拌單元 2 根 × 3 組、6 個對應孔；右側藍色單元 4 根 × 3 組、12 個對應孔。清洗噴嘴在左側，與黃色單元同側。
- Sample 左側為 63.DET-1/W2、64.DET-2；右側為 61.DET-1/W2、62.DET-2。平日共 4 瓶。周／雙周保養須先取出同側 DET-2，再於 61／63 換入 W2；62／64 留空。介面會阻止 W2 與同側 DET-2 同時放置。
- R1、R2 各兩支探針，與 Sample 使用同一外形。反應槽及試劑槽的尺寸與間距經調整，避免遮蓋洗滌瓶凹槽；整機尺寸基準維持不變，局部尺寸仍為照片估算。
- 選擇「試劑注射器檢查」會顯示左側櫃門內四支固定式 syringe，順序為 R2-2、R2-1、R1-1、R1-2。可逐支記錄「未見水氣／發現水氣」，不可拆卸。紀錄在本次頁面使用期間保留，可按「開始新的保養檢查」清除；重新整理頁面不保存。
- 顯示內部會隱藏左櫃門以供觀察，不代表實際開門或保養程序。水氣故障尚未視覺模擬，檢查紀錄不自動判定合格。

新增 `src/mixingModel.ts` 管理攪拌棒與孔位，`src/SyringePanel.tsx` 管理水氣檢查介面。瓶槽仍集中在 `src/detergents.ts`，包含 12 個試劑槽與 4 個 Sample 槽的固定 ID。

## 啟動

需要 Node.js 22.12 以上（本專案以 Node.js 24.12 驗證）。在此資料夾開啟 PowerShell：

```powershell
npm.cmd install
npm.cmd run dev
```

瀏覽 `http://127.0.0.1:5173/`。停止伺服器請在終端機按 `Ctrl+C`。一般命令列可使用 `npm`；PowerShell 的 `npm.cmd` 可避免 `.ps1` 執行原則阻擋。

```powershell
npm.cmd run build
npm.cmd run preview
```

建置結果在 `dist/`，可將整個資料夾放到靜態網站主機或院內 Web Server。資源使用相對路徑，支援子目錄部署。必須經 HTTP(S) 開啟，不能直接雙擊 `index.html`。網站不呼叫外部服務、不需登入；模型、照片及程式均隨建置包附帶。正式對外發布尚未執行。

## 操作

- 左鍵拖曳旋轉；滑鼠滾輪或 ＋／− 縮放。相機限制在地面以上。
- 點選模型、三個浮動標籤或左側清單，可聚焦部件並同步顯示說明。搜尋支援中文名稱、英文名稱與標籤。
- 快捷視角：整機、俯視、後方、ISE、R1、R2、樣品探針。
- 選取內部部件時自動隱藏外蓋；切換「顯示內部構造」可恢復。此切換是導覽可見性，不是實機開蓋程序。
- 重設視角回到整機總覽，保留目前內外顯示選項。
- 點照片可放大。操作說明、照片及資料來源視窗可用 Escape 關閉。
- 選取 R1 或 R2 會開啟瓶子工作區；直接點選模型中的瓶子或空槽也可操作。使用「部件介紹」返回照片與說明。
- 四種完整保養／障礙排除關卡仍未開放；瓶子工作區的配置選項可獨立使用。

## 12 孔槽位與瓶子操作（2026-09-16）

由儀器前方看，四組由左至右：

| 分組    | 第 1 孔  | 第 2 孔  | 第 3 孔       |
| ------- | -------- | -------- | ------------- |
| R2 外側 | 57.CLN-1 | 58.CLN-2 | W2            |
| R2 內側 | 55.CLN-1 | 56.CLN-2 | W2            |
| R1 內側 | 57.CLN-1 | 58.CLN-2 | 55.Diluent/W2 |
| R1 外側 | 59.CLN-1 | 60.CLN-2 | 56.Diluent/W2 |

- 平日預設 **4 瓶 CLN-1＋2 瓶 Diluent，共 6 瓶**，其餘 6 孔留空。CLN-2 目前未使用，不能放瓶。
- 周／雙周配置允許 R2 專用 W2 孔放入 W2；R1 共用孔可選擇更換成 W2。切換配置不自動移除、更換或重設既有瓶子。
- 若帶著 W2 切回平日，會提示取出或換回 Diluent，並停用不符合配置的補充操作。
- 「更換新瓶」增加該瓶更換次數並設為滿瓶；「補充」只提高原瓶液位、不增加更換次數；「取出」留空槽，「放入瓶子」放入對應的新瓶。過程有提起／放回動畫。
- 初始 65%、補充後 100% 均為遊戲示意液量，沒有推定實際容量、補充用量、濃度或完整保養步驟。
- 狀態會保留於目前網頁工作階段；切換部件不會重設，重新整理或按「重設為平日 6 瓶配置」會回復初始狀態。

## 檔案與後續擴充

| 檔案                            | 用途                                                  |
| ------------------------------- | ----------------------------------------------------- |
| `src/data.ts`                   | 部件固定 ID、父子關係、名稱、照片、手冊頁碼及相機視角 |
| `src/model.ts`                  | 以公尺建模的 Three.js 物件；每個主要部件有獨立 Group  |
| `src/Viewer.tsx`                | 相機、滑鼠拾取、可見性、材質高亮與資源釋放            |
| `src/detergents.ts`             | 12 孔固定 ID、位置、平日／保養規則及瓶子狀態轉移      |
| `src/washModel.ts`              | 有實際開孔的面板、三格凹槽、扁平瓶與動作動畫          |
| `src/DetergentPanel.tsx`        | 槽位選取、配置切換、更換／補充／取出控制              |
| `src/App.tsx` / `src/style.css` | 導覽介面與響應式版面                                  |
| `public/references/`            | 已複製的實機照片及手冊第 7–8 頁圖解                   |
| `SOURCE_NOTES.md`               | 資料來源、尺寸基準及待核對項目                        |

後續新增部件時，在 `data.ts` 加入 `Part` 與固定 ID，在 `model.ts` 建立相同 ID 的 Group。選取會沿物件父層找到 `partId`；每個物件另有由名稱階層組成的 `userData.stableId`，因此請勿隨意更改已發布的節點名稱。新增情境應另建資料與行為層，以部件 ID 關聯模型，不將操作步驟寫入幾何建模函式。需要版本遷移時保留舊 ID 對照。

未來可由同一 Group 改為載入精細 GLB 資產，保留部件 ID 與相機介面。目前具洗滌劑瓶的簡化互動，尚未加入其他部件拆裝、碰撞判定、真實流體、成績或情境編輯器。槽位使用 `slotId`，選取瓶身與空槽都會對應至同一個槽位；規則集中於 `operateBottle`，不由模型材質決定。

## 驗證

```powershell
npm.cmd test
```

Playwright 使用本機安裝的 Chrome 與 Edge，分別驗證 1366×768 和 1920×1080。未安裝對應瀏覽器時須先安裝，或調整 `playwright.config.ts` 的 channel。測試自動啟動／沿用 localhost 開發伺服器。無頭模式加上軟體 WebGL 允許旗標，瀏覽器日常操作不需要此旗標。

測試涵蓋部件切換、模型選取、照片載入、內部切換、視角、旋轉縮放、搜尋、停用選單、無 WebGL 的照片導覽，以及 12 孔次序、6 瓶配置、補充／更換的不同狀態、W2／CLN-2 限制及直接點選 3D 槽位。截圖輸出至 `test-results/`。使用 `npm.cmd run build` 執行嚴格 TypeScript 檢查及靜態建置。

技術參考：[Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)、[Vite 靜態部署](https://vite.dev/guide/static-deploy.html)。
=======
# LabMECHED
digitalized laboratory instrument education platform
 31b5ae4fa74b997ba29f56c2588c99a3fec40485


2026-10-21 操作更新：新日保養測驗採 v3，九瓶試劑由 Comment 欄「更換試劑」操作，Reagent Check 後產生 expired RB／Cal，再由 Rack Calibration 的 Entry 保存申請。溫度與 New Index 可任意排序，但須在 Reagent Check／Rack 前完成。ISE 校正時請關閉 ISE Maintenance 與 module 鐵蓋；黑色上蓋可以保持開啟。新周保養同步使用獨立蓋子狀態。既有進行中測驗沿用舊版本；須先交卷或放棄，再開始新測驗才能使用新規則。歷史成績不覆寫。
