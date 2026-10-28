import type { ReactNode } from "react";
export function AnalyzerStatusSurface({ children }: { children: ReactNode }) {
  return (
    <div className="ws-analyzer-status">
      {" "}
      <div className="ws-status-schematic" aria-label="儀器狀態配置示意">
        <div className="ws-track">Sample transport</div>
        <div className="ws-loader">
          Rack Loader
          <br />
          <span>⇄</span>
          <div>Master Wash Solution</div>
        </div>
        <div className="ws-ise-column">
          ISE
          {["REF", "MID", "BUF"].map((n) => (
            <span key={n}>{n} ●</span>
          ))}
        </div>
        <div className="ws-analysis">
          <div className="ws-incubator">Incubator</div>
          <div className="ws-discs">
            <span>R2</span>
            <span>R1</span>
          </div>
          <div className="ws-temps">
            <div>
              Bath Temp. <output>37.0</output> °C
            </div>
            <div>
              Coolant Temp. <output>8.2</output> °C
            </div>
            <small>照片數值示意，非即時量測或合格範圍</small>
          </div>
          <div className="ws-fluid-grid">
            {[
              "D.I. Water",
              "Diluted Wash Sol.",
              "Conc. Waste",
              "Vacuum Tank",
              "Wash Solution",
              "Waste",
            ].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
