import { useState } from "react";
import "./daily.css";
import { emptyRack } from "./requisitionData";

export const probes = ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"];
const cupNames = [
  "S-H · Serum High",
  "S-L · Serum Low",
  "U-H · Urine High",
  "U-L · Urine Low",
];
const stepNames = [
  "登記溫度",
  "New Index",
  "擦拭 6 支探針",
  "排水與攪拌檢查",
  "ISE Cleaning",
  "Total Prime × 3",
  "ISE 校正與結果檢查",
  "試劑更換與 All positions",
  "Rack Requisition · Calibration／Serum QC／Urine QC",
];
const initialReagents = () => [
  {
    name: "ALT",
    side: "R1",
    remaining: 0,
    need: 100,
    reason: "用完",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "ALT",
    side: "R2",
    remaining: 25,
    need: 100,
    reason: "量不足",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "AST",
    side: "R1",
    remaining: 180,
    need: 100,
    reason: "即將到期",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "AST",
    side: "R2",
    remaining: 180,
    need: 100,
    reason: "足夠",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "GLU",
    side: "R1",
    remaining: 220,
    need: 120,
    reason: "足夠",
    reviewed: false,
    replaced: false,
    note: "",
  },
];
export function useDailyTraining() {
  const [rack, setRack] = useState(emptyRack);
  const [active, setActive] = useState(false);
  const [temp, setTemp] = useState({ bath: "", coolant: "", saved: false });
  const [editing, setEditing] = useState(false),
    [index, setIndex] = useState("");
  const [mode, setMode] = useState("");
  const [wiped, setWiped] = useState<string[]>([]),
    [drains, setDrains] = useState<Record<string, string>>({}),
    [mix, setMix] = useState<Record<string, string>>({});
  const [cleanCup, setCleanCup] = useState<
    "empty" | "full" | "used" | "discarded"
  >("empty");
  const [cleaned, setCleaned] = useState(false),
    [prime, setPrime] = useState(0);
  const [drops, setDrops] = useState(["", "", "", ""]);
  const [cal, setCal] = useState({
    serum: false,
    urine: false,
    checked: false,
  });
  const [reagents, setReagents] = useState(initialReagents),
    [reagentChecked, setReagentChecked] = useState(false);
  const inspected =
    probes.every((p) => drains[p] === "正常") &&
    ["左側", "右側"].every((p) => mix[p] === "正常");
  const reagentReady = reagents.every(
    (r) =>
      r.reviewed &&
      r.note.trim() &&
      (r.reason === "足夠" || r.replaced) &&
      r.remaining >= r.need,
  );
  const completed = [
    temp.saved,
    !!index,
    wiped.length === 6,
    inspected,
    cleaned,
    prime === 3,
    cal.serum && cal.urine && cal.checked,
    reagentChecked,
    reagentChecked &&
      rack.Serum.cal.length > 0 &&
      rack.Serum.qc.length > 0 &&
      rack.Urine.qc.length > 0,
  ];
  const stage = completed.findIndex((v) => !v);
  function reset() {
    setRack(emptyRack());
    setActive(true);
    setTemp({ bath: "", coolant: "", saved: false });
    setEditing(false);
    setIndex("");
    setMode("");
    setWiped([]);
    setDrains({});
    setMix({});
    setCleanCup("empty");
    setCleaned(false);
    setPrime(0);
    setDrops(["", "", "", ""]);
    setCal({ serum: false, urine: false, checked: false });
    setReagents(initialReagents());
    setReagentChecked(false);
  }
  function action(name: string, enabled: boolean): string | null {
    if (
      ![
        "Cleaning Probe",
        "Inspect Probe & Mixing Bar",
        "Cleaning",
        "Total Prime",
        "Cleaning (Enhanced)",
      ].includes(name)
    )
      return null;
    if (name === "Cleaning (Enhanced)")
      return "已建立 Cleaning (Enhanced) 入口；本次日保養使用 Cleaning，增強清洗程序待補。";
    if (!active) return "請先由「日保養」開始本次練習。";
    if (name !== "Cleaning" && !enabled)
      return "請先勾選本頁的 Maintenance box。";
    if (name === "Cleaning Probe") {
      if (stage < 2) return "請先登記溫度並建立 New Index。";
      setMode("wipe");
      return "已進入 Cleaning Probe 教學操作，請逐支以酒精棉擦拭。";
    }
    if (name === "Inspect Probe & Mixing Bar") {
      if (wiped.length !== 6) return "請先完成 6 支探針擦拭。";
      setMode("inspect");
      return "請逐支確認探針排水，並檢查左右攪拌單元。";
    }
    if (name === "Cleaning") {
      if (!inspected) return "請先完成探針排水及攪拌檢查。";
      if (cleaned) return "本次 Cleaning 已完成。";
      if (cleanCup !== "full")
        return "請先在 U-L／CLEAN 位置放置裝滿 Cleaning Solution 的杯子。";
      setCleaned(true);
      setCleanCup("used");
      return "Cleaning 教學循環已完成；接著勾選 ISE Maintenance，執行三次 Total Prime。";
    }
    if (!cleaned) return "請先完成 ISE Cleaning。";
    if (prime === 3) return "本次 Total Prime 已完成 3／3 次。";
    setPrime((n) => Math.min(3, n + 1));
    return `Total Prime 教學循環完成 ${prime + 1}／3 次。`;
  }
  return {
    active,
    temp,
    setTemp,
    editing,
    setEditing,
    index,
    setIndex,
    mode,
    wiped,
    setWiped,
    drains,
    setDrains,
    mix,
    setMix,
    cleanCup,
    setCleanCup,
    cleaned,
    prime,
    drops,
    setDrops,
    cal,
    setCal,
    reagents,
    rack,
    setRack,
    setReagents,
    reagentReady,
    reagentChecked,
    setReagentChecked,
    completed,
    stage,
    reset,
    action,
  };
}
export type Daily = ReturnType<typeof useDailyTraining>;
export function DailyOverview({
  d,
  go,
}: {
  d: Daily;
  go: (p: string) => void;
}) {
  const routes = [
    "Analyzer Status",
    "Start Condition",
    "Analyzer Maintenance",
    "Analyzer Maintenance",
    "ISE Maintenance",
    "ISE Maintenance",
    "ISE Maintenance",
    "Reagent Management",
    "Rack Requisition",
  ];
  return (
    <section className="daily-page">
      <h2>日保養練習</h2>
      <p>
        依本次提供程序操作。進度保留至重新整理；第 9 步需 Entry 儲存
        Calibration、Serum QC 與 Urine QC。申請登記不代表已完成量測。
      </p>
      <button onClick={d.reset}>
        {d.active ? "重設並開始新一輪日保養" : "開始日保養"}
      </button>
      <ol className="daily-steps">
        {stepNames.map((s, i) => (
          <li key={s}>
            <span>
              {d.completed[i]
                ? "✓ 已完成"
                : d.stage === i
                  ? "目前步驟"
                  : "待完成"}
            </span>
            <button disabled={!d.active} onClick={() => go(routes[i])}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function TemperatureRecord({ d }: { d: Daily }) {
  return (
    <fieldset className="daily-field">
      <legend>登記本次溫度</legend>
      {(["bath", "coolant"] as const).map((k) => (
        <label key={k}>
          {k === "bath" ? "Bath Temp. 登記" : "Coolant Temp. 登記"}
          <input
            type="number"
            step="0.1"
            value={d.temp[k]}
            disabled={!!d.index}
            onChange={(e) =>
              d.setTemp({ ...d.temp, [k]: e.target.value, saved: false })
            }
          />
        </label>
      ))}
      <button
        disabled={
          !d.active ||
          d.temp.bath.trim() === "" ||
          d.temp.coolant.trim() === "" ||
          !Number.isFinite(Number(d.temp.bath)) ||
          !Number.isFinite(Number(d.temp.coolant))
        }
        onClick={() => d.setTemp({ ...d.temp, saved: true })}
      >
        儲存溫度紀錄
      </button>
      <p>
        {d.temp.saved
          ? `已登記：Bath ${d.temp.bath} °C／Coolant ${d.temp.coolant} °C`
          : "請閱讀示意讀值後登記；不自動判定合格。"}
      </p>
    </fieldset>
  );
}
export function StartCondition({ d }: { d: Daily }) {
  return (
    <section className="daily-page">
      <h2>Start Condition</h2>
      <div className="daily-form">
        <label>
          Index
          <input readOnly value={d.index || "尚未建立本次 Index"} />
        </label>
        <button
          disabled={!d.active || !d.temp.saved || !d.editing || !!d.index}
          onClick={() => {
            d.setIndex(new Date().toLocaleString("zh-TW"));
            d.setEditing(false);
          }}
        >
          New Index
        </button>
        <label>
          Group of Tests
          <select disabled>
            <option>1.ROUTINE</option>
          </select>
        </label>
        <label>
          Operator Name
          <input readOnly value="MAINTENANCE" />
        </label>
      </div>
      <table className="daily-table">
        <tbody>
          {["Routine", "Emergency", "Repeat", "Repeat Emergency"].map(
            (v, i) => (
              <tr key={v}>
                <th>{v}</th>
                <td>{i === 0 ? "0001" : i === 1 ? "001" : "—"}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p>
        {!d.temp.saved
          ? "請先登記溫度，再按 Edit → New Index。"
          : d.index
            ? "已建立本次練習 Index。"
            : "按 Edit 後選 New Index。"}
      </p>
      <button
        disabled={!d.active || !d.temp.saved || !!d.index}
        onClick={() => d.setEditing(true)}
      >
        Edit
      </button>
    </section>
  );
}
export function ProbePractice({ d }: { d: Daily }) {
  if (!d.active || !d.mode) return null;
  return (
    <section className="daily-practice">
      <h3>
        {d.mode === "wipe"
          ? "酒精棉擦拭 · 6 支探針"
          : "Inspect Probe & Mixing Bar"}
      </h3>
      <p>
        此區是實體操作的教學紀錄；未連接實機。
        {d.mode === "wipe"
          ? `已擦拭 ${d.wiped.length}／6 支`
          : "逐項選擇檢查結果，異常項目不會計為完成。"}
      </p>
      <div className="daily-probes">
        {probes.map((p) => (
          <div key={p}>
            <i className="daily-probe" />
            <b>{p}</b>
            {d.mode === "wipe" ? (
              <button
                disabled={d.wiped.includes(p)}
                onClick={() => d.setWiped((v) => [...v, p])}
              >
                {d.wiped.includes(p) ? "已擦拭" : `酒精棉擦拭 ${p}`}
              </button>
            ) : (
              <label>
                {p} 排水
                <select
                  value={d.drains[p] || ""}
                  aria-label={`${p} 排水`}
                  disabled={d.cleaned}
                  onChange={(e) =>
                    d.setDrains({ ...d.drains, [p]: e.target.value })
                  }
                >
                  <option value="">未檢查</option>
                  <option>正常</option>
                  <option>異常</option>
                </select>
              </label>
            )}
          </div>
        ))}
      </div>
      {d.mode === "inspect" && (
        <div className="daily-inline">
          {["左側", "右側"].map((p) => (
            <label key={p}>
              {p} mixing bars
              <select
                value={d.mix[p] || ""}
                aria-label={`${p} mixing bars`}
                disabled={d.cleaned}
                onChange={(e) => d.setMix({ ...d.mix, [p]: e.target.value })}
              >
                <option value="">未檢查</option>
                <option>正常</option>
                <option>異常</option>
              </select>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
export function IsePreparation({ d }: { d: Daily }) {
  return (
    <section className="daily-practice">
      <h3>ISE 試劑杯準備</h3>
      <p>
        U-L／CLEAN：
        {
          {
            empty: "空槽",
            full: "裝滿 Cleaning Solution",
            used: "已使用 CLEAN 杯",
            discarded: "已取出並丟棄 CLEAN 杯",
          }[d.cleanCup]
        }{" "}
        · Total Prime {d.prime}／3
      </p>
      <button
        disabled={!d.active || d.cleanCup !== "empty"}
        onClick={() => d.setCleanCup("full")}
      >
        在 CLEAN 放置裝滿的 Cleaning Solution
      </button>
      <button
        disabled={d.cleanCup !== "used" || d.prime !== 3}
        onClick={() => d.setCleanCup("discarded")}
      >
        取出並丟棄 CLEAN 杯
      </button>
      <div className="daily-cups">
        {cupNames.map((n, i) => (
          <label key={n}>
            <span className="daily-cup">{d.drops[i] || "0"} 滴</span>
            {n}
            <input
              aria-label={`${n} 滴數`}
              type="number"
              min="0"
              step="1"
              disabled={
                d.cleanCup !== "discarded" || d.cal.serum || d.cal.urine
              }
              value={d.drops[i]}
              onChange={(e) =>
                d.setDrops(
                  d.drops.map((v, j) => (j === i ? e.target.value : v)),
                )
              }
            />
          </label>
        ))}
      </div>
      <p>
        取出並丟棄 CLEAN 杯後，於上述四個杯位放入對應校正液，每杯至少 10
        滴。填入滴數表示本次放置紀錄。
      </p>
    </section>
  );
}
export function Calibration({
  d,
  notify,
}: {
  d: Daily;
  notify: (s: string) => void;
}) {
  const ready =
    d.active &&
    d.prime === 3 &&
    d.cleanCup === "discarded" &&
    d.drops.every((n) => Number.isInteger(Number(n)) && Number(n) >= 10);
  const serum = [54.6, 53.8, -52.7, 0.985, 1.033, 0.983],
    urine = [56.2, 58, -55.6, 0.964, 1.059, 0.979];
  function start(s: boolean, u: boolean) {
    if (!ready) {
      notify(
        "請先完成三次 Total Prime、丟棄 CLEAN 杯，並放置四杯各至少 10 滴的校正液。",
      );
      return;
    }
    d.setCal({
      ...d.cal,
      serum: d.cal.serum || s,
      urine: d.cal.urine || u,
      checked: false,
    });
    notify(
      "校正教學循環結束，請檢查結果。下列數字為提供照片的示例，非本次量測。",
    );
  }
  return (
    <section className="daily-page">
      <div className="daily-inline">
        <b>
          ISE Status：{d.cal.serum || d.cal.urine ? "教學循環完成" : "STANDBY"}
        </b>
        <span>Electrode Status　Na　K　Cl</span>
        <span>Reagent Status　REF　MID　Buffer</span>
      </div>
      <IsePreparation d={d} />
      <h3>Result · 照片示例數值</h3>
      <div className="daily-scroll">
        <table className="daily-table">
          <thead>
            <tr>
              <th rowSpan={3}>Result</th>
              <th colSpan={6}>Serum</th>
              <th colSpan={6}>Urine</th>
            </tr>
            <tr>
              {[0, 1].map((n) => (
                <FragmentHeaders key={n} />
              ))}
            </tr>
            <tr>
              {Array.from({ length: 4 }, (_, i) =>
                ["Na", "K", "Cl"].map((v) => <th key={`${i}${v}`}>{v}</th>),
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Last Result（示例）</th>
              {[...serum, ...urine].map((n, i) => (
                <td key={i}>
                  {(i < 6 ? d.cal.serum : d.cal.urine)
                    ? n.toFixed(i % 6 > 2 ? 3 : 1)
                    : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th>Normal Range · High</th>
              {[68, 68, -38, 1.2, 1.2, 1.2, 68, 68, -38, 1.2, 1.2, 1.2].map(
                (n, i) => (
                  <td key={i}>{n}</td>
                ),
              )}
            </tr>
            <tr>
              <th>Normal Range · Low</th>
              {[38, 38, -68, 0.8, 0.8, 0.8, 38, 38, -68, 0.8, 0.8, 0.8].map(
                (n, i) => (
                  <td key={i}>{n}</td>
                ),
              )}
            </tr>
          </tbody>
        </table>
      </div>
      <small>Normal Range 依照片重現，未用於實機放行判定。</small>
      <div className="daily-inline">
        {["Serum Start", "Urine Start", "Serum/Urine Start"].map((n, i) => (
          <button key={n} onClick={() => start(i !== 1, i !== 0)}>
            {n}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            disabled={!d.cal.serum || !d.cal.urine}
            checked={d.cal.checked}
            onChange={(e) => d.setCal({ ...d.cal, checked: e.target.checked })}
          />
          已檢查 Serum／Urine 數值
        </label>
      </div>
    </section>
  );
}
function FragmentHeaders() {
  return (
    <>
      <th colSpan={3}>Slope</th>
      <th colSpan={3}>MID Solution Factor</th>
    </>
  );
}
