import { useState, type ReactNode } from "react";
import {
  analyzerActions,
  iseActions,
  analyzerRows,
  iseRows,
} from "./workstationData";
/** Original instrument software layout, shared by exploration, practice and exams. */
export function MaintenanceSurface({
  ise,
  enabled,
  busy = false,
  blocked = false,
  cleaningBlocked = false,
  toggle,
  perform,
  update,
  workspace,
  iseInterlocks = true,
}: {
  ise: boolean;
  enabled: boolean;
  busy?: boolean;
  blocked?: boolean;
  cleaningBlocked?: boolean;
  toggle: (value: boolean) => void;
  perform: (name: string) => void;
  update: () => void;
  workspace?: ReactNode;
  iseInterlocks?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [soon, setSoon] = useState(false),
    [selected, setSelected] = useState(-1);
  const rows = ise ? iseRows : analyzerRows;
  return (
    <div className="ws-maintenance-body">
      <section className="ws-maintenance-list">
        {workspace || (
          <>
            <div className="ws-filters">
              <label>
                <input
                  type="checkbox"
                  checked={pending}
                  onChange={(e) => setPending(e.target.checked)}
                />
                Display Pending Items Only
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={soon}
                  onChange={(e) => setSoon(e.target.checked)}
                />
                Procedures Due Soon
              </label>
            </div>
            <div className="ws-table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "No.",
                      "Maintenance",
                      "Pending",
                      "Performed",
                      "Frequency",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending || soon ? (
                    <tr>
                      <td colSpan={5}>尚無待執行或即將到期的模擬紀錄。</td>
                    </tr>
                  ) : (
                    rows.map(([name, freq], i) => (
                      <tr
                        key={name}
                        className={selected === i ? "selected" : ""}
                      >
                        <td>{i + 1}</td>
                        <td>
                          <button onClick={() => setSelected(i)}>{name}</button>
                        </td>
                        <td>—</td>
                        <td>—</td>
                        <td>{freq}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <small>項目與頻率依照片呈現；未載入保養日期及執行紀錄。</small>
          </>
        )}
      </section>
      <aside
        className="ws-actions"
        aria-label={`${ise ? "ISE" : "Analyzer"} Maintenance 操作按鈕`}
      >
        <button className="ws-update" onClick={update}>
          Update
        </button>
        <label className="ws-enable">
          <input
            type="checkbox"
            disabled={busy}
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
          />
          {ise ? "ISE" : "Analyzer"} Maintenance
        </label>
        <div className="ws-action-grid">
          {(ise ? iseActions : analyzerActions).flatMap((row, i) =>
            row.map((name, j) =>
              name ? (
                <button
                  key={`${i}-${j}`}
                  disabled={
                    busy || (ise && iseInterlocks && (!enabled || blocked))
                  }
                  onClick={() => perform(name)}
                >
                  {name}
                </button>
              ) : (
                <span key={`${i}-${j}`} />
              ),
            ),
          )}
        </div>
        {ise && (
          <div className="daily-cleaning-buttons">
            {["Cleaning", "Cleaning (Enhanced)"].map((name) => (
              <button
                key={name}
                disabled={
                  busy || (iseInterlocks && (enabled || cleaningBlocked))
                }
                onClick={() => perform(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
