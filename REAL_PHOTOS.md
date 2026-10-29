# 實機照片對照（2026-10-28）

來源：使用者提供的 `AU5800實體` 資料夾。23 張 JPEG 原檔（原 20 張，加上本次 3 張 ISE 內部照片）完整複製到 `public/references/real-photos/`，保留檔名及內容，不裁切、不重新壓縮。原有其他照片仍保留在 `public/references/`。

選取部件後開啟「實機照片」，可切換照片、查看原始檔名及放大。探索、日／周保養練習與考試共用照片面板；照片的瀏覽、切換與放大不產生保養事件或進度。

| 原始檔名 | 連結部位／模型識別 |
| --- | --- |
| ISE cups.jpg | ISE 保養試劑杯 `ise-cups`，S-H／S-L／U-H／U-L 杯位 |
| ISE module.jpg | ISE 模組 `ise` 的鐵蓋關閉外觀；內部相簿亦保留此外觀作對照 |
| ISE module (上方開啟).jpg | ISE 模組內部 `ise-internal` 的首張照片；ISE 模組與內部零件相簿提供開蓋位置對照 |
| ISE module mixing cup, T型管.jpg | ISE 混合杯 `ise-mixing-cup`、T 型管 `ise-t-tube`，以及內部相簿 |
| ISE module 馬達 (拆卸).jpg | ISE 馬達 `ise-motor`、插頭 `ise-plug-a`／`ise-plug-b`，以及內部相簿；A/B 沿用模型識別，不是照片上的實機接頭編號 |
| ISE probe.jpg | ISE 探針 `ISE`；ISE 洗滌瓶槽 `ise-wash-1`、`ise-wash-2` |
| ISE reference.jpg | ISE Reference 下層櫃 `ise-reference`；ISE 試劑相簿 |
| ISE standard, buffer.jpg | ISE Standard／Buffer 試劑櫃 `ise-reagents` |
| mixer bar (右側) mixing well.jpg | 右側 mixing well：`well-R1S-1`～`well-R1S-12`；右側攪拌組相簿 |
| mixer bar (右側).jpg | 右側攪拌組 `右側`／`group-R1S` 與 R1S 攪拌棒 |
| mixer bar (右側)_2.jpg | 右側攪拌組及 R1S 攪拌棒的第二視角 |
| mixer bar (左側) mixing well.jpg | 左側 mixing well：`well-R2-1`～`well-R2-6`；左側攪拌組相簿 |
| mixer bar (左側).jpg | 左側攪拌組 `左側`／`group-R2` 與 R2 攪拌棒 |
| R1右側.jpg | R1 外側瓶槽 `r1-outer-1`～`r1-outer-3`：59.CLN-1、60.CLN-2、56.Diluent/W2 |
| R1左側.jpg | R1 內側瓶槽 `r1-inner-1`～`r1-inner-3`：57.CLN-1、58.CLN-2、55.Diluent/W2 |
| R2右側.jpg | R2 內側瓶槽 `r2-inner-1`～`r2-inner-3`：55.CLN-1、56.CLN-2、W2 |
| R2左側.jpg | R2 外側瓶槽 `r2-outer-1`～`r2-outer-3`：57.CLN-1、58.CLN-2、W2 |
| Sample probe DET1, DET2.jpg | Sample 兩側 DET 瓶槽 `sample-left-1/2`、`sample-right-1/2` |
| Sample probes.jpg | Sample 探針模組 `sample`、`Sample-1`、`Sample-2` |
| wash solution.jpg | Wash Solution 櫃 `clean-solution` 的洗滌液桶 |
| wash solution櫃子.jpg | Wash Solution 櫃 `clean-solution` 的櫃體及桶位置 |
| 前方syringe.jpg | 前方四支 syringe／前方櫃 `syringes`，不套用到後方 syringe |
| 試劑冰箱 (分析單元).jpg | 分析單元 `analyzer`；R1／R2 相簿；R1／R2 探針使用分析單元位置參考，不宣稱為個別探針特寫 |

左右瓶槽以照片印刷標籤和現有 `src/detergents.ts` 槽位編號核對，避免前／後視角相反造成誤配。攪拌組沿用現有定義：右側 R1/S 十二支，左側 R2 六支。

`src/realPhotos.ts` 集中管理部件相簿與精細選取對照；`src/data.ts` 將原始檔名套用到既有部件資料。ISE 內部、混合杯、T 型管、馬達及插頭已改用此次補充的實機照片，不再標示缺圖；後方 syringe 與後方運送軌道仍保留缺圖及位置參考說明。此更新不修改保養內容、完成標準或考試版本。

## 第一批 20 張照片驗證紀錄

- 正式建置 `npm run build` 通過。
- 20 張來源與匯入檔的 SHA-256 全部一致；打包內容包含原始檔名及圖片。
- Chrome 1366×768、Edge 1920×1080 共 20 個相關瀏覽器案例通過（18 個首輪通過，另 2 個修正測試導覽後重跑通過）。涵蓋全部照片載入、切換、放大與 Esc 關閉、左右瓶槽編號、同模組內選取重設、日／周練習不因照片瀏覽推進，以及考試照片與計時／進度維持。
- 考試驗證使用獨立暫存 SQLite；現有 `data/au5800.sqlite` 未修改。此次未重跑後端保養流程全套測試，未改動後端或評分規則。
- 實際畫面：`artifacts/real-photos/chrome-1366-ise-cups.png`、`edge-1920-ise-cups.png`、`chrome-1366-hud-exam.png`、`edge-1920-hud-exam.png`。

## 本次補充與名稱更正驗證

- 正式建置通過；23 張照片均已打包，與來源檔 SHA-256 全部一致。
- Chrome 1366×768、Edge 1920×1080 共 10 個相關案例通過（8 個首輪通過，照片相簿案例修正測試頁籤導覽後兩個重跑通過）。確認 ISE 內部與零件照片、Wash Solution 櫃名稱與開門按鈕、前方 syringe、保養杯、探索及練習的左右攪拌照片、照片切換、放大／Esc、原瓶槽對應及瀏覽不推進練習。
- 保養規則、模型幾何、考試評分及正式資料庫均未變更。
- 新實際畫面位於 `artifacts/real-photos/`：`chrome-1366-ise-internal-photo.png` 為內部照片放大畫面；各瀏覽器的 `clean-solution-updated.png`、`syringes-updated.png`、`mixer-左側-updated.png`、`mixer-右側-updated.png` 為指定部位的照片面板。

## CALI／QC 備料照片

新增 `CALI.jpg`、`QC.jpg` 兩張本院儲存架合照，來源與匯入檔 SHA-256 均一致，保留原始內容。材料資訊卡的對照集中於 `shared/materialCatalog.ts`；未能辨識的瓶子不推定身份。這兩張實拍不代替尚缺的五張配製保存資料原圖，也不當作批號或期限核對證據。ITA-3 標籤與任務 ITA-2 的差異保留待確認。完整記錄見 [第十三組交付紀錄](PREPARATION_DELIVERY.md)。

## UIBC 情境原圖

新增原始 `LIS QC審批畫面.png`、`LIS QC L-J chart.png`、`UIBC試劑瓶.jpg`、`檢體回溯填報.png`，來源為本次使用者提供的 `AU5800實體` 目錄。四張 SHA-256 與來源相同，未編修。前三個 LIS 畫面／圖表參考以可操作程式重建，UIBC 瓶圖保留為實拍參考；不直接把圖當互動頁面背景、不以圖上批號、容量、日期或舊規則覆寫情境數據。實際遊戲截圖、未知資料及驗證見 [UIBC_DELIVERY.md](UIBC_DELIVERY.md)。
