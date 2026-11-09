import type { ReagentBottle } from "../shared/dailyScenario";
import { useEffect, useState } from "react";
import type { TroubleState, TroubleAction } from "../shared/troubleshooting";
import type { TroubleHint } from "./troubleGuide";
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
  onCheck,
}: {
  d: Daily;
  notify: (s: string) => void;
  onCheck?: () => Promise<boolean>;
}) {
  return (
    <ReagentSurface
      rows={d.active ? d.reagents : undefined}
      checked={d.reagentChecked}
      notify={notify}
      onReplace={d.replaceReagent}
      onCheck={() => {
        if (onCheck) return onCheck();
        const result = d.checkReagents();
        notify(result);
        return !result.startsWith("請先");
      }}
    />
  );
}
function ReagentSurface({
  rows,
  disabled = false,
  onReplace,
  onCheck,
  checked = false,
  notify,
}: {
  rows?: ReagentBottle[];
  disabled?: boolean;
  onReplace: (id: string) => void;
  onCheck: () => boolean | void | Promise<boolean | void>;
  checked?: boolean;
  notify: (s: string) => void;
}) {
  const [section, setSection] = useState("Reagent Management"),
    [tab, setTab] = useState("Main"),
    [check, setCheck] = useState(false),
    [content, setContent] = useState("(All)"),
    [hours, setHours] = useState(7);
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
                  {[
                    ...detailRows,
                    ...(rows || [])
                      .filter((r) => !detailRows.some((row) => row[0] === r.id))
                      .map((r) => [
                        r.id!,
                        r.test!,
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                      ]),
                  ]
                    .filter((r) => content === "(All)" || r[1] === "9.CRE")
                    .map((r) => {
                      const bottle = rows?.find((v) => v.id === r[0]);
                      const cre = r[1] === "9.CRE",
                        rb = cre
                          ? hours
                          : typeof r[4] === "number"
                            ? r[4]
                            : null,
                        cal = cre
                          ? hours
                          : typeof r[5] === "number"
                            ? r[5]
                            : null;
                      return (
                        <tr key={r[0]} data-testid={`reagent-${r[0]}`}>
                          <td>{r[0]}</td>
                          <td>{r[1]}</td>
                          <td>
                            {r[0].startsWith("R1") ? "R1(R1-1)" : "R2(R2-1)"}
                          </td>
                          <td className="shot-cell">
                            {bottle ? bottle.remaining : r[2]}
                          </td>
                          <td>{r[3] === "—" ? "—" : `${r[3]}D`}</td>
                          <td
                            data-testid="rb-stability"
                            className={
                              bottle?.rb === "expired"
                                ? "stability-expired"
                                : stabilityWarning(rb)
                                  ? "stability-warning"
                                  : ""
                            }
                          >
                            {bottle
                              ? bottle.rb === "expired"
                                ? "expired"
                                : bottle.rb === "unchecked"
                                  ? "未檢查"
                                  : "有效"
                              : remainingText(rb)}
                          </td>
                          <td
                            data-testid="cal-stability"
                            className={
                              bottle?.cal === "expired"
                                ? "stability-expired"
                                : stabilityWarning(cal)
                                  ? "stability-warning"
                                  : ""
                            }
                          >
                            {bottle
                              ? bottle.cal === "na"
                                ? "—"
                                : bottle.cal === "expired"
                                  ? "expired"
                                  : bottle.cal === "unchecked"
                                    ? "未檢查"
                                    : "有效"
                              : remainingText(cal)}
                          </td>
                          <td>
                            {bottle?.reason === "即將到期" && !bottle.replaced
                              ? "即將到期"
                              : r[6]}
                          </td>
                          <td>{r[7]}</td>
                          <td>{r[8]}</td>
                          <td>{r[9]}</td>
                          <td>
                            {bottle ? (
                              <>
                                <span>
                                  {bottle.replaced ? "已更換" : bottle.reason}
                                </span>{" "}
                                <button
                                  aria-label={`更換試劑 ${bottle.name} ${bottle.side}`}
                                  disabled={disabled || bottle.replaced}
                                  onClick={() => onReplace(bottle.id!)}
                                >
                                  更換
                                </button>
                              </>
                            ) : cre ? (
                              "Creatinine · 24h 校正情境"
                            ) : (
                              ""
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="reagent-note" hidden={!!rows}>
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
          {rows
            ? "訓練試劑情境；逐瓶更換後執行 Reagent Check。"
            : "照片版面與示例資料；CRE 預設 7H 用於提示示範。"}
          Entry 僅登記申請，不重設穩定時間。
        </small>
        {check && (
          <fieldset>
            <legend>Reagent Check</legend>
            <button
              disabled={disabled || !rows}
              onClick={async () => {
                if ((await onCheck()) !== false) setCheck(false);
              }}
            >
              All positions
            </button>
            <button onClick={() => setCheck(false)}>取消</button>
          </fieldset>
        )}
        {checked && <p>✓ All positions 已完成</p>}
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

export function ExamReagentManagement({
  rows,
  disabled,
  onReplace,
  onCheck,
  checked = false,
}: {
  rows: ReagentBottle[];
  disabled: boolean;
  onReplace: (id: string) => void;
  onCheck: () => void;
  checked?: boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <>
      <ReagentSurface
        rows={rows}
        disabled={disabled}
        onReplace={onReplace}
        onCheck={onCheck}
        checked={checked}
        notify={setMessage}
      />
      {message && (
        <div className="ws-message" role="status">
          {message}
        </div>
      )}
    </>
  );
}

// Reuses the native workstation's table, tabs and footer styles without daily-task state.
export function TroubleReagentManagement({
  state: s,
  busy,
  act,
  onGuide,
}: {
  state: TroubleState;
  busy: boolean;
  act: (a: TroubleAction) => boolean | Promise<boolean>;
  onGuide?: (hint: TroubleHint) => void;
}) {
  const [tab, setTab] = useState("Main"),
    [section, setSection] = useState("Reagent Management"),
    [check, setCheck] = useState(false),
    [selected, setSelected] = useState(false);
  useEffect(() => {
    if (!onGuide) return;
    const hint =
      section !== "Reagent Management"
        ? { target: "rm-section", text: "切換 Reagent Management" }
        : tab !== "Details"
          ? { target: "rm-details", text: "開啟 Details，查看試劑清單" }
          : !s.reagent.checked
            ? check
              ? {
                  target: "rm-check-confirm",
                  text: "按 All positions，執行 Reagent Check",
                }
              : { target: "rm-check", text: "按 Reagent Check" }
            : !selected
              ? { target: "rm-uibc", text: "選取 27.UIBC，查看更新的試劑結果" }
              : {
                  target: "rm-review",
                  text: "確認UIBC兩瓶已更新，RB與CALI需校正",
                };
    onGuide(hint);
  }, [tab, section, check, selected, s.reagent.checked, onGuide]);
  const status = !s.reagent.checked
    ? "未檢查"
    : s.calibration === "success"
      ? "已完成校正（情境）"
      : "expired／需校正";
  return (
    <section aria-label="UIBC Reagent Management">
      <nav className="ws-primary-tabs">
        {["Reagent Management", "Reagent Inventory", "Reagent Consumption"].map(
          (n) => (
            <button
              key={n}
              data-guide={n === "Reagent Management" ? "rm-section" : undefined}
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
          <button
            key={n}
            data-guide={n === "Details" ? "rm-details" : undefined}
            aria-pressed={tab === n}
            onClick={() => setTab(n)}
          >
            {n}
          </button>
        ))}
      </nav>
      <div className="reagent-page">
        <div className="reagent-controls">
          <div className="reagent-legend">
            <span>Inaccessible</span>
            <span>Checked</span>
            <span>Reagent Short</span>
            <span>R1 Status</span>
            <span>R2 Status</span>
          </div>
          <label>
            Type{" "}
            <select>
              <option>Serum</option>
            </select>
          </label>
          <label>
            Reagent Display{" "}
            <select>
              <option>Test</option>
            </select>
          </label>
        </div>
        {section !== "Reagent Management" || tab === "ISE" ? (
          <p>
            可查看參考頁；本次UIBC試劑檢查位於 Reagent Management → Details。
          </p>
        ) : (
          <>
            <button
              data-guide="rm-uibc"
              aria-pressed={selected}
              onClick={() => {
                setTab("Details");
                setSelected(true);
              }}
            >
              27.UIBC／查看試劑更新
            </button>
            {tab === "Details" && (
              <div className="reagent-detail-scroll">
                <table className="reagent-detail" aria-label="UIBC試劑更新">
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
                    {(["R1", "R2"] as const).map((pair) => (
                      <tr key={pair} className={selected ? "selected" : ""}>
                        <td>{pair} 教學位置</td>
                        <td>27.UIBC</td>
                        <td>{pair}</td>
                        <td>待設定</td>
                        <td>待設定</td>
                        <td
                          data-testid="uibc-rb-status"
                          className={
                            s.reagent.checked && s.calibration !== "success"
                              ? "stability-expired"
                              : ""
                          }
                        >
                          {status}
                        </td>
                        <td
                          data-testid="uibc-cal-status"
                          className={
                            s.reagent.checked && s.calibration !== "success"
                              ? "stability-expired"
                              : ""
                          }
                        >
                          {status}
                        </td>
                        <td>待設定</td>
                        <td>待設定</td>
                        <td>待設定</td>
                        <td>—</td>
                        <td>
                          {s.reagent.checked
                            ? "新瓶已更新；請依RB／CALI狀態申請"
                            : "等待Reagent Check更新"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p>
          本機教學模擬；正式儲位、容量、批號與效期未提供，保持待設定。檢查不等於校正成功。
        </p>
        {check && (
          <fieldset>
            <legend>Reagent Check</legend>
            <button
              data-guide="rm-check-confirm"
              disabled={busy}
              onClick={async () => {
                if (await act({ action: "reagent-check" })) {
                  setCheck(false);
                  setSelected(false);
                }
              }}
            >
              All positions
            </button>
            <button onClick={() => setCheck(false)}>取消</button>
          </fieldset>
        )}
        {s.reagent.checked && (
          <>
            <p role="status">
              {s.calibration === "success"
                ? "✓ Reagent Check 已完成；UIBC已完成校正（情境），QC與回溯須獨立確認。"
                : "✓ Reagent Check 已完成。UIBC 試劑已更換，請先完成校正。"}
            </p>
            <button
              data-guide="rm-review"
              disabled={busy}
              onClick={() => void act({ action: "review-reagent-update" })}
            >
              {s.calibration === "success"
                ? "確認 UIBC 更新／情境校正已完成"
                : "確認 UIBC 更新／RB及CALI需校正"}
            </button>
            {s.reagent.updateReviewed && <p>已查看UIBC試劑更新。</p>}
          </>
        )}
      </div>
      <nav className="ws-footer">
        {[
          "Edit",
          "Position Setting",
          "ID Edit",
          "Read Master Curve",
          "Reagent Check",
          "Reagent History",
          "Previous Setting",
          "Print",
        ].map((n) => (
          <button
            key={n}
            data-guide={n === "Reagent Check" ? "rm-check" : undefined}
            disabled={busy && n === "Reagent Check"}
            onClick={() => {
              if (n === "Reagent Check") setCheck(true);
            }}
          >
            {n}
          </button>
        ))}
      </nav>
    </section>
  );
}
