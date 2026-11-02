# UIBC v3：環形試劑槽、取瓶動畫與手動 Reagent Check

版本：`AU5800-UIBC-2026-10-30-v3`。新練習及新考試採用此流程；既有 v1／v2 考試保留原規則與成績。

## 本次行為

- 在「查看 SOP」加入原始 `QC異常流程圖.png`，可放大、縮小及另開原圖。來源與匯入檔的 SHA-256 相同：`543FC39D39B8879173B59BC1496C21CBF167E1C4D8388C1CEE4C3DBDB9465F38`。
- 流程圖作為參考，不將圖內分支自動新增為本次任務。例如原圖中的更換品管液與 rerun，不會重新變成 v3 強制關卡。查看原圖不計操作完成。
- R1／R2 改為有真實開孔的凹槽、環形瓶架、中心軸與一圈示意瓶。UIBC 舊／新瓶位於蓋子下方的指定教學位置，不站在蓋面，也不放在中心軸上。蓋回後瓶身被遮住。
- 「取出」先讓指定瓶垂直上升，再移至工作台；放入則抬起、移至槽位並向下放入。一般查看、重複選取及重新整理不重播已完成的取放動作。
- 動畫中暫停後續物理操作，完成後才移動螢光藍提示。完成保護不依賴 GPU 每一幀都即時繪出，避免頁面暫停或擷取畫面時一直鎖住；重新進入時依保存的實際瓶位恢復。

## 第 5 步新流程

1. 打開儀器主蓋、R1 蓋、R2 蓋，分別取出兩支舊 UIBC。
2. R1a 加入新 R1、R2a 加入新 R2，各自混和均勻並放入對應空槽。
3. 蓋回 R1、R2，再蓋儀器主蓋。新瓶就位不再自動通過 Reagent Check。
4. 前往 Reagent Management → Details → Reagent Check → All positions。
5. 選取 27.UIBC，查看兩瓶更新結果；RB Stability Remaining 與 Cal Stability Remaining 顯示 `expired／需校正`，確認後完成第 5 步。

此介面沿用現有工作站的灰底、頁籤、表格及底部工具列樣式。往返 3D 或其他頁面保留 Details 畫面。正式儲位編號、Shots、瓶身批號及效期仍為待設定，未借用參考畫面的其他試劑資料。

未關蓋、漏取舊瓶、來源／槽位錯誤或漏混勻均不能通過檢查。未執行檢查及未查看 UIBC 更新結果，不能進入本次三架批次執行。再次改動配置會撤銷檢查、更新確認、校正及下游有效認列，但保留結果與歷程。

校正成功後，表格更新為「已完成校正（情境）」；不等於 QC 合格、主管核准或常規檢體恢復。其餘十二步流程及回溯／呈送限制保留。

另修正矯正結果片語的順序問題：v3 加入「品管合格」「進行檢體回溯，待合批收。」時，兩句順序不同仍可確定，不再一直提示手動編輯。缺句、重複內容、其他句子或錯誤片語仍不能認列；v1／v2 判定不變。

## 練習提示與已分裝杯標示

- 原因探討、矯正措施、矯正結果的片語視窗，在空白區顯示「請選取正確的片語以及操作順序，選取正確者會亮燈提示輸入」。保留逐鍵螢光藍提示：先選片語，再提示加入；錯誤選取不亮起加入提示。提示說明不寫入表單。
- 校正因素補充「檢查試劑校正效期、校正液效期與開封／泡製時間」，未提供日期仍待確認，查看不等於期限核對通過。
- 工作台旁新增「備料小抄」開關，點開後在右側顯示。原杯重測提示使用 MAS-1 原杯及綠架；後續批次直接讀取共用需求，列出 RB／ddH2O、LCC-1、MAS-1、MAS-3 與各自架色。沿用已確認的 MAS-3，未將使用者舉例的 MAS-2 取代正式任務資料。
- 小抄開關僅控制畫面，不發送作業事件或改變完成判定。片語說明及操作小抄僅練習模式顯示，考試保留原有資訊及操作方式。
- 共用備料場景中，杯內有液體即顯示金色 `#FFD700` 外框，空杯不顯示；移位、裝架及上機時跟隨杯子，清空即移除。此標示只反映物理內容，不依正確材料、架位或考試答案決定是否亮起。
- 本次為顯示與參考資訊調整，不更換考試版本、計分或存檔格式。

主要檔案：`src/TroubleLis.tsx`、`src/TroubleshootingRoom.tsx`、`src/preparationModel.ts`、`src/Viewer.tsx`、`src/troubleshooting.css`；`shared/troubleshooting.ts` 抽出既有批次需求供小抄共用，判定保持相同。

本次增補驗證：正式建置與後端 71 項通過；Chrome 1366×768、Edge 1920×1080 的完整練習、考試保存／重試／恢復及杯框檢查共 6 項通過，另有自由探索與自由備料回歸 4 項通過。涵蓋三個片語說明、錯誤選取、考試隱藏、小抄開關不推進、原杯／四材料清單、非任務來源杯仍有金框、移位跟隨與清空移除。

增補實際截圖：

- [片語空白區說明](artifacts/troubleshooting/chrome-1366-v3-phrase-cause-hint.png)
- [校正檢查提醒](artifacts/troubleshooting/chrome-1366-v3-calibration-check-reminder.png)
- [原杯小抄與金色杯框](artifacts/troubleshooting/edge-1920-v3-original-bench-note-gold.png)
- [四材料小抄與金色杯框](artifacts/troubleshooting/edge-1920-v3-batch-bench-note-gold.png)

## 主要實作

| 檔案 | 用途 |
|---|---|
| `shared/troubleshooting.ts`、`shared/exam.ts` | v3 版本、關蓋／手動檢查／更新確認及舊版相容 |
| `src/troubleshootingModel.ts`、`src/washModel.ts` | 真正凹槽、環形模型、閉蓋遮蔽及分段取放動畫 |
| `src/Viewer.tsx` | 動畫繪製、完成保護及資源釋放 |
| `src/ReagentManagement.tsx` | UIBC 情境的原樣式手動檢查及更新表格；既有日保養表面保留 |
| `src/TroubleReferences.tsx` | SOP 原圖與可縮放參考視窗 |
| `src/TroubleshootingRoom.tsx`、`src/troubleGuide.ts` | 新視窗入口、保存畫面及逐鍵提示 |
| `src/TroubleLis.tsx` | 矯正結果片語順序核對 |

環形排列及瓶型是依提供參考製作的教學示意，不代表實際容量、瓶數或正式儲位。原圖以原始內容保存在 `public/references/real-photos/QC異常流程圖.png`。

## 驗證與畫面

- 正式建置通過（保留既有大型 bundle 提示）；後端 71 項、瀏覽器 34 項通過。瀏覽器包含新版／舊版 UIBC 與幾何檢查 10 項，以及既有功能回歸 24 項。
- 正式建置及後端測試涵蓋手動檢查、關蓋順序、更新確認、三架攔截、配置變動撤銷與片語順序。
- Chrome 1366×768／Edge 1920×1080 測試完整練習、考試保存／重試／恢復，以及既有 v1、v2 考試完成與評分。
- 幾何測試確認蓋下高度、工作台真正開孔、環形參考瓶、先垂直上升再移動、放回座位及關蓋遮蔽。
- 原 SOP 放大／關閉不推進任務；檢查前為未檢查，檢查後 RB／CALI 需校正，校正後狀態另行更新。
- 原日／周保養、自由備料、HUD 與 Rack 工作站另做回歸；測試使用暫存 SQLite，不在學員資料庫建立測試資料。

執行：`npm.cmd run build`、`npm.cmd run test:server`、`npm.cmd test -- tests/troubleshooting.spec.ts`，另執行既有相關測試檔。

實際截圖保存在 `artifacts/troubleshooting/`，本次檔名包含 `v3-`：

- [舊瓶拉起](artifacts/troubleshooting/chrome-1366-v3-old-R1-lift.png)
- [新瓶位於槽內](artifacts/troubleshooting/chrome-1366-v3-new-bottles-seated.png)
- [Reagent Check 後 RB／CALI 需校正](artifacts/troubleshooting/chrome-1366-v3-reagent-check-updated.png)
- [矯正結果反向加入後可確定](artifacts/troubleshooting/edge-1920-v3-phrase-results.png)
