# 2026-10-27 工作站與流程交付紀錄

## 實作

- `src/MaintenanceSurface.tsx`：探索、日／周練習及考試共用原五欄清單、兩欄 Maintenance 方格、Update 與相反條件的 Cleaning。Inspect／Cleaning Probe 取代整個左側清單工作區，不再把列表與教學表單上下擠在一起。
- `src/Workstation.tsx`、`src/ExamRoom.tsx`、`src/workstation-unified.css`：全寬工作站、外層會話 HUD／可收合儀器狀態、固定頁籤與底部選單、中央表格獨立捲動。保留場景、相機、工作站頁面與未送出草稿；Esc 先處理輸入及子工作區。
- `src/AnalyzerStatusSurface.tsx`、`src/DailyTraining.tsx`：共用原溫度示意配置、Start Condition 及 ISE 校正表格；事件處理仍接各模式原狀態或後端。
- `src/ReagentManagement.tsx`：共用探索的 Main／Details 表格。新版十一瓶在 Comment 欄更換，成功後停用；保留其他示例與 AMY 即將到期。缺少資料顯示「—」。Reagent Check 後仍保持 expired，校正 Entry 不改變穩定性。
- `src/IseDrainWorkspace.tsx`、`src/ModelPractice.tsx`、`src/dailyModel.ts`：使用既有 ISE probe 與 DIAG 判定。ISE 排水加入檢查組，無新增擦拭探針或日保養組別。
- `src/RackRequisition.tsx`：Serum／Urine 分開草稿、Profile／全選只改當前 Type、Exit 丟棄整次未保存編輯、最後一次 Entry 保存兩類；其他登記保留。等待後端確認才退出，未知網路結果以原事件 ID 重試。
- `shared/dailyScenario.ts`、`shared/dailyRules.ts`、`shared/exam.ts`、`server/index.mjs`：共用瓶槽與 DIAG 條件、版本能力、十一瓶／ISE 排水完成證據、QC 雙類資料先全部驗證後單交易保存。事件回應提供 `applied`，區分已記錄嘗試與有效執行。

## 版本與資料

新日保養 `AU5800-2026-10-27-v5`；新周保養 `AU5800-weekly-2026-10-27-v3`，周保養評分項目與權重保持。舊 v1／v2／v3／v4 及周保養 v2 保留其原狀態、條件與已交卷結果；未更動資料表。練習仍為頁面內狀態，重新整理不新增資料庫恢復。

## 驗證

- `npm run build` 通過（Vite 仍提示既有主 bundle 超過 500 kB，建置成功）。
- `npm run test:server`：50 項通過。
- Chrome 1366×768／Edge 1920×1080 共 84 個不同瀏覽器案例已涵蓋：全套初跑 80 項通過、兩個舊測試因儀器狀態移至收合 HUD 而定位失效；修正定位後，32 項受影響及新增案例雙瀏覽器重跑全部通過，其中包括兩個定位修正與兩個新增 ISE DET 案例。
- 日／周保養完整考試皆完成 100 分原評分回歸；練習的合法平行順序、QC 跨 Type 草稿、未知網路結果重試、重新整理恢復及原成績保存通過。
- 最後原生 Rack／表格樣式調整後，10 項 Reagent／Rack／ISE 工作站案例與兩個完整日保養考試再次通過。
- `git diff --check` 通過，僅 Git 的 Windows 換行提示。本機正式資料庫最後修改時間仍為 2026-10-22，驗證使用獨立 SQLite。


新增後端測試涵蓋十一瓶逐一缺漏、AMY 足量但必換、六 RB／三 Cali 缺任一項、ISE DIAG 缺少／無效設定／異常及補正、v4 與周保養 v2 操作限制保留、QC 雙類資料原子驗證、替換後失效及歷史成績不重算。瀏覽器完整日保養包含未知網路結果後重試 QC，檢核單一事件及兩類草稿、Calibration 保留。

## 截圖

[開啟同頁截圖比較頁](artifacts/workstation-v5/index.html)。

實際瀏覽器畫面位於 `artifacts/workstation-v5/`；測試產出的其他畫面在 `test-results/`。執行 `node scripts/capture-workstation-v5.mjs` 可重製同頁對照：探索／練習／考試各自的 Maintenance、ISE、Reagent Details、Rack Calibration、QC，加上練習及考試 Inspect、場景與任務中心。考試截圖使用腳本自建記憶體 SQLite。

- [Chrome 練習 Maintenance](artifacts/workstation-v5/chrome-1366-practice-maintenance.png)
- [Chrome 練習 Inspect](artifacts/workstation-v5/chrome-1366-practice-inspect.png)
- [Chrome 考試 Maintenance](artifacts/workstation-v5/chrome-1366-exam-maintenance.png)
- [Edge 十一瓶更換後的 Details](artifacts/workstation-v5/edge-1920-exam-reagents-completed.png)
- [Edge RB／Cali Entry](artifacts/workstation-v5/edge-1920-exam-rack-expired-completed.png)
- [Edge QC 合併保存](artifacts/workstation-v5/edge-1920-v5-exam-qc-completed.png)
截圖使用現有模型及工作站元件，沒有使用示範圖片充當介面。

## 限制

儀器程序仍為教學模擬，未連接實機。原本尚未實作的儀器功能維持入口訊息，不虛構執行結果；原圖示意比例、示例數值與實機照片沿用。未部署或改寫本機正式考試資料。
