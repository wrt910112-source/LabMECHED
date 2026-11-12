import { useEffect, useRef, useState } from "react";
import Viewer from "./Viewer";
import { views, asset, type PartId } from "./data";
import { closedDoors } from "./enclosures";
import { initialBottles } from "./detergents";
import { preparationViews, type PreparationView } from "./preparationModel";
import RackRequisition from "./RackRequisition";
import {
  ResultTable,
  LjCharts,
  IncidentForm,
  TraceForm,
  type TroubleDispatch,
} from "./TroubleLis";
import {
  troubleTitle,
  troubleIdentity,
  troubleMaterials,
  troubleCatalog,
  troubleChecks,
  troubleGate,
  troubleStepNames,
  runNames,
  type RunKind,
  type TroubleState,
  type TroubleAction,
} from "../shared/troubleshooting";
import type { MaterialKind } from "../shared/materialCatalog";
import "./troubleshooting.css";
export type TroubleWorkspace =
  | "approval"
  | "chart"
  | "factors"
  | "bench"
  | "reagent"
  | "calibration"
  | "trace"
  | "form"
  | "sop"
  | "log";
const routes: TroubleWorkspace[] = [
  "approval",
  "chart",
  "approval",
  "chart",
  "reagent",
  "calibration",
  "bench",
  "trace",
  "form",
  "form",
  "form",
  "form",
];
const hints = [
  "選取 MAS27091 的 UIBC 183 結果，查看後開啟 L-J 圖。",
  "分別查看品管液、試劑、校正資料；183 超過 +3 SD，確認 1.3S。",
  "核對原杯身分；杯1為原杯，將它裝入綠架、放至進樣區、推入，再執行原杯重測。",
  "查看179與圖上的183；同側相鄰兩點超過+2 SD，確認2.2S。",
  "先更換QC來源，另杯重新分裝、上機並重測。仍異常後，取出兩舊瓶；R1a→R1、R2a→R2，混勻、放回對應空槽後Reagent Check。",
  "申請27.UIBC校正，分裝LCC2並裝入黃架、推入後執行校正。",
  "申請UIBC QC；兩濃度各自新分裝、裝綠架及上機，執行後各自核對155與50。",
  "分別核對P01、P02，選取模擬PDF並上傳成功。",
  "原因探討片語：新泡製試劑。移入編輯區並確定。",
  "矯正措施加入B28、B27、B21、B22；保留完整實際操作紀錄。",
  "矯正結果加入「品管合格」「進行檢體回溯，待合批收。」。預防措施非必填。",
  "核對必要處置、兩筆回溯、附件與表單後按原表單「呈送」。",
];
export default function TroubleshootingRoom({
  state: s,
  exam = false,
  busy = false,
  feedback = "",
  onAction,
  onReturn,
  onReset,
  onFinishExam,
  onRetry,
  retryLabel = "重試保存",
  networkFailure = false,
  locked = false,
  startedAt,
}: {
  state: TroubleState;
  exam?: boolean;
  busy?: boolean;
  feedback?: string;
  onAction: TroubleDispatch;
  onReturn: () => void;
  onReset?: () => void;
  onFinishExam?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  networkFailure?: boolean;
  locked?: boolean;
  startedAt?: number;
}) {
  const [workspace, setWorkspace] = useState<TroubleWorkspace>("approval"),
    [benchView, setBenchView] = useState<PreparationView>("bench"),
    [collapsed, setCollapsed] = useState(false),
    [showVerify, setShowVerify] = useState(false),
    [rule, setRule] = useState(""),
    [runKind, setRunKind] = useState<RunKind>("original");
  const [cup, setCup] = useState("cup-1"),
    [rack, setRack] = useState<MaterialKind>("QC"),
    [slot, setSlot] = useState(1),
    [pair, setPair] = useState<"R1" | "R2">("R1"),
    [aux, setAux] = useState("R1a"),
    [bank, setBank] = useState<"R1" | "R2">("R1"),
    [reagentSelection, setReagentSelection] = useState<string | null>(null);
  const [test, setTest] = useState("UIBC"),
    [specimen, setSpecimen] = useState("MAS27091"),
    [originalCup, setOriginalCup] = useState("cup-1"),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(Date.now()),
    [request, setRequest] = useState({ ...views[0], serial: 0 });
  const [bottles] = useState(initialBottles),
    lock = useRef(false),
    verify = useRef<HTMLDialogElement>(null);
  const checks = troubleChecks(s),
    current = Math.max(
      0,
      checks.findIndex((c) => !c.done),
    ),
    done = checks.every((c) => c.done),
    pending = busy || locked || !!s.pending;
  const selectedCup = s.preparation.cups.find((c) => c.id === cup)!,
    source = s.preparation.source ? troubleCatalog[s.preparation.source] : null;
  async function act(c: TroubleAction) {
    if (lock.current || busy || locked) return false;
    lock.current = true;
    setNotice("");
    try {
      const ok = await onAction(c);
      if (ok)
        setNotice(
          c.action === "preparation" && c.data?.action === "select"
            ? "已選取物件。"
            : "操作已記錄。",
        );
      return ok;
    } finally {
      lock.current = false;
    }
  }
  function go(next: TroubleWorkspace) {
    setWorkspace(next);
    if (next === "bench") setBenchView("bench");
    if (next === "reagent") setBenchView("reagent");
    void act({ action: "view", target: next });
  }
  function prep(
    action: string,
    target?: string,
    extra: Record<string, unknown> = {},
  ) {
    return act({
      action: "preparation",
      data: { action, ...(target ? { target } : {}), ...extra },
    });
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (showVerify) verify.current?.showModal();
    else verify.current?.close();
  }, [showVerify]);
  useEffect(() => {
    if (s.seq === 0) {
      setWorkspace("approval");
      setCup("cup-1");
      setRule("");
      setRunKind("original");
      setNotice("");
    }
  }, [s.seq]);
  useEffect(() => {
    const [kind, id, n] = s.preparation.selection?.split(":") || [];
    if (kind === "cup") setCup(id);
    if (kind === "slot" || kind === "rack") {
      setRack(id as MaterialKind);
      if (n) setSlot(Number(n));
    }
  }, [s.preparation.selection]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.key.toLowerCase() !== "e" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.defaultPrevented ||
        pending ||
        workspace !== "bench" ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,select,textarea")) ||
        [...document.querySelectorAll("dialog[open]")].some(
          (d) => !d.contains(document.querySelector(".trouble-room")),
        )
      )
        return;
      e.preventDefault();
      void prep(s.preparation.pipette ? "dispense" : "aspirate", cup);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const calibrationBlocked = !["baseline", "success"].includes(s.calibration);
  const nativeTitle: Record<TroubleWorkspace, string> = {
    approval: "品管確認作業",
    chart: "QC L-J Chart",
    factors: "相關因素資料",
    bench: "CALI／QC 備料",
    reagent: "UIBC 試劑",
    calibration: "Rack Requisition／UIBC 校正",
    trace: "檢體回溯填報",
    form: "品管異常處理表",
    sop: "本情境處理流程",
    log: "操作紀錄",
  };
  const nav = [
    ["approval", "QC 審批"],
    ["chart", "L-J 圖"],
    ["factors", "相關因素"],
    ["bench", "備料工作台"],
    ["reagent", "UIBC 試劑"],
    ["calibration", "Rack Requisition"],
    ["trace", "檢體回溯填報"],
    ["form", "品管異常處理表"],
    ["sop", "查看 SOP"],
  ] as [TroubleWorkspace, string][];
  return (
    <section
      className={`trouble-room ${exam ? "trouble-exam" : ""}`}
      aria-label={exam ? "UIBC 障礙排除考試" : "UIBC 障礙排除練習"}
      data-mode={exam ? "exam" : "practice"}
      data-saving={busy}
      data-running={!!s.pending}
    >
      <header className="trouble-header">
        <strong>
          AU5800 <small>LAB SIM</small>
        </strong>
        <span>{troubleTitle}</span>
        <b>{exam ? "考試模式" : "練習模式"}</b>
        {startedAt && (
          <span>
            經過 {Math.floor((now - startedAt) / 60000)}:
            {String(Math.floor((now - startedAt) / 1000) % 60).padStart(2, "0")}
          </span>
        )}
        <button onClick={onReturn}>
          {exam ? "放棄本次考試" : "返回任務中心"}
        </button>
        {onFinishExam && <button onClick={onFinishExam}>完成考試</button>}
      </header>
      <nav className="trouble-nav" aria-label="UIBC 作業切換">
        {nav.map(([id, name]) => (
          <button
            key={id}
            aria-pressed={workspace === id}
            onClick={() => go(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="trouble-stage">
        <Viewer
          selected="overview"
          internal={false}
          labels={false}
          request={request}
          onSelect={(id: PartId) => {
            if (id === "r1" || id === "r2") go("reagent");
          }}
          zoom={0}
          onReady={() => {}}
          onError={() => setNotice("3D載入失敗，請重新整理。")}
          bottles={bottles}
          selectedSlot={null}
          onSlot={() => {}}
          doorState={closedDoors}
          iseState={{ open: false, removed: [] }}
          daily={{
            active: false,
            wiped: [],
            mode: "inspect",
            cleanCup: "empty",
            drops: ["", "", "", ""],
          }}
          practice={false}
          practiceTarget=""
          onPracticeSelect={() => {}}
          onWeeklySelect={() => {}}
          suspended={!["bench", "reagent"].includes(workspace)}
          rightInset={collapsed ? 0 : 330}
          topInset={130}
          preparation={{
            state: s.preparation,
            gate: troubleGate,
            view: benchView,
            exam,
            freeSimulation: true,
            materials: troubleMaterials,
          }}
          troubleshooting={s}
          troubleSelection={reagentSelection}
          onPreparationSelect={(id) => {
            setReagentSelection(null);
            void prep("select", id);
          }}
          onTroubleSelect={(id) => {
            setReagentSelection(id);
            const key = id.split(":")[1];
            if (id.startsWith("bank:")) setBank(key as "R1" | "R2");
            else if (key.endsWith("a")) setAux(key);
            else setPair(key.endsWith("R2") ? "R2" : "R1");
          }}
        />
        {
          <section
            className="lis-window"
            hidden={["bench", "reagent"].includes(workspace)}
            aria-label={nativeTitle[workspace]}
          >
            <header>
              <b>{nativeTitle[workspace]}</b>
              <span>教學模擬　M229：AU5800</span>
              <button onClick={() => go("bench")} aria-label="收合電腦視窗">
                —
              </button>
            </header>
            <div className="lis-body">
              {workspace === "approval" && (
                <>
                  <div className="lis-filter">
                    <label>
                      品管組{" "}
                      <select>
                        <option>BIO：生化組</option>
                      </select>
                    </label>
                    <label>
                      儀器{" "}
                      <select>
                        <option>M229：AU5800</option>
                      </select>
                    </label>
                    <label>
                      品管時序{" "}
                      <select>
                        <option>本次與模擬歷史</option>
                      </select>
                    </label>
                    <span>狀態：有效未確認／異常待處理</span>
                  </div>
                  <ResultTable s={s} act={act} busy={pending} />
                  <div className="lis-toolbar">
                    <button onClick={() => go("chart")}>查看 L-J 圖</button>
                    <button onClick={() => setShowVerify(true)}>
                      原杯重測身分核對
                    </button>
                    <label>
                      執行方式{" "}
                      <select
                        aria-label="QC 執行方式"
                        value={runKind}
                        onChange={(e) => setRunKind(e.target.value as RunKind)}
                      >
                        {Object.entries(runNames).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void act({ action: "run", target: runKind })
                      }
                    >
                      執行選取作業
                    </button>
                  </div>
                </>
              )}
              {workspace === "chart" && (
                <>
                  <LjCharts s={s} />
                  <div className="lis-toolbar">
                    <label>
                      確認本次判讀{" "}
                      <select
                        aria-label="QC 規則判讀"
                        value={rule}
                        onChange={(e) => setRule(e.target.value)}
                      >
                        <option value="">請選擇</option>
                        <option>1.2S</option>
                        <option>1.3S</option>
                        <option>2.2S</option>
                      </select>
                    </label>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void act({ action: "confirm-rule", value: rule })
                      }
                    >
                      確認判讀
                    </button>
                    <button onClick={() => go("factors")}>查看相關因素</button>
                    <button onClick={() => setShowVerify(true)}>
                      原杯重測身分核對
                    </button>
                  </div>
                </>
              )}
              {workspace === "factors" && (
                <>
                  <p>依個別操作查看資料，不將待設定資料宣稱已通過期限核對。</p>
                  {[
                    [
                      "qc",
                      "品管液",
                      "MAS chem-TRAK-H／MAS27091，批號27091。正式濃度代碼與瓶身效期待確認。",
                    ],
                    [
                      "reagent",
                      "UIBC 試劑",
                      "本情境材料背景：新泡製試劑。實際瓶身批號、效期及正式槽位待設定。",
                    ],
                    [
                      "calibration",
                      "校正",
                      "目錄既有對應：LCC2 → UIBC。校正申請與成功結果分開記錄。",
                    ],
                  ].map(([id, title, text]) => (
                    <details key={id}>
                      <summary>{title}</summary>
                      <p>{text}</p>
                      {id === "reagent" && (
                        <img
                          className="lis-reference"
                          src={asset("real-photos/UIBC試劑瓶.jpg")}
                          alt="本院UIBC試劑瓶實拍，非本次模擬批號核對證據"
                        />
                      )}
                      <button
                        disabled={pending}
                        onClick={() =>
                          void act({ action: "inspect", target: id })
                        }
                      >
                        已查看{title}資料
                      </button>
                      <span>
                        {s.factors.includes(id)
                          ? " 已查看（未知資料仍待確認）"
                          : ""}
                      </span>
                    </details>
                  ))}
                </>
              )}
              {
                <div hidden={workspace !== "calibration"}>
                  <div className="lis-interlock" role="status">
                    {s.reagent.checked && calibrationBlocked
                      ? "UIBC 試劑已更換，請先完成校正。"
                      : `校正狀態：${{ baseline: "情境初始校正", required: "需校正", running: "校正執行中", success: "校正成功；QC尚須獨立執行", failed: "校正失敗，攔截持續" }[s.calibration]}`}
                  </div>
                  <RackRequisition
                    d={{ rack: s.rack, setRack: () => {} }}
                    notify={setNotice}
                    canStart
                    exam={exam}
                    disabled={pending}
                    onEntry={(type, selection, category) =>
                      act({
                        action: "rack-entry",
                        data: { type, selection, category },
                      })
                    }
                    onQcEntry={(drafts) =>
                      act({
                        action: "rack-entry",
                        data: {
                          type: "Serum",
                          category: "qc",
                          selection: { ...s.rack.Serum, qc: drafts.Serum },
                        },
                      })
                    }
                  />
                  <div className="lis-toolbar">
                    <button onClick={() => go("bench")}>
                      {exam ? "前往備料與上機" : "前往 LCC2／QC 備料與上機"}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void act({ action: "run", target: "calibration" })
                      }
                    >
                      執行 UIBC 校正
                    </button>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void act({ action: "run", target: "final" })
                      }
                    >
                      執行兩濃度 QC
                    </button>
                  </div>
                </div>
              }
              {workspace === "trace" && (
                <TraceForm
                  s={s}
                  busy={pending}
                  act={act}
                  networkFailure={networkFailure}
                />
              )}
              {workspace === "form" && (
                <IncidentForm s={s} busy={pending} exam={exam} act={act} />
              )}
              {workspace === "sop" && (
                <article className="lis-sop">
                  <h2>本情境處理流程</h2>
                  <p className="lis-abnormal">
                    科內QC異常處理SOP原圖待補。本頁依本次文字情境建立，並非通用臨床處置規則。
                  </p>
                  <p>
                    異常QC → 查看資料及原杯重測 → 本次仍異常 → 更換QC液並重測 →
                    本次仍異常 → 舊R1／R2取出、R1a→R1與R2a→R2混勻及裝回 →
                    Reagent Check → 重新校正 → 兩濃度QC →
                    兩支檢體回溯、報告與表單 → 呈送待審核。
                  </p>
                  <p>
                    一般分支：處置後須依結果重新判斷；本情境刻意設定更換品管液後仍異常，並非所有QC異常都須執行全部處置。
                  </p>
                  <p>
                    UIBC需校正與QC異常處理是不同狀態。校正成功不等於QC合格；QC恢復不等於主管已同意恢復常規測試。
                  </p>
                  <p>
                    可隨時查看既有結果；不要將審批、核對、上機及校正成功合併為同一完成旗標。
                  </p>
                </article>
              )}
              {workspace === "log" && (
                <table aria-label="UIBC 操作紀錄">
                  <thead>
                    <tr>
                      <th>序</th>
                      <th>操作</th>
                      <th>對象</th>
                      <th>結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.log.map((row) => (
                      <tr key={row.seq}>
                        <td>{row.seq}</td>
                        <td>{row.action}</td>
                        <td>{row.target}</td>
                        <td className={!row.ok ? "lis-abnormal" : ""}>
                          {exam && !row.ok
                            ? "操作未完成，交卷後提供檢核。"
                            : row.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        }
        {workspace === "bench" && (
          <section
            className="trouble-tools hud-card"
            aria-label="UIBC 備料操作"
          >
            <h2>CALI／QC 備料</h2>
            <p>容器與孔位為教學示意；分裝量、正式架位待設定。</p>
            <div className="trouble-source-buttons">
              {troubleMaterials.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={s.preparation.source === m.id}
                  data-testid={`uibc-source-${m.id}`}
                  disabled={pending}
                  onClick={() => {
                    setReagentSelection(null);
                    void prep("select", `source:${m.id}`);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <p>
              已選來源：{source?.name || "尚未選取"}
              <br />
              移液器：
              {s.preparation.pipette
                ? troubleCatalog[s.preparation.pipette.materialId].name
                : "空"}
            </p>
            <label>
              容器{" "}
              <select
                aria-label="UIBC 備料容器"
                value={cup}
                onChange={(e) => {
                  setCup(e.target.value);
                  void prep("select", `cup:${e.target.value}`);
                }}
              >
                {s.preparation.cups.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    杯{i + 1}
                    {i === 0 ? "（原杯）" : ""} ·{" "}
                    {c.materialId ? troubleCatalog[c.materialId].name : "空杯"}
                  </option>
                ))}
              </select>
            </label>
            <p>
              杯內來源：
              {selectedCup.materialId
                ? troubleCatalog[selectedCup.materialId].name
                : "空"}{" "}
              ·{" "}
              {selectedCup.rack
                ? `${selectedCup.rack} ${selectedCup.slot}`
                : "工作台"}
            </p>
            <div className="trouble-grid">
              <button disabled={pending} onClick={() => void prep("aspirate")}>
                吸取來源液
              </button>
              <button
                disabled={pending}
                onClick={() => void prep("dispense", cup)}
              >
                加入容器
              </button>
              <button
                disabled={pending}
                onClick={() => void prep("discard-pipette")}
              >
                清空移液器
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm("清空選取杯子？此操作不會刪除已產生的結果。")
                  )
                    void prep("empty", cup);
                }}
              >
                清空容器
              </button>
            </div>
            <label>
              檢體架{" "}
              <select
                aria-label="UIBC 檢體架"
                value={rack}
                onChange={(e) => setRack(e.target.value as MaterialKind)}
              >
                <option value="RB">藍色 RB</option>
                <option value="CALI">黃色 CALI</option>
                <option value="QC">綠色 QC</option>
              </select>
            </label>
            <label>
              教學空位{" "}
              <select
                aria-label="UIBC 架位"
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                    {s.preparation.cups.some(
                      (c) => c.rack === rack && c.slot === i + 1,
                    )
                      ? " 已占用"
                      : " 空位"}
                  </option>
                ))}
              </select>
            </label>
            <div className="trouble-grid">
              <button
                disabled={pending}
                onClick={() => void prep("place", cup, { rack, slot })}
              >
                放入架位
              </button>
              <button
                disabled={pending}
                onClick={() => void prep("unrack", cup)}
              >
                容器取回工作台
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  setBenchView("loading");
                  void prep("stage", undefined, { rack });
                }}
              >
                放至進樣區
              </button>
              <button
                disabled={pending}
                onClick={() => void prep("push", undefined, { rack })}
              >
                推入儀器
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  setBenchView("bench");
                  void prep("retrieve", undefined, { rack });
                }}
              >
                取回檢體架
              </button>
              <button
                onClick={() =>
                  setBenchView(benchView === "loading" ? "bench" : "loading")
                }
              >
                切換備料／進樣視角
              </button>
            </div>
            <p>
              {rack}架：
              {
                { bench: "工作台", entry: "進樣區", loaded: "已推入" }[
                  s.preparation.racks[rack].location
                ]
              }
            </p>
            <label>
              模擬執行{" "}
              <select
                aria-label="備料後執行方式"
                value={runKind}
                onChange={(e) => setRunKind(e.target.value as RunKind)}
              >
                {Object.entries(runNames).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={pending}
              onClick={() => void act({ action: "run", target: runKind })}
            >
              執行上機作業
            </button>
          </section>
        )}
        {workspace === "reagent" && (
          <section
            className="trouble-tools hud-card"
            aria-label="UIBC 試劑操作"
          >
            <h2>UIBC 試劑準備與更換</h2>
            <button
              onClick={() =>
                setBenchView(benchView === "reagent" ? "bench" : "reagent")
              }
            >
              切換配製工作台／儲存槽
            </button>
            <p>
              選取物件：{reagentSelection || "尚未選取"}
              。取出、加入、混勻與放入均需分別操作。
            </p>
            <label>
              操作瓶別{" "}
              <select
                aria-label="UIBC 操作瓶別"
                value={pair}
                onChange={(e) => setPair(e.target.value as "R1" | "R2")}
              >
                <option>R1</option>
                <option>R2</option>
              </select>
            </label>
            <button
              disabled={pending}
              onClick={() => void act({ action: "remove-old", target: pair })}
            >
              取出舊 UIBC {pair}
            </button>
            <label>
              加入來源{" "}
              <select
                aria-label="UIBC 加入來源"
                value={aux}
                onChange={(e) => setAux(e.target.value)}
              >
                <option>R1a</option>
                <option>R2a</option>
              </select>
            </label>
            <div className="trouble-grid">
              <button
                disabled={pending}
                onClick={() =>
                  void act({ action: "pour", target: pair, value: aux })
                }
              >
                加入選取來源至新瓶
              </button>
              <button
                disabled={pending}
                onClick={() => void act({ action: "mix", target: pair })}
              >
                混勻新 UIBC {pair}
              </button>
            </div>
            <label>
              目標儲存槽{" "}
              <select
                aria-label="UIBC 目標儲存槽"
                value={bank}
                onChange={(e) => setBank(e.target.value as "R1" | "R2")}
              >
                <option>R1</option>
                <option>R2</option>
              </select>
            </label>
            <div className="trouble-grid">
              <button
                disabled={pending}
                onClick={() =>
                  void act({ action: "install", target: pair, value: bank })
                }
              >
                放入新 UIBC {pair}
              </button>
              <button
                disabled={pending}
                onClick={() => void act({ action: "remove-new", target: pair })}
              >
                取回新瓶
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (window.confirm("重新準備這支新試劑？原操作紀錄仍保留。"))
                    void act({ action: "reset-reagent", target: pair });
                }}
              >
                重新準備此新瓶
              </button>
            </div>
            <dl>
              {(["R1", "R2"] as const).map((p) => (
                <div key={p}>
                  <dt>{p}儲存槽</dt>
                  <dd>
                    {s.reagent.slots[p] || "空槽"} · 舊瓶
                    {s.reagent.old[p] ? "仍在槽內" : "已取出"} · 加入
                    {s.reagent.mix[p].source || "未執行"} ·{" "}
                    {s.reagent.mix[p].mixed ? "已混勻" : "未混勻"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="lis-inline">
              <b>Reagent Management · Details</b>
              <p>UIBC／R1、R2　正式槽位：待設定</p>
              <button
                disabled={pending}
                onClick={() => void act({ action: "reagent-check" })}
              >
                Reagent Check
              </button>
            </div>
            <button
              disabled={pending}
              onClick={() => void act({ action: "replace-qc" })}
            >
              更換品管液來源瓶
            </button>
            <button onClick={() => go("bench")}>品管液分裝與重測</button>
            <button onClick={() => go("calibration")}>進入校正申請</button>
            <details>
              <summary>UIBC 試劑瓶實拍參考</summary>
              <img
                className="lis-reference"
                src={asset("real-photos/UIBC試劑瓶.jpg")}
                alt="UIBC R1、R1a、R2、R2a實拍參考"
              />
              <p>照片不作本次模擬批號及效期證據。</p>
            </details>
          </section>
        )}
      </main>
      <aside
        className={`trouble-hud hud-card ${collapsed ? "collapsed" : ""}`}
        aria-label="UIBC 任務資訊"
      >
        <button onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "展開任務資訊" : "收合任務資訊"}
        </button>
        {!collapsed && (
          <>
            <h2>
              {done
                ? "本次訓練操作完成"
                : exam
                  ? "障礙排除作答中"
                  : `步驟 ${current + 1}／12`}
            </h2>
            <p className="trouble-warning">
              UIBC 常規病患檢體測試：暫停。僅允許本情境受控回溯。
            </p>
            {calibrationBlocked && (
              <p className="trouble-interlock">
                UIBC 試劑已更換，請先完成校正。
              </p>
            )}
            {s.qcRecovered && (
              <p>
                QC恢復，
                {s.submission === "sent-awaiting-review"
                  ? "已呈送待審核"
                  : "回溯／填報待完成"}
                。
              </p>
            )}
            {s.submission === "sent-awaiting-review" && (
              <strong className="trouble-warning">
                待主管審核／允收；未核准恢復常規檢體測試。
              </strong>
            )}
            {!exam && (
              <>
                <p className="trouble-hint">
                  {done
                    ? "本次訓練操作完成；呈送不代表主管核准。"
                    : hints[current]}
                </p>
                <button
                  onClick={() =>
                    go(
                      current === 4 && !s.runs.fresh
                        ? "reagent"
                        : routes[current],
                    )
                  }
                >
                  定位目前操作
                </button>
                <details open>
                  <summary>十二步任務紀錄</summary>
                  <ol>
                    {checks.map((c, i) => (
                      <li key={c.id}>
                        <button onClick={() => go(routes[i])}>
                          {c.done ? "✓" : "○"} {i + 1}. {c.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                </details>
              </>
            )}
            {exam && (
              <p>可主動查看原始結果、標籤與SOP。作答中不顯示檢核明細。</p>
            )}
            <p role={networkFailure ? "alert" : "status"}>
              {busy
                ? "保存中…"
                : s.pending
                  ? "模擬執行中…"
                  : feedback || notice || "操作驅動進度；資料均為教學模擬。"}
            </p>
            {onRetry && (
              <button disabled={busy} onClick={onRetry}>
                {retryLabel}
              </button>
            )}
            <button onClick={() => go("log")}>檢視操作紀錄</button>
            <button onClick={() => go("sop")}>查看 SOP</button>
            {onReset && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "重新開始UIBC情境？本次模擬資料將清除，其他任務不受影響。",
                    )
                  )
                    onReset();
                }}
              >
                重新開始本情境
              </button>
            )}
          </>
        )}
      </aside>
      <dialog
        ref={verify}
        className="lis-verify-dialog"
        aria-label="原杯身分核對"
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowVerify(false);
        }}
      >
        <header>原杯品管重新上機</header>
        <label>
          項目{" "}
          <select
            aria-label="原杯項目"
            value={test}
            onChange={(e) => setTest(e.target.value)}
          >
            <option>UIBC</option>
            <option>ALT</option>
          </select>
        </label>
        <label>
          標本號{" "}
          <select
            aria-label="原杯標本號"
            value={specimen}
            onChange={(e) => setSpecimen(e.target.value)}
          >
            <option>MAS27091</option>
            <option>第二濃度（待設定）</option>
          </select>
        </label>
        <label>
          容器{" "}
          <select
            aria-label="原杯容器"
            value={originalCup}
            onChange={(e) => setOriginalCup(e.target.value)}
          >
            {s.preparation.cups.map((c, i) => (
              <option key={c.id} value={c.id}>
                杯{i + 1}
                {i === 0 ? "／原杯" : "／其他容器"}
              </option>
            ))}
          </select>
        </label>
        <p>
          品管液：MAS chem-TRAK-H。核對後仍須裝架、進樣與推入，才能執行重測。
        </p>
        <footer>
          <button onClick={() => setShowVerify(false)}>取消</button>
          <button
            disabled={pending}
            onClick={async () => {
              if (
                await act({
                  action: "verify-original",
                  data: { test, specimen, cup: originalCup },
                })
              ) {
                setShowVerify(false);
                go("bench");
              }
            }}
          >
            核對並前往裝架
          </button>
        </footer>
      </dialog>
    </section>
  );
}
