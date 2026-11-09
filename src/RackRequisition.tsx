import { useEffect, useRef, useState } from "react";
import type { Daily } from "./DailyTraining";
import { tests, masQc, urineQc, type RackSelection } from "./requisitionData";
import "./requisition.css";
const toggle = (values: string[], id: string) =>
  values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
export default function RackRequisition({
  d,
  notify,
  onEntry,
  onQcEntry,
  disabled = false,
  qcSavedVersion = 0,
  exam = false,
  canStart = true,
  calibrationNeeds,
  autoCalibration = false,
  combined = false,
  onCombinedEntry,
  onGuide,
}: {
  d: Pick<Daily, "rack" | "setRack">;
  notify: (s: string) => void;
  onEntry?: (
    type: string,
    selection: RackSelection,
    category: "calibration" | "qc" | "sample",
  ) => void | boolean | Promise<boolean>;
  onQcEntry?: (data: {
    Serum: string[];
    Urine: string[];
  }) => boolean | Promise<boolean>;
  disabled?: boolean;
  qcSavedVersion?: number;
  exam?: boolean;
  canStart?: boolean;
  calibrationNeeds?: Pick<RackSelection, "rb" | "cal">;
  autoCalibration?: boolean;
  combined?: boolean;
  onCombinedEntry?: (
    selection: RackSelection,
    type: string,
  ) => boolean | Promise<boolean>;
  onGuide?: (hint: { target: string; text: string }) => void;
}) {
  const [tab, setTab] = useState("Sample"),
    [type, setType] = useState("Serum"),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<RackSelection>(d.rack.Serum),
    [profile, setProfile] = useState(false),
    [profileTests, setProfileTests] = useState<string[]>([]),
    [sub, setSub] = useState("Test Requisition");
  const [qcDrafts, setQcDrafts] = useState({
    Serum: [...d.rack.Serum.qc],
    Urine: [...d.rack.Urine.qc],
  });
  const [saving, setSaving] = useState(false);
  const awaiting = useRef(false);
  const awaitingVersion = useRef(qcSavedVersion);
  const locked = disabled || saving;
  useEffect(() => {
    if (
      awaiting.current &&
      qcSavedVersion > awaitingVersion.current &&
      !disabled &&
      ["Serum", "Urine"].every(
        (t) =>
          JSON.stringify(d.rack[t].qc) ===
          JSON.stringify(qcDrafts[t as "Serum" | "Urine"]),
      )
    ) {
      awaiting.current = false;
      setEditing(false);
    }
  }, [d.rack, disabled, qcDrafts, qcSavedVersion]);
  const autoSelect = (selection: RackSelection): RackSelection =>
    tab === "Calibration" &&
    type === "Serum" &&
    autoCalibration &&
    calibrationNeeds
      ? {
          ...selection,
          rb: [...new Set([...selection.rb, ...calibrationNeeds.rb])],
          cal: [...new Set([...selection.cal, ...calibrationNeeds.cal])],
        }
      : selection;
  const current = editing
    ? tab === "QC"
      ? { ...d.rack[type], qc: qcDrafts[type as "Serum" | "Urine"] }
      : draft
    : autoSelect(d.rack[type]);
  function updateDraft(update: (v: RackSelection) => RackSelection) {
    if (tab === "QC")
      setQcDrafts((v) => ({
        ...v,
        [type]: update({ ...d.rack[type], qc: v[type as "Serum" | "Urine"] })
          .qc,
      }));
    else setDraft(update);
  }
  const key = tab === "QC" ? "qc" : "sample";
  function switchTab(n: string) {
    if (editing && !combined) {
      notify("請先 Entry 儲存，或 Exit 放棄本次編輯。");
      return;
    }
    setTab(n);
  }
  function select(id: string, k: keyof RackSelection) {
    updateDraft((v) => ({ ...v, [k]: toggle(v[k], id) }));
  }
  async function entry() {
    if (locked) return;
    if (!canStart) {
      notify("請先完成其他全部日保養項目，再進行 Rack Requisition。");
      return;
    }
    setSaving(true);
    try {
      let success: boolean | void = true;
      if (combined && onCombinedEntry)
        success = await onCombinedEntry(
          { ...draft, qc: [...qcDrafts.Serum] },
          type,
        );
      else if (tab === "QC") {
        awaiting.current = true;
        awaitingVersion.current = qcSavedVersion;
        if (onQcEntry) success = await onQcEntry(qcDrafts);
        else
          d.setRack((v) => ({
            ...v,
            Serum: { ...v.Serum, qc: [...qcDrafts.Serum] },
            Urine: { ...v.Urine, qc: [...qcDrafts.Urine] },
          }));
      } else if (onEntry)
        success = await onEntry(
          type,
          draft,
          tab === "Calibration" ? "calibration" : "sample",
        );
      else d.setRack((v) => ({ ...v, [type]: draft }));
      if (success === false) {
        notify("保存失敗，兩類草稿已保留，可重試。");
        return;
      }
      awaiting.current = false;
      setEditing(false);
      notify(
        `${tab === "QC" ? "Serum／Urine" : type} ${tab} 已 Entry 儲存選項；尚未執行量測。`,
      );
    } catch {
      notify("保存失敗，草稿已保留。");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!combined || !onGuide) return;
    let hint = { target: "rr-start", text: "按 Start Entry 開始同批登記" };
    if (type !== "Serum")
      hint = editing
        ? { target: "rr-exit", text: "先Exit，再選Serum登記UIBC" }
        : { target: "rr-type", text: "選取Serum類別" };
    else if (editing) {
      if (!draft.rb.includes("27.UIBC") || !draft.cal.includes("27.UIBC"))
        hint =
          tab !== "Calibration"
            ? { target: "rr-tab-Calibration", text: "切換 Calibration" }
            : !draft.rb.includes("27.UIBC")
              ? { target: "rr-rb-27.UIBC", text: "選取 27.UIBC 的 RB" }
              : { target: "rr-cal-27.UIBC", text: "選取 27.UIBC 的 Cal." };
      else if (!qcDrafts.Serum.includes("27.UIBC"))
        hint =
          tab !== "QC"
            ? { target: "rr-tab-QC", text: "切換 QC，保留校正草稿" }
            : { target: "rr-qc-27.UIBC", text: "選取 QC 的 27.UIBC" };
      else
        hint = { target: "rr-entry", text: "按 Entry，一次保存 RB、CALI、QC" };
    }
    onGuide(hint);
  }, [combined, editing, tab, draft, qcDrafts, onGuide, type]);
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
          <button
            data-guide={`rr-tab-${n}`}
            key={n}
            aria-pressed={tab === n}
            onClick={() => switchTab(n)}
          >
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
      <section
        className={`rack-page ${editing ? "rack-editing" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && profile) {
            e.preventDefault();
            e.stopPropagation();
            setProfile(false);
          }
        }}
      >
        <div className="rack-controls">
          <label>
            Type{" "}
            <select
              data-guide="rr-type"
              aria-label="Rack Type"
              value={type}
              disabled={
                locked || (combined && editing) || (editing && tab !== "QC")
              }
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
                disabled={locked || !editing}
                aria-label="Sample ID"
                placeholder="教學樣本"
              />
            </label>
            <span>Group of Tests　1.ROUTINE</span>
          </div>
        )}
        <div className="rack-controls">
          <button
            disabled={locked || !editing || tab !== "QC"}
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
        {tab === "Calibration" &&
          calibrationNeeds &&
          calibrationNeeds.rb.length > 0 && (
            <p className="rack-requirements" role="note">
              Reagent Check 結果 · RB：{calibrationNeeds.rb.join("、")}；Cali：
              {calibrationNeeds.cal.join("、")}
            </p>
          )}
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
                            editing={editing && !locked}
                            rb={current.rb.includes(id)}
                            cal={current.cal.includes(id)}
                            select={select}
                            expiredRb={
                              type === "Serum" &&
                              !!calibrationNeeds?.rb.includes(id)
                            }
                            expiredCal={
                              type === "Serum" &&
                              !!calibrationNeeds?.cal.includes(id)
                            }
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
                    disabled={locked || !editing}
                    aria-pressed={current[key].includes(id)}
                    data-guide={`rr-qc-${id}`}
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
              data-guide="rr-exit"
              disabled={locked}
              onClick={() => {
                awaiting.current = false;
                setEditing(false);
                setProfile(false);
                notify("已放棄未 Entry 的變更。");
              }}
            >
              Exit
            </button>
            <button
              data-guide="rr-entry"
              disabled={locked || !canStart}
              onClick={entry}
            >
              Entry
            </button>
            <button onClick={() => notify("請直接在表格逐項選取。")}>
              Individual Requisition
            </button>
            {tab !== "Calibration" && (
              <>
                <button
                  disabled={locked}
                  onClick={() =>
                    updateDraft((v) => ({ ...v, [key]: [...tests] }))
                  }
                >
                  Select All Tests
                </button>
                <button
                  disabled={locked}
                  onClick={() => updateDraft((v) => ({ ...v, [key]: [] }))}
                >
                  Deselect All Tests
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              data-guide="rr-start"
              disabled={locked || !canStart}
              onClick={() => {
                setDraft(structuredClone(autoSelect(d.rack[type])));
                setQcDrafts({
                  Serum: [...d.rack.Serum.qc],
                  Urine: [...d.rack.Urine.qc],
                });
                setEditing(true);
              }}
            >
              Start Entry
            </button>
            {!canStart && (
              <span role="status">
                其他全部日保養項目完成後，才可開始 Rack Requisition。
              </span>
            )}
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
            {!exam && (
              <p>
                可複選群組；OK 套用至編輯中的清單，Entry 才儲存申請。ITA 與
                URINE TOXO 本次不使用。
              </p>
            )}
            <footer>
              <button
                onClick={() => {
                  updateDraft((v) => ({ ...v, qc: profileTests }));
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
  expiredRb = false,
  expiredCal = false,
}: {
  id: string;
  editing: boolean;
  rb: boolean;
  cal: boolean;
  expiredRb?: boolean;
  expiredCal?: boolean;
  select: (id: string, k: keyof RackSelection) => void;
}) {
  return (
    <>
      <td>{id}</td>
      <td>
        <button
          data-guide={`rr-rb-${id}`}
          aria-label={`${id} RB`}
          aria-pressed={rb}
          disabled={!editing}
          className={`${rb ? "rb-selected" : ""} ${editing && expiredRb && !rb ? "rack-required" : ""}`}
          title={expiredRb ? "本次需登記 RB" : undefined}
          onClick={() => select(id, "rb")}
        >
          {rb ? "✓" : ""}
        </button>
      </td>
      <td>
        <button
          data-guide={`rr-cal-${id}`}
          aria-label={`${id} Cal.`}
          aria-pressed={cal}
          disabled={!editing}
          className={`${cal ? "cal-selected" : ""} ${editing && expiredCal && !cal ? "rack-required" : ""}`}
          title={expiredCal ? "本次需登記 Calibration" : undefined}
          onClick={() => select(id, "cal")}
        >
          {cal ? "✓" : ""}
        </button>
      </td>
    </>
  );
}
