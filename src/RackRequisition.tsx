import { useState } from "react";
import type { Daily } from "./DailyTraining";
import { tests, masQc, urineQc, type RackSelection } from "./requisitionData";
import "./requisition.css";
const toggle = (values: string[], id: string) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
export default function RackRequisition({
  d,
  notify,
}: {
  d: Daily;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("Sample"),
    [type, setType] = useState("Serum"),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<RackSelection>(d.rack.Serum),
    [profile, setProfile] = useState(false),
    [profileTests, setProfileTests] = useState<string[]>([]),
    [sub, setSub] = useState("Test Requisition");
  const current = editing ? draft : d.rack[type];
  const key = tab === "QC" ? "qc" : "sample";
  function switchTab(n: string) {
    if (editing) {
      notify("請先 Entry 儲存，或 Exit 放棄本次編輯。");
      return;
    }
    setTab(n);
  }
  function select(id: string, k: keyof RackSelection) {
    setDraft((v) => ({ ...v, [k]: toggle(v[k], id) }));
  }
  function entry() {
    d.setRack((v) => ({ ...v, [type]: draft }));
    setEditing(false);
    notify(`${type} ${tab} 已 Entry 儲存選項；尚未執行量測。`);
  }
  const groups =
    type === "Serum"
      ? [
          { name: "1.MAS QC", items: masQc },
          { name: "2.AMM/ETOH QC", items: ["33.AMM", "40.ETOH"] },
          { name: "3.ITA QC（大夜不執行）", items: null },
          { name: "4.hsCRP QC", items: ["10.CRPHS"] },
          { name: "7.CO2", items: ["54.CO2"] },
        ]
      : [
          { name: "5.URINE QC", items: urineQc },
          { name: "6.URINE TOXO（不使用）", items: null },
        ];
  return (
    <>
      <nav className="ws-primary-tabs">
        {["Sample", "Calibration", "QC"].map((n) => (
          <button key={n} aria-pressed={tab === n} onClick={() => switchTab(n)}>
            {n}
          </button>
        ))}
      </nav>
      {tab === "Sample" && (
        <nav className="ws-tabs">
          {["Test Requisition", "Demographics"].map((n) => (
            <button key={n} onClick={() => setSub(n)} aria-pressed={sub === n}>
              {n}
            </button>
          ))}
        </nav>
      )}
      <section className={`rack-page ${editing ? "rack-editing" : ""}`}>
        <div className="rack-controls">
          <label>
            Type{" "}
            <select
              aria-label="Rack Type"
              value={type}
              disabled={editing}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Serum</option>
              <option>Urine</option>
            </select>
          </label>
          <label>
            Cuvette{" "}
            <select aria-label="Cuvette">
              <option>All</option>
            </select>
          </label>
          {editing && (
            <strong className="editing-badge">&lt;Editing&gt;</strong>
          )}
        </div>
        {tab === "Sample" && (
          <div className="rack-controls">
            <label>
              Sample Kind <input readOnly value="Routine" />
            </label>
            <label>
              Sample No. <input readOnly value="0001" />
            </label>
            <label>
              Sample ID{" "}
              <input
                disabled={!editing}
                aria-label="Sample ID"
                placeholder="教學樣本"
              />
            </label>
            <span>Group of Tests　1.ROUTINE</span>
          </div>
        )}
        <div className="rack-controls">
          <button
            disabled={!editing || tab !== "QC"}
            onClick={() => {
              setProfileTests([...current.qc]);
              setProfile(true);
            }}
          >
            Profile
          </button>
          {tab === "Calibration" && (
            <span className="one-point">One Point</span>
          )}
        </div>
        <p>* : Partly Selected</p>
        {tab === "Sample" && sub === "Demographics" ? (
          <p>Demographics 入口，尚未加入個案資料。</p>
        ) : (
          <div className="rack-scroll">
            {tab === "Calibration" ? (
              <table className="rack-cal">
                <thead>
                  <tr>
                    {[0, 1, 2].flatMap((i) =>
                      ["Test Name", "RB", "Cal."].map((n) => (
                        <th key={`${i}-${n}`}>{n}</th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    { length: Math.ceil(tests.length / 3) },
                    (_, row) => (
                      <tr key={row}>
                        {tests.slice(row * 3, row * 3 + 3).map((id) => (
                          <CalCells
                            key={id}
                            id={id}
                            editing={editing}
                            rb={current.rb.includes(id)}
                            cal={current.cal.includes(id)}
                            select={select}
                          />
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : (
              <div className="rack-test-grid">
                {tests.map((id) => (
                  <button
                    key={id}
                    disabled={!editing}
                    aria-pressed={current[key].includes(id)}
                    className={current[key].includes(id) ? "qc-selected" : ""}
                    onClick={() => select(id, key)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="rack-count">
          Selected{" "}
          {tab === "Calibration" ? (
            <>
              Test　RB{" "}
              <output aria-label="RB count">{current.rb.length}</output>　Cal.{" "}
              <output aria-label="Cal count">{current.cal.length}</output>
            </>
          ) : (
            <>
              Tests{" "}
              <output aria-label="Selected Tests">{current[key].length}</output>
            </>
          )}
        </div>
      </section>
      <nav className="ws-footer">
        {editing ? (
          <>
            <button
              onClick={() => {
                setEditing(false);
                setProfile(false);
                notify("已放棄未 Entry 的變更。");
              }}
            >
              Exit
            </button>
            <button onClick={entry}>Entry</button>
            <button onClick={() => notify("請直接在表格逐項選取。")}>
              Individual Requisition
            </button>
            {tab !== "Calibration" && (
              <>
                <button
                  onClick={() => setDraft((v) => ({ ...v, [key]: [...tests] }))}
                >
                  Select All Tests
                </button>
                <button onClick={() => setDraft((v) => ({ ...v, [key]: [] }))}>
                  Deselect All Tests
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setDraft(structuredClone(d.rack[type]));
                setEditing(true);
              }}
            >
              Start Entry
            </button>
            <button
              onClick={() => notify("Display Cup Set 入口，杯架配置待補。")}
            >
              Display Cup Set
            </button>
            {tab === "Calibration" && (
              <>
                <button
                  onClick={() => notify("Auto CAL/QC Requisition 流程待補。")}
                >
                  Auto CAL/QC Requisition
                </button>
                <button
                  onClick={() => notify("QC Same Requisition 流程待補。")}
                >
                  QC Same Requisition
                </button>
                <button onClick={() => notify("Display QC Set 入口。")}>
                  Display QC Set
                </button>
              </>
            )}
          </>
        )}
      </nav>
      {profile && (
        <div
          className="profile-shade"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              e.preventDefault();
              setProfile(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="QC Profile"
            className="profile-box"
          >
            <h2>Profile · {type}</h2>
            <div className="profile-columns">
              <div>
                {groups.map((g) => (
                  <button
                    key={g.name}
                    disabled={!g.items}
                    aria-pressed={
                      !!g.items &&
                      g.items.every((id) => profileTests.includes(id))
                    }
                    onClick={() => {
                      const items = g.items!;
                      setProfileTests((v) =>
                        items.every((id) => v.includes(id))
                          ? v.filter((id) => !items.includes(id))
                          : Array.from(new Set([...v, ...items])),
                      );
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              <div className="profile-preview">
                {tests
                  .filter((id) => profileTests.includes(id))
                  .map((id) => (
                    <span key={id}>{id}</span>
                  ))}
              </div>
            </div>
            <p>
              可複選群組；OK 套用至編輯中的清單，Entry 才儲存申請。ITA 與 URINE
              TOXO 本次不使用。
            </p>
            <footer>
              <button
                onClick={() => {
                  setDraft((v) => ({ ...v, qc: profileTests }));
                  setProfile(false);
                }}
              >
                OK
              </button>
              <button onClick={() => setProfile(false)}>Cancel</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
function CalCells({
  id,
  editing,
  rb,
  cal,
  select,
}: {
  id: string;
  editing: boolean;
  rb: boolean;
  cal: boolean;
  select: (id: string, k: keyof RackSelection) => void;
}) {
  return (
    <>
      <td>{id}</td>
      <td>
        <button
          aria-label={`${id} RB`}
          aria-pressed={rb}
          disabled={!editing}
          className={rb ? "rb-selected" : ""}
          onClick={() => select(id, "rb")}
        >
          {rb ? "✓" : ""}
        </button>
      </td>
      <td>
        <button
          aria-label={`${id} Cal.`}
          aria-pressed={cal}
          disabled={!editing}
          className={cal ? "cal-selected" : ""}
          onClick={() => select(id, "cal")}
        >
          {cal ? "✓" : ""}
        </button>
      </td>
    </>
  );
}
