# AU5800 全螢幕場景與 HUD 交付紀錄

日期：2026-10-27。啟動方式仍為 `npm run dev -- --port 5173`，本機網址為 http://127.0.0.1:5173/ 。

## 完成內容

- 初次進入自由探索，全視窗即時 Three.js 場景，保留既有模型、材質與實機素材。
- 深藍灰 HUD、可收合資訊卡、搜尋部件目錄、細部探針／杯位入口及底部鏡頭工具。點選與聚焦分開，空白點選取消，拖曳不誤判點選；旋轉、縮放、平移及可中斷定位動畫保留。
- 以輪廓表示選取，移除選取造成整組材質變亮；練習目標標記與一般選取分開，考試不載入答案目標。
- 相關蓋子、櫃門、瓶槽與零件操作出現在右側，沿用原處理函式與限制；受限工具停用並提供原因。
- 任務中心提供日／周保養的練習與考試入口，雙周保養與障礙排除保持未開放。登入、個人歷程、教師管理、匯出、交卷與原結算保留。
- Quest Log 讀取既有名稱、完成狀態及子項進度；保留可平行的任務。選取、定位或收合面板不認列完成。完成回饋不會自動移動鏡頭。
- 自由探索、日練習、周練習分開持有模型、瓶槽、槽位配置與工作站畫面。返回探索保留本頁練習，重新開始須確認。
- 工作站保留原灰藍介面；隱藏後仍保留頁面、頁籤與草稿。Esc 先處理輸入焦點及最上層視窗，再返回模型。
- 考試 HUD 僅顯示後端完成組數及原有計時，保留失敗重試與原交卷證據；交卷／放棄使用確認視窗，避免被工作站蓋住。
- 靜止場景停止重複重繪，工作站開啟時暫停背景渲染；場景與相機仍保留，不以反覆重建模型切換面板。

## 主要檔案與資料來源

| 檔案 | 職責 |
| --- | --- |
| `src/App.tsx` | 場景外殼、自由探索與任務會話隔離、選取及情境操作連接 |
| `src/Viewer.tsx` | Three.js 選取、精細命中資料、輪廓、鏡頭、練習標記及渲染生命週期 |
| `src/SimulatorHud.tsx`、`src/hud.css` | 任務中心、Quest Log、資訊／照片卡與 HUD 樣式 |
| `src/ContextCovers.tsx`、`src/dailyActions.ts` | 相關機殼控制與原 ModelPractice 條件的共用查詢 |
| `src/hudTasks.ts` | 日／周保養狀態的唯讀呈現介面，不負責認列操作 |
| `src/Workstation.tsx` | 保留既有軟體介面、頁面與草稿；練習合法控制項提示 |
| `src/ExamRoom.tsx`、`src/ExamPortal.tsx` | 原考試、管理與紀錄接入場景 HUD |
| `shared/exam.ts`、`server/index.mjs` | 從既有檢核產生 `Attempt.progress` 彙總回應 |
| `tests/hud.spec.ts`、`server/hud-progress.test.mjs` | HUD 互動、模式隔離、版本與彙總進度驗證 |
| `scripts/capture-hud.mjs` | 重現實際 UI 操作與截圖，不建立正式考試帳號或作答紀錄 |

日保養名稱來自 `shared/dailyTasks.ts`，完成來自既有 `daily.completed`；周保養沿用 `weeklyStepNames` 與 `weeklyCompletion`。HUD 只描述狀態與可操作目標。考試完成組數由原評分檢核 `attemptChecks` 計算，原分數公式、版本、事件證據、資料表與歷史成績不變。作答中的 API 不提供檢核明細或建議。

## 驗證結果

- `npm run build`：通過 TypeScript 與正式 Vite 建置。
- `npm run test:server`：43 項通過，包括舊版本、補正、試劑更換後失效、SQLite、重播、版本衝突及彙總進度。
- `npm exec playwright -- test --reporter=line`：76 項全部通過；本機 Chrome 1366×768 與 Edge 1920×1080 各 38 項。
- 瀏覽器流程包含完整十二組日保養、完整周保養及 W2／Photocal／復原、考試完整交卷、重新整理恢復、保存失敗重試、持續計時及工作站草稿保留。
- 其他回歸包含瓶槽、六支擦拭、杯子、三種蓋子、syringe、馬達插頭順序、實機照片、無 WebGL 降級、HUD 捲動／拖曳不移動鏡頭、選取與定位不誤推進。
- 最後樣式修正另以實際 Chrome／Edge 操作重新截圖，確認面板對比、收合與工作站可讀性。瀏覽器採無頭模式及軟體 WebGL，另檢視產出的實際畫面。
- 測試考試使用獨立暫存 SQLite，未以測試帳號覆寫本機學員資料。

## 實際介面截圖

穩定交付副本位於 `artifacts/hud/`（不會被下一次 Playwright 清理 `test-results/` 的動作刪除）。每個畫面皆提供兩種尺寸：

| 狀態 | Chrome 1366×768 | Edge 1920×1080 |
| --- | --- | --- |
| 自由探索 | [畫面](artifacts/hud/chrome-1366-exploration.png) | [畫面](artifacts/hud/edge-1920-exploration.png) |
| 任務中心 | [畫面](artifacts/hud/chrome-1366-task-center.png) | [畫面](artifacts/hud/edge-1920-task-center.png) |
| 日保養練習 | [畫面](artifacts/hud/chrome-1366-practice.png) | [畫面](artifacts/hud/edge-1920-practice.png) |
| 周保養練習 | [畫面](artifacts/hud/chrome-1366-weekly.png) | [畫面](artifacts/hud/edge-1920-weekly.png) |
| 考試 | [畫面](artifacts/hud/chrome-1366-exam.png) | [畫面](artifacts/hud/edge-1920-exam.png) |
| 工作站 | [畫面](artifacts/hud/chrome-1366-workstation.png) | [畫面](artifacts/hud/edge-1920-workstation.png) |
| 考試工作站 | [畫面](artifacts/hud/chrome-1366-exam-workstation.png) | [畫面](artifacts/hud/edge-1920-exam-workstation.png) |

執行 `node scripts/capture-hud.mjs` 可重新擷取探索、任務中心、練習及工作站；考試截圖來自已執行的隔離考試測試，不使用正式資料庫製造作答情境。

## 保留的限制

- 練習進度仍只保留於本頁記憶體，重新整理會清除；考試沿用後端保存與恢復。
- 雙周保養、障礙排除及原本未實作的軟體功能仍不虛構執行結果。
- 缺少零件特寫時顯示缺圖，並將既有模組位置參考另行標示；未生成假照片或更動儀器工程精度宣稱。
- Vite 仍提示主程式包超過 500 kB（約 1.06 MB，gzip 約 301 kB），包含 Three.js 與既有模型程式；本次未更換引擎或大幅拆分專案。實際硬體的 WebGL 效能仍取決於瀏覽器與顯示晶片。
