import {
  initialDailyTasks,
  tasksReadiness,
  applyDailyTask,
  recordSupply,
  dailySteps,
  supplyIds,
  type DailyTaskCommand,
} from "../shared/dailyTasks";
import {
  initialBottles,
  operateBottle,
  slotById,
  type BottleStates,
} from "./detergents";
import {
  examReagents,
  calibrationNeeds,
  canHandleBottle,
  canRunIseProbeDiag,
  validProbeDiag,
  canRunIseProgram,
} from "../shared/dailyScenario";
import { useEffect, useState } from "react";
import {
  initialPreparation,
  preparationGate,
  preparationProgress,
  applyPreparation,
  syncPreparation,
  type PreparationAction,
} from "../shared/preparation";
import "./daily.css";
import { emptyRack } from "./requisitionData";
import { dailyProbes } from "../shared/maintenance";
import {
  initialInstrument,
  canWipe,
  canHandleCups,
  canRunIse,
} from "../shared/dailyScenario";
import { dailyReadiness } from "../shared/dailyRules";

export const probes = dailyProbes;
const cupNames = [
  "S-H · Serum High",
  "S-L · Serum Low",
  "U-H · Urine High",
  "U-L · Urine Low",
];
export function useDailyTraining(
  bottles: BottleStates,
  setBottles: (b: BottleStates) => void,
) {
  const [tasks, setTasks] = useState(initialDailyTasks);
  const extra = tasksReadiness(tasks, bottles);
  const [instrument, setInstrument] = useState(initialInstrument);
  const [rack, setRack] = useState(emptyRack);
  const [rawPreparation, setPreparation] = useState(initialPreparation);
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
  const [reagents, setReagents] = useState(examReagents),
    [reagentChecked, setReagentChecked] = useState(false);
  const [iseDiag, setIseDiag] = useState({
    unit: true,
    cuvette: "內部",
    count: 3,
    saved: false,
    ran: false,
  });
  const iseDrainValid = iseDiag.ran && drains.ISE === "正常";
  const needs = calibrationNeeds(reagents);
  const reagentReady = reagents.every(
    (r) => r.replaced && r.remaining >= r.need,
  );
  function replaceReagent(id: string) {
    setReagents((old) =>
      old.map((r) =>
        r.id === id && !r.replaced
          ? {
              ...r,
              replaced: true,
              remaining: 500,
              rb: "unchecked" as const,
              cal: r.cal === "na" ? ("na" as const) : ("unchecked" as const),
            }
          : r,
      ),
    );
    setReagentChecked(false);
    setRack((old) => ({ ...old, Serum: { ...old.Serum, rb: [], cal: [] } }));
  }
  function checkReagents() {
    if (
      !active ||
      !temp.saved ||
      !index ||
      !extra.suppliesReady ||
      !reagentReady
    )
      return "請先完成溫度、New Index、十二瓶洗滌液及十一瓶必換試劑（包含即將到期的 AMY）。";
    setReagents((old) =>
      old.map((r) => ({
        ...r,
        rb: "expired" as const,
        cal: r.cal === "na" ? ("na" as const) : ("expired" as const),
      })),
    );
    setReagentChecked(true);
    return "All positions 已完成。RB：ALT、AST、HDL、LDL、CRE、AMY；Cali：HDL、LDL、CRE。";
  }
  function saveIseDiag(config: {
    unit: boolean;
    cuvette: string;
    count: number;
  }) {
    setIseDiag({ ...config, saved: true, ran: false });
    return "DIAG 設定已儲存。";
  }
  function runIseDiag() {
    if (!active || !iseDiag.saved || !validProbeDiag(iseDiag))
      return "請先儲存有效的 DIAG 設定（Unit 1，次數 3–10）。";
    if (!canRunIseProbeDiag(instrument))
      return "請勾選 ISE Maintenance、關閉 module 鐵蓋，並確認 ISE 未運轉。";
    setIseDiag((v) => ({ ...v, ran: true }));
    setDrains((v) => ({ ...v, ISE: "" }));
    return "DIAG ISE 已執行，請觀察並記錄排水結果。";
  }
  function recordIseDrain(value: string) {
    if (!active || !iseDiag.ran || !canRunIseProbeDiag(instrument))
      return "請先完成有效 DIAG ISE，再記錄排水。";
    setDrains((v) => ({ ...v, ISE: value }));
    return value === "正常"
      ? "ISE 正常排水已記錄。"
      : "ISE 排水異常，排除後須重新確認。";
  }
  const rules = dailyReadiness({
    analyzerMaintenance: instrument.analyzerMaintenance,
    iseDrainRequired: true,
    iseDrainValid,
    temp,
    index,
    wiped,
    drains,
    mix,
    cleaned,
    prime,
    cal,
    drops,
    cleanCup,
    reagentReady,
    reagentChecked,
  });
  const rackReady =
    rules.rackReady &&
    extra.suppliesReady &&
    extra.syringesReady &&
    extra.iseReady;
  const maintenanceCompleted = [
    ...rules.beforeRack.slice(0, 7),
    extra.suppliesReady,
    rules.beforeRack[7],
    extra.syringesReady,
    extra.iseReady,
    rackReady &&
      needs.rb.length > 0 &&
      needs.rb.every((id) => rack.Serum.rb.includes(id)) &&
      needs.cal.every((id) => rack.Serum.cal.includes(id)) &&
      rack.Serum.qc.length > 0 &&
      rack.Urine.qc.length > 0,
  ];
  const loadingGate = preparationGate(
    maintenanceCompleted.every(Boolean),
    rack,
    index,
  );
  const preparation = syncPreparation(
    structuredClone(rawPreparation),
    loadingGate,
  );
  const loadingProgress = preparationProgress(preparation, loadingGate);
  useEffect(() => {
    setPreparation((s) => syncPreparation(structuredClone(s), loadingGate));
  }, [loadingGate.ready, loadingGate.token]);
  function prepare(command: PreparationAction) {
    const result = applyPreparation(preparation, command, loadingGate);
    setPreparation(result.state);
    return result.error;
  }
  const completed = [...maintenanceCompleted, loadingProgress.done];
  const stage = completed.findIndex((v) => !v);
  function reset() {
    setPreparation(initialPreparation());
    setTasks(initialDailyTasks());
    setBottles(initialBottles());
    setInstrument(initialInstrument());
    setRack(emptyRack());
    setActive(true);
    setTemp({ bath: "", coolant: "", saved: false });
    setEditing(false);
    setIndex("");
    setMode("");
    setIseDiag({
      unit: true,
      cuvette: "內部",
      count: 3,
      saved: false,
      ran: false,
    });
    setWiped([]);
    setDrains({});
    setMix({});
    setCleanCup("empty");
    setCleaned(false);
    setPrime(0);
    setDrops(["", "", "", ""]);
    setCal({ serum: false, urine: false, checked: false });
    setReagents(examReagents());
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
    if (["Cleaning Probe", "Inspect Probe & Mixing Bar"].includes(name) && !enabled)
      return "請先勾選本頁的 Maintenance box。";
    if (name === "Cleaning Probe") {
      if (!canWipe(instrument)) return "請先開啟分析單元主蓋。";
      setMode("wipe");
      return "已進入 Cleaning Probe 教學操作，請逐支以酒精棉擦拭。";
    }
    if (name === "Inspect Probe & Mixing Bar") {
      if (!rules.canInspect) return "請先完成 6 支探針擦拭。";
      setMode("inspect");
      return "請逐支確認探針排水，並檢查左右攪拌單元。";
    }
    if (name === "Cleaning") {
      if (!canRunIseProgram(instrument, "cleaning"))
        return "請關閉 ISE module 鐵蓋並取消勾選 ISE Maintenance。";
      if (cleaned) return "本次 Cleaning 已完成。";
      if (cleanCup !== "full")
        return "請先在 U-L／CLEAN 位置放置裝滿 Cleaning Solution 的杯子。";
      setCleaned(true);
      setCleanCup("used");
      return "Cleaning 教學循環已完成；接著勾選 ISE Maintenance，執行三次 Total Prime。";
    }
    if (!canRunIse(instrument))
      return "請關閉 ISE module 鐵蓋並勾選 ISE Maintenance。";
    if (!extra.iseReady)
      return "請先檢查三瓶 ISE 試劑，並更換不足的 Standard 與 Buffer。";
    if (!rules.canPrime) return "請先完成 ISE Cleaning。";
    if (prime === 3) return "本次 Total Prime 已完成 3／3 次。";
    setPrime((n) => Math.min(3, n + 1));
    return `Total Prime 教學循環完成 ${prime + 1}／3 次。`;
  }
  function taskAction(command: DailyTaskCommand) {
    if (!active) return "請先開始日保養練習。";
    const next = structuredClone(tasks);
    const error = applyDailyTask(next, command, instrument);
    if (error) return error;
    setTasks(next);
    if (command.type === "ise-reagent" && command.value === "replace") {
      setPrime(0);
      setCal({ serum: false, urine: false, checked: false });
    }
    return "操作已記錄於本次練習。";
  }
  function supplyChanged(id: string, nextBottles: BottleStates) {
    setBottles(nextBottles);
    if (supplyIds.includes(id)) {
      setTasks((old) => {
        const next = structuredClone(old);
        recordSupply(next, id);
        return next;
      });
      setReagentChecked(false);
      setRack((old) => ({ ...old, Serum: { ...old.Serum, rb: [], cal: [] } }));
    }
  }
  function refill(id: string) {
    if (!active) return "請先開始日保養練習。";
    if (!canHandleBottle(instrument, slotById[id].module))
      return "請先開啟對應上蓋。";
    try {
      supplyChanged(
        id,
        operateBottle(bottles, id, "daily", { kind: "refill" }),
      );
      return "已補充至 100% 示意液量。";
    } catch (e) {
      return (e as Error).message;
    }
  }
  return {
    preparation,
    loadingGate,
    loadingProgress,
    prepare,
    iseDiag,
    iseDrainValid,
    saveIseDiag,
    runIseDiag,
    recordIseDrain,
    calibrationNeeds: needs,
    replaceReagent,
    checkReagents,
    tasks,
    taskAction,
    supplyChanged,
    refill,
    bottles,
    ...extra,
    active,
    instrument,
    setInstrument,
    cupAccessible: canHandleCups(instrument),
    wipeAccessible: canWipe(instrument) && instrument.analyzerMaintenance,
    temp,
    setTemp,
    editing,
    setEditing,
    index,
    setIndex,
    mode: instrument.analyzerMaintenance ? mode : "",
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
    ...rules,
    canInspect: rules.canInspect && instrument.analyzerMaintenance,
    rackReady,
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
  return (
    <section className="daily-page">
      <h2>日保養練習</h2>
      <p>
        清單編號供核對，非固定操作順序。擦拭後才檢查排水；Cleaning 後才
        Prime；Cleaning 與三次 Prime
        完成後才校正。試劑可隨時補充；其他項目全數完成後才可進行 Rack
        Requisition。進度保留至重新整理；Rack 登記需 Entry 儲存
        Calibration、Serum QC 與 Urine QC，完成後開放第十三組備料上機。
        申請登記與上機操作均不代表已完成量測。
      </p>
      <button onClick={d.reset}>
        {d.active ? "重設並開始新一輪日保養" : "開始日保養"}
      </button>
      <ol className="daily-steps">
        {dailySteps.map(([s, route], i) => (
          <li key={s}>
            <span>
              {d.completed[i]
                ? "✓ 已完成"
                : d.stage === i
                  ? "目前步驟"
                  : "待完成"}
            </span>
            <button
              disabled={
                !d.active ||
                (route === "Rack Requisition" && !d.rackReady) ||
                (route === "校正與品管上機" && !d.loadingGate.ready)
              }
              onClick={() => go(route)}
            >
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
export function StartCondition({
  d,
  onEdit,
  onIndex,
  disabled = false,
}: {
  d: Pick<Daily, "active" | "editing" | "index" | "setIndex" | "setEditing">;
  onEdit?: () => void;
  onIndex?: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="daily-page">
      <h2>Start Condition</h2>
      <div className="daily-form">
        <label>
          Index
          <input readOnly value={d.index || "尚未建立本次 Index"} />
        </label>
        <button
          disabled={disabled || !d.active || !d.editing || !!d.index}
          onClick={() => {
            if (onIndex) {
              onIndex();
              return;
            }
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
        {d.index
          ? "已建立本次練習 Index。"
          : "按 Edit 後選 New Index；溫度可另行登記。"}
      </p>
      <button
        disabled={disabled || !d.active || !!d.index}
        onClick={() => (onEdit ? onEdit() : d.setEditing(true))}
      >
        Edit
      </button>
    </section>
  );
}
export function ProbePractice({
  d,
  onWipe,
  onDrain,
  onMix,
}: {
  d: Pick<
    Daily,
    | "active"
    | "mode"
    | "wiped"
    | "wipeAccessible"
    | "canInspect"
    | "drains"
    | "mix"
    | "setWiped"
    | "setDrains"
    | "setMix"
  >;
  onWipe?: (id: string) => void;
  onDrain?: (id: string, value: string) => void;
  onMix?: (id: string, value: string) => void;
}) {
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
                disabled={!d.wipeAccessible || d.wiped.includes(p)}
                onClick={() =>
                  onWipe ? onWipe(p) : d.setWiped((v) => [...v, p])
                }
              >
                {d.wiped.includes(p) ? "已擦拭" : `酒精棉擦拭 ${p}`}
              </button>
            ) : (
              <label>
                {p} 排水
                <select
                  value={d.drains[p] || ""}
                  aria-label={`${p} 排水`}
                  disabled={!d.canInspect}
                  onChange={(e) =>
                    onDrain
                      ? onDrain(p, e.target.value)
                      : d.setDrains({ ...d.drains, [p]: e.target.value })
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
                disabled={!d.canInspect}
                onChange={(e) =>
                  onMix
                    ? onMix(p, e.target.value)
                    : d.setMix({ ...d.mix, [p]: e.target.value })
                }
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
        disabled={
          !d.active ||
          !d.cupAccessible ||
          !["empty", "discarded"].includes(d.cleanCup)
        }
        onClick={() => d.setCleanCup("full")}
      >
        在 CLEAN 放置裝滿的 Cleaning Solution
      </button>
      <button
        disabled={!d.cupAccessible || !["full", "used"].includes(d.cleanCup)}
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
                !d.cupAccessible ||
                d.cleanCup !== "discarded" ||
                d.cal.serum ||
                d.cal.urine
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
  onStart,
  onReview,
  disabled = false,
}: {
  d: Pick<
    Daily,
    | "active"
    | "instrument"
    | "iseReady"
    | "canCalibrate"
    | "cleanCup"
    | "drops"
    | "cal"
    | "setCal"
  >;
  notify: (s: string) => void;
  onStart?: (serum: boolean, urine: boolean) => void;
  onReview?: () => void;
  disabled?: boolean;
}) {
  const ready =
    d.active &&
    canRunIse(d.instrument, true) &&
    d.iseReady &&
    d.canCalibrate &&
    d.cleanCup === "discarded" &&
    d.drops.every((n) => Number.isInteger(Number(n)) && Number(n) >= 10);
  const serum = [54.6, 53.8, -52.7, 0.985, 1.033, 0.983],
    urine = [56.2, 58, -55.6, 0.964, 1.059, 0.979];
  function start(s: boolean, u: boolean) {
    if (onStart) {
      onStart(s, u);
      return;
    }
    if (!ready) {
      notify(
        "請關閉 ISE Maintenance 及 module 鐵蓋，完成 Cleaning、三次 Prime、丟棄 CLEAN 杯，並放置四杯各至少 10 滴的校正液。",
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
      {d.instrument.iseMaintenance && (
        <p className="daily-interlock" role="status">
          請關閉 ISE Maintenance（取消勾選），再執行 Serum／Urine 校正。可在上方「儀器狀態」取消勾選。
        </p>
      )}
      <div className="daily-inline">
        {["Serum Start", "Urine Start", "Serum/Urine Start"].map((n, i) => (
          <button
            key={n}
            disabled={
              disabled || !canRunIseProgram(d.instrument, "calibration")
            }
            onClick={() => start(i !== 1, i !== 0)}
          >
            {n}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            disabled={disabled || !d.cal.serum || !d.cal.urine}
            checked={d.cal.checked}
            onChange={(e) =>
              onReview
                ? onReview()
                : d.setCal({ ...d.cal, checked: e.target.checked })
            }
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

export function DailyInstrumentControls({
  d,
  modes = true,
}: {
  d: Daily;
  modes?: boolean;
}) {
  return (
    <fieldset className="daily-inline daily-instrument">
      <legend>儀器狀態</legend>
      {(modes
        ? ([
            ["analyzerMaintenance", "Analyzer Maintenance"],
            ["iseMaintenance", "ISE Maintenance"],
          ] as const)
        : []
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={d.instrument[key]}
            onChange={(e) =>
              d.setInstrument((s) => ({ ...s, [key]: e.target.checked }))
            }
          />
          {label}
        </label>
      ))}
      {(
        [
          ["iseTop", "ISE 上蓋開啟"],
          ["iseModule", "ISE module 蓋開啟"],
          ["mainLid", "主蓋開啟"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={d.instrument[key]}
            onChange={(e) =>
              d.setInstrument((s) => ({ ...s, [key]: e.target.checked }))
            }
          />
          {label}
        </label>
      ))}
      <div className="cabinet-toggles">
        {(
          [
            ["frontSyringe", "front", "前方"],
            ["rearSyringe", "rear", "後方"],
          ] as const
        ).map(([key, id, label]) => (
          <button
            key={key}
            data-testid={`practice-${id}-syringe-toggle`}
            aria-pressed={!!d.instrument[key]}
            onClick={() => d.setInstrument((s) => ({ ...s, [key]: !s[key] }))}
          >
            {d.instrument[key] ? "關閉" : "開啟"}
            {label} syringe 櫃門
          </button>
        ))}
      </div>
    </fieldset>
  );
}
