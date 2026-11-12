import { useState } from "react";
import { useGuidance } from "./GuidanceContext";
import type { Daily } from "./DailyTraining";
import { canRunIseProbeDiag } from "../shared/dailyScenario";
export function IseDrainWorkspace({
  d,
  notify,
  onModel,
}: {
  d: Daily;
  notify: (s: string) => void;
  onModel: () => void;
}) {
  const guidance = useGuidance();
  const [config, setConfig] = useState({
    unit: d.iseDiag.unit,
    cuvette: d.iseDiag.cuvette,
    count: d.iseDiag.count,
  });
  return (
    <div className="ws-program-content">
      <h2>Replace Sample Probe · ISE</h2>
      <label>
        <input
          type="checkbox"
          checked={config.unit}
          onChange={(e) => setConfig((v) => ({ ...v, unit: e.target.checked }))}
        />
        Unit 1
      </label>
      <label>
        Cuvette{" "}
        <select
          aria-label="DIAG 比色杯"
          value={config.cuvette}
          onChange={(e) =>
            setConfig((v) => ({ ...v, cuvette: e.target.value }))
          }
        >
          <option>內部</option>
          <option>外部</option>
        </select>
      </label>
      <label>
        Times{" "}
        <input
          aria-label="DIAG 次數"
          type="number"
          min="1"
          max="10"
          value={config.count}
          onChange={(e) =>
            setConfig((v) => ({ ...v, count: Number(e.target.value) }))
          }
        />
      </label>
      <button onClick={() => notify(d.saveIseDiag(config))}>
        OK · 儲存 DIAG 設定
      </button>
      <button
        disabled={!d.iseDiag.saved || !canRunIseProbeDiag(d.instrument)}
        onClick={() => notify(d.runIseDiag())}
      >
        DIAG ise
      </button>
      <button onClick={onModel}>到模型觀察 ISE probe</button>
      <label>
        ISE 直線排水檢查{" "}
        <select
          aria-label="ISE 直線排水檢查"
          disabled={
            (!d.unrestricted && !d.iseDiag.ran) ||
            !canRunIseProbeDiag(d.instrument)
          }
          value={d.drains.ISE || ""}
          onChange={(e) => notify(d.recordIseDrain(e.target.value))}
        >
          <option value="">未記錄</option>
          <option>正常</option>
          <option>異常</option>
        </select>
      </label>
      <p role="status">
        {!d.iseDiag.ran
          ? "尚未完成有效 DIAG。"
          : d.drains.ISE ||
            (guidance ? "請觀察並記錄排水結果。" : "DIAG 已執行。")}
      </p>
    </div>
  );
}
