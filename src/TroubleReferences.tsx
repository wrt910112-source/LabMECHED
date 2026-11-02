import { useEffect, useRef, useState } from "react";
import { asset } from "./data";
export default function TroubleReferences() {
  const dialog = useRef<HTMLDialogElement>(null),
    [zoom, setZoom] = useState(1);
  return (
    <article className="lis-sop">
      <h2>科內 QC 異常處理流程圖</h2>
      <p>
        使用者提供原圖，作為處理分支參考；觀看不會自動完成任務。本次UIBC演練依目前設定執行，未新增換品管液或其他強制關卡。
      </p>
      <button onClick={() => dialog.current?.showModal()}>放大流程圖</button>
      <a
        href={asset("real-photos/QC異常流程圖.png")}
        target="_blank"
        rel="noreferrer"
      >
        另開原圖
      </a>
      <img
        className="trouble-sop-reference"
        src={asset("real-photos/QC異常流程圖.png")}
        alt="檢驗科生化組品管異常處理流程圖原圖"
        onClick={() => dialog.current?.showModal()}
      />
      <p>
        本次訓練路徑：1.3S判讀 → 查看因素 → 原杯重測2.2S → 開蓋、更換兩支試劑 →
        關蓋、Reagent Management手動檢查及查看RB／CALI需校正 → 校正與兩濃度QC →
        回溯、填報與呈送。主管核准與常規檢體恢復不在此次模擬的自動完成範圍。
      </p>
      <dialog
        className="lis-sop-dialog"
        ref={dialog}
        aria-label="QC異常處理流程圖原圖"
        onCancel={(e) => {
          e.stopPropagation();
          setZoom(1);
        }}
      >
        <header>
          <b>QC 異常處理流程圖／原始參考</b>
          <button onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}>
            縮小
          </button>
          <button onClick={() => setZoom((v) => Math.min(3, v + 0.25))}>
            放大
          </button>
          <button
            onClick={() => {
              dialog.current?.close();
              setZoom(1);
            }}
          >
            關閉流程圖
          </button>
        </header>
        <div className="sop-image-scroll">
          <img
            style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
            src={asset("real-photos/QC異常流程圖.png")}
            alt="QC異常流程圖放大原圖"
          />
        </div>
      </dialog>
    </article>
  );
}
