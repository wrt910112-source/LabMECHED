import { useState } from "react";
import type { Daily } from "./DailyTraining";
import {
  tests,
  mainShots,
  detailRows,
  remainingText,
  stabilityWarning,
} from "./requisitionData";
import "./requisition.css";
export default function ReagentManagement({
  d,
  notify,
}: {
  d: Daily;
  notify: (s: string) => void;
}) {
  const [section, setSection] = useState("Reagent Management"),
    [tab, setTab] = useState("Main"),
    [check, setCheck] = useState(false),
    [content, setContent] = useState("(All)"),
    [hours, setHours] = useState(7);
  function change(i: number, patch: Partial<Daily["reagents"][number]>) {
    d.setReagents((v) => v.map((r, j) => (i === j ? { ...r, ...patch } : r)));
    d.setReagentChecked(false);
  }
  const footer =
    tab === "Details"
      ? [
          "Edit",
          "Position Setting",
          "ID Edit",
          "Read Master Curve",
          "Reagent Check",
          "Reagent History",
          "Previous Setting",
          "Print",
        ]
      : ["Reagent Check", "Inventory Check"];
  return (
    <>
      <nav className="ws-primary-tabs">
        {["Reagent Management", "Reagent Inventory", "Reagent Consumption"].map(
          (n) => (
            <button
              key={n}
              aria-pressed={section === n}
              onClick={() => setSection(n)}
            >
              {n}
            </button>
          ),
        )}
      </nav>
      <nav className="ws-tabs">
        {["Main", "Details", "ISE"].map((n) => (
          <button key={n} aria-pressed={tab === n} onClick={() => setTab(n)}>
            {n}
          </button>
        ))}
      </nav>
      <section className="reagent-page">
        <div className="reagent-controls">
          <div className="reagent-legend">
            <span>Inaccessible</span>
            <span>Checked</span>
            <span>Reagent Short</span>
            <span>R1 Status</span>
            <span>R2 Status</span>
          </div>
          <div>
            <label>
              Type{" "}
              <select>
                <option>Serum</option>
              </select>
            </label>
            {tab === "Main" ? (
              <>
                <label>
                  Decision <input readOnly value="Manual" />
                </label>
                <label>
                  A day of the week <input readOnly value="Monday" />
                </label>
              </>
            ) : (
              <label>
                Reagent Display{" "}
                <select>
                  <option>Test</option>
                </select>
              </label>
            )}
          </div>
          <div>
            {tab === "Main" ? (
              <>
                <label>
                  Shot/Vol.{" "}
                  <select>
                    <option>Shot</option>
                  </select>
                </label>
                <label>
                  Margin <input readOnly value="100 %" />
                </label>
              </>
            ) : (
              <label>
                Content{" "}
                <select
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                >
                  <option>(All)</option>
                  <option>CRE</option>
                </select>
              </label>
            )}
          </div>
        </div>
        {section !== "Reagent Management" || tab === "ISE" ? (
          <p>
            {section}／{tab} 入口，詳細內容待補。
          </p>
        ) : tab === "Main" ? (
          <div className="reagent-main-grid">
            {tests.slice(0, 30).map((n, i) => (
              <button
                key={n}
                className={
                  i === 19
                    ? "short"
                    : i === 27 || i === 28
                      ? "inaccessible"
                      : ""
                }
                onClick={() => {
                  setContent("(All)");
                  setTab("Details");
                }}
              >
                <span>{n}</span>
                <div>
                  {mainShots[i] || "—"}
                  <i style={{ width: `${i === 19 ? 35 : 85}%` }} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="reagent-detail-scroll">
              <table className="reagent-detail">
                <thead>
                  <tr>
                    {[
                      "Pos.",
                      "Test Name",
                      "R1/R2",
                      "Shots",
                      "Onboard Remaining",
                      "RB Stability Remaining",
                      "Cal Stability Remaining",
                      "Expiration",
                      "Lot No.",
                      "Bottle No. (SN)",
                      "Seq.",
                      "Comment",
                    ].map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows
                    .filter((r) => content === "(All)" || r[1] === "9.CRE")
                    .map((r) => {
                      const cre = r[1] === "9.CRE",
                        rb = cre ? hours : r[4],
                        cal = cre ? hours : r[5];
                      return (
                        <tr key={r[0]} data-testid={`reagent-${r[0]}`}>
                          <td>{r[0]}</td>
                          <td>{r[1]}</td>
                          <td>
                            {r[0].startsWith("R1") ? "R1(R1-1)" : "R2(R2-1)"}
                          </td>
                          <td className="shot-cell">{r[2]}</td>
                          <td>{r[3]}D</td>
                          <td
                            data-testid="rb-stability"
                            className={
                              stabilityWarning(rb) ? "stability-warning" : ""
                            }
                          >
                            {remainingText(rb)}
                          </td>
                          <td
                            data-testid="cal-stability"
                            className={
                              stabilityWarning(cal) ? "stability-warning" : ""
                            }
                          >
                            {remainingText(cal)}
                          </td>
                          <td>{r[6]}</td>
                          <td>{r[7]}</td>
                          <td>{r[8]}</td>
                          <td>{r[9]}</td>
                          <td>{cre ? "Creatinine · 24h 校正情境" : ""}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="reagent-note">
              <button
                onClick={() =>
                  notify(
                    "Initialize Onboard Stability 入口，尚未重設任何資料。",
                  )
                }
              >
                Initialize Onboard Stability
              </button>
              <label>
                CRE 剩餘時間示範{" "}
                <input
                  aria-label="CRE remaining hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setHours(n);
                  }}
                />{" "}
                hrs
              </label>
              <span>
                RB／Cal &lt; 8 hrs 變黃；8 hrs 不變黃。依您提供的大夜班 24h
                校正情境。
              </span>
            </div>
          </>
        )}
        <small>
          照片版面與示例資料；CRE 預設 7H 用於提示示範。Entry
          僅登記申請，不重設穩定時間。
        </small>
        {tab === "Details" && d.active && (
          <details open className="reagent-training">
            <summary>日保養試劑更換紀錄（練習情境）</summary>
            <table className="daily-table">
              <thead>
                <tr>
                  {[
                    "Test",
                    "R1/R2",
                    "Shots／需求",
                    "狀態",
                    "紀錄",
                    "更換",
                    "用量已檢查",
                  ].map((n) => (
                    <th key={n}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.reagents.map((r, i) => (
                  <tr key={i}>
                    <th>{r.name}</th>
                    <td>{r.side}</td>
                    <td>
                      {r.remaining}／{r.need}
                    </td>
                    <td>{r.replaced ? "已更換" : r.reason}</td>
                    <td>
                      <input
                        aria-label={`${r.name} ${r.side} 紀錄`}
                        value={r.note}
                        onChange={(e) => change(i, { note: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        disabled={!d.cal.checked || r.replaced}
                        onClick={() =>
                          change(i, {
                            replaced: true,
                            remaining: 500,
                            reviewed: false,
                          })
                        }
                      >
                        更換 {r.name} {r.side}
                      </button>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${r.name} ${r.side} 用量已檢查`}
                        checked={r.reviewed}
                        onChange={(e) =>
                          change(i, { reviewed: e.target.checked })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
        {check && (
          <fieldset>
            <legend>Reagent Check</legend>
            <button
              onClick={() => {
                if (!d.active || !d.cal.checked || !d.reagentReady) {
                  notify(
                    "請先完成校正檢查，逐項記錄並確認用量，且更換用完、量不足或即將到期的試劑；R1／R2 分別檢查。",
                  );
                  return;
                }
                d.setReagentChecked(true);
                setCheck(false);
                notify(
                  "All positions 教學檢查完成。下一步進入 Rack Requisition 設定 Calibration 與 QC。",
                );
              }}
            >
              All positions
            </button>
            <button onClick={() => setCheck(false)}>取消</button>
          </fieldset>
        )}
        {d.reagentChecked && <p>✓ All positions 已完成</p>}
      </section>
      <nav className="ws-footer">
        {footer.map((n) => (
          <button
            key={n}
            onClick={() =>
              n === "Reagent Check"
                ? setCheck(true)
                : notify(`${n} 入口，詳細操作待補。`)
            }
          >
            {n}
          </button>
        ))}
      </nav>
    </>
  );
}
