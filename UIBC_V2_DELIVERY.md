# UIBC v2：操作簡化與逐鍵螢光藍提示

本文件記錄保留相容的 `AU5800-UIBC-2026-10-29-v2`。目前新練習與考試採 v3，環形槽、取瓶動畫及關蓋後手動 Reagent Check 見 [UIBC_V3_DELIVERY.md](UIBC_V3_DELIVERY.md)。既有 v1／v2 考試保留原操作、分組及成績。

## 操作變更

1. QC 審批移除未執行的第二濃度占位列。點選 183 圖點，選 1.3S 及「原杯品管液上機」，確認判讀完成第 1 步。
2. 個別查看品管液、試劑及校正資料，完成第 2 步。
3. 按「原杯品管液上機」，將原杯 MAS-1 裝入綠架、進樣並推入，自動重測才產生 179。移除原杯核對視窗及另外的執行按鍵。
4. 點 179 圖點，選 2.2S 及「進行異常處理」，確認判讀。
5. 開儀器、R1、R2 蓋，明確取出兩舊瓶。選 R1a／R2a 後顯示「加入 R1／R2」，選新瓶後顯示「混和均勻」「放入儀器」及取回／重做選項。兩瓶正確就位後自動 Reagent Check，顯示需校正。v2 不執行更換品管液或中間重測。
6. Rack 支援 Start Entry 後跨 Calibration／QC 選取 UIBC 的 RB、Cal.、QC，最後一次 Entry 保存；Exit 放棄整批草稿。此選用功能不改變日／周保養的登記方式。
7. 準備 RB／ddH2O、LCC-1、MAS-1、MAS-3，分別裝藍、黃、綠架，勾選三架並同批進樣、推入。系統依序模擬校正與 QC，產生 155、50，完成第 6、7 步。

第 8–12 步仍是各筆回溯、附件上傳、三類片語及呈送。全程本機模擬，呈送仍為「已呈送，待審核」，不恢復常規病患測試。

## 逐鍵提示

- 練習每次只替一個下一步控制項加上 `#55EAFF`、3px 外框與柔和外光，不閃爍。點選、下拉值、未保存的 Rack 草稿及片語編輯都會更新目標。
- 外框涵蓋導覽頁籤、圖點、下拉框、檢體架勾選、開蓋、物件選取、配製／裝架按鍵、回溯核對、附件選取、片語移入／移出／確定及呈送。
- 需選取 3D 來源／試劑時，也以藍色線框標示對應物件；旁邊有同一物件的選取按鍵，選取後才顯示情境操作。
- 目標不在目前頁面時先標示導覽頁籤；「定位目前操作」只捲動至目標，不代為選值、點擊或完成。
- 錯誤、取消與草稿未保存不會跳過；保存／模擬執行時暫停提示，保存失敗改提示重試。
- 考試無引導外框、下一步文字或正確片語提示；一般選取與鍵盤焦點保留，錯誤選項仍可操作並記錄。

## 實作與相容

主要檔案：

| 檔案 | 用途 |
|---|---|
| `shared/troubleshooting.ts` | 版本分流、蓋子、判讀後續處理、同批登記／推入、自動執行、共用檢核 |
| `src/TroubleshootingRoom.tsx` | v2 控制器、簡化介面與穩定提示目標 |
| `src/troubleGuide.ts` | 由情境及草稿推導下一步，避免按點擊次數前進 |
| `src/TroubleshootingRoomV1.tsx` | 保留 v1 原介面與操作 |
| `src/RackRequisition.tsx` | 選用跨頁同批登記與草稿提示回呼，預設行為不變 |
| `src/TroubleLis.tsx` | 圖點回呼、占位列、回溯及片語內部的提示目標 |
| `src/Viewer.tsx`、`src/troubleshootingModel.ts` | 共用模型開蓋與 3D 目標線框 |

沿用 SQLite JSON、事件去重、revision、交易保存、失敗重試、計時與重新整理恢復，不新增資料表。v1／v2 的執行與判定按已保存版本分流，不重算已交卷成績。

LCC-1 是使用者指定的本次教學材料；不覆寫完整目錄原有 LCC2→UIBC 的資料，正式對應保留待確認。MAS-1／MAS-3 是情境別名，不由名稱中的 H 推定正式濃度。分裝量、正式架位、瓶身日期及其他未知資料未補造；素材及其餘待補清單見 [原始交付紀錄](UIBC_DELIVERY.md)。

## 驗證與截圖

- 正式建置通過；保留既有大型 bundle 提示。
- 後端 68 項通過，包含 v2 判讀條件、開蓋、兩瓶自動檢查、四材料／三架原子操作、校正後才產生 QC、失敗校正、配置變更撤銷，以及既有 v1 與日／周保養測試。
- Chrome 1366×768、Edge 1920×1080 驗證每個提示外框；含錯誤規則不前進、Exit 放棄跨頁草稿、取消片語、完整十二步、考試無引導、失敗重試及重新整理。
- 另以真實暫存 SQLite 的 v1 考試跑完原操作並交卷，確認 v2 更新後仍可得到原版 100 分。
- 瀏覽器共 34 項通過：UIBC v2 練習／考試及 v1 相容共 6 項，既有日／周保養、自由備料、HUD 與 Rack 工作站 24 項，以及完整日／周保養考試 4 項。
- 測試資料庫均位於暫存目錄，不使用學員資料庫。

執行指令：`npm.cmd run build`、`npm.cmd run test:server`、`npm.cmd test -- tests/troubleshooting.spec.ts`。另執行既有日／周保養、自由備料、Rack 工作站與完整日／周考試回歸。

畫面在 `artifacts/troubleshooting/`，新檔名含 `v2-`：

- [判讀外框](artifacts/troubleshooting/chrome-1366-v2-interpret-guide.png)
- [Rack Entry 外框](artifacts/troubleshooting/chrome-1366-v2-rack-entry-guide.png)
- [試劑情境操作](artifacts/troubleshooting/chrome-1366-v2-reagent-R1.png)
- [片語確定外框](artifacts/troubleshooting/edge-1920-v2-phrase-actions.png)
- [考試呈送](artifacts/troubleshooting/edge-1920-exam-v2-submitted.png)
