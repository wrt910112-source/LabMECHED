import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import LegacyRoom from "./TroubleshootingRoomV1";
import Viewer from "./Viewer";
import { asset, views } from "./data";
import { closedDoors } from "./enclosures";
import { initialBottles } from "./detergents";
import { type PreparationView } from "./preparationModel";
import RackRequisition from "./RackRequisition";
import { TroubleReagentManagement } from "./ReagentManagement";
import TroubleReferences from "./TroubleReferences";
import { ResultTable, LjCharts, IncidentForm, TraceForm } from "./TroubleLis";
import {
  isTroubleV2,
  manualTroubleCheck,
  requiresQcConfirmation,
  finalQcAssessment,
  troubleTitle,
  troubleMaterialsV2,
  troubleBatchRequirements,
  catalogV2,
  gateForTrouble,
  troubleChecks,
  type TroubleAction,
} from "../shared/troubleshooting";
import type { MaterialKind } from "../shared/materialCatalog";
import { nextTroubleHint, type TroubleHint } from "./troubleGuide";
import "./troubleshooting.css";
type Props = ComponentProps<typeof LegacyRoom>;
export default function TroubleshootingRoom(props: Props) {
  return isTroubleV2(props.state) ? (
    <RoomV2 {...props} />
  ) : (
    <LegacyRoom {...props} />
  );
}
const routes = [
  "chart",
  "factors",
  "bench",
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
const nav = [
  ["approval", "QC 審批"],
  ["chart", "L-J 圖"],
  ["factors", "相關因素"],
  ["bench", "備料工作台"],
  ["reagent", "UIBC 試劑"],
  ["management", "Reagent Management"],
  ["calibration", "Rack Requisition"],
  ["trace", "檢體回溯填報"],
  ["form", "品管異常處理表"],
  ["sop", "查看 SOP"],
];
function RoomV2({
  state: s,
  exam = false,
  busy = false,
  locked = false,
  feedback = "",
  onAction,
  onReturn,
  onReset,
  onFinishExam,
  onRetry,
  retryLabel = "重試保存",
  networkFailure = false,
  startedAt,
}: Props) {
  const [workspace, setWorkspace] = useState("approval"),
    [rule, setRule] = useState(""),
    [followup, setFollowup] = useState("");
  const [cup, setCup] = useState("cup-1"),
    [rack, setRack] = useState<MaterialKind>("QC"),
    [slot, setSlot] = useState(1),
    [batches, setBatches] = useState<string[]>(["QC"]);
  const [view, setView] = useState<PreparationView>("bench"),
    [selection, setSelection] = useState<string | null>(null),
    [install, setInstall] = useState(false),
    [bank, setBank] = useState("R1");
  const [factor, setFactor] = useState(""),
    [rr, setRr] = useState<TroubleHint | null>(null),
    [phrase, setPhrase] = useState<TroubleHint | null>(null),
    [browse, setBrowse] = useState(false);
  const [moving, setMoving] = useState(false),
    [management, setManagement] = useState<TroubleHint | null>(null);
  const onManagementGuide = useCallback(
    (hint: TroubleHint) => setManagement(hint),
    [],
  );
  const [collapsed, setCollapsed] = useState(false),
    [benchNoteOpen, setBenchNoteOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(Date.now());
  const [request] = useState({ ...views[0], serial: 0 }),
    [bottles] = useState(initialBottles);
  const root = useRef<HTMLElement>(null),
    actionLock = useRef(false),
    previousSeq = useRef(s.seq),
    shownFinal = useRef<number | null>(null),
    previousQcConfirmed = useRef(s.qcRecovered);
  const pending = busy || locked || !!s.pending || moving,
    checks = troubleChecks(s),
    step = checks.findIndex((c) => !c.done),
    done = step < 0;
  const onRrGuide = useCallback((hint: TroubleHint) => setRr(hint), []);
  const onPhraseGuide = useCallback(
    (hint: TroubleHint | null) => setPhrase(hint),
    [],
  );
  const onBrowse = useCallback((value: boolean) => setBrowse(value), []);
  const next =
    exam || done
      ? null
      : onRetry
        ? { target: "retry", text: "重試保存，保留同一事件" }
        : pending
          ? null
          : nextTroubleHint(s, {
              workspace,
              rule,
              followup,
              cup,
              rack,
              slot,
              selection,
              view,
              install,
              bank,
              batches,
              factor,
              rr,
              phrase,
              browse,
              management,
            });
  async function act(command: TroubleAction) {
    if (actionLock.current || busy || locked) return false;
    actionLock.current = true;
    try {
      const ok = await onAction(command);
      setNotice(ok ? "操作已記錄。" : "操作未完成，請核對目前條件。");
      return ok;
    } finally {
      actionLock.current = false;
    }
  }
  function go(id: string) {
    setWorkspace(id);
    if (id === "bench") setView("bench");
    if (id === "reagent") setView("reagent");
    void act({ action: "view", target: id });
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
  function pick(id: string) {
    setWorkspace("reagent");
    setSelection(id);
    setInstall(false);
    if (id.startsWith("bottle:")) {
      const bottle = id.split(":")[1];
      const inInstrument = Object.values(s.reagent.slots).includes(bottle);
      setView(inInstrument ? "reagent" : "bench");
    }
  }
  async function batch(
    action: "batch-stage" | "batch-push" | "batch-retrieve",
  ) {
    if (!s.runs.original) {
      if (batches.length !== 1 || batches[0] !== "QC") {
        setNotice(exam ? "操作未完成。" : "原杯重測只使用綠色QC架。");
        return;
      }
      if (
        await prep(
          action === "batch-stage"
            ? "stage"
            : action === "batch-push"
              ? "push"
              : "retrieve",
          undefined,
          { rack: "QC" },
        )
      )
        setView(action === "batch-retrieve" ? "bench" : "loading");
    } else if (await act({ action, data: { racks: batches } }))
      setView(action === "batch-retrieve" ? "bench" : "loading");
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!requiresQcConfirmation(s)) return;
    if (!s.runs.final) shownFinal.current = null;
    if (
      s.runs.final &&
      !pending &&
      !s.qcRecovered &&
      shownFinal.current !== s.reagent.generation
    ) {
      shownFinal.current = s.reagent.generation;
      setWorkspace("chart");
      setCollapsed(false);
      root.current?.querySelector(".lis-body")?.scrollTo({ top: 0 });
    }
    if (!previousQcConfirmed.current && s.qcRecovered) setWorkspace("trace");
    previousQcConfirmed.current = s.qcRecovered;
  }, [s.runs.final, s.qcRecovered, s.reagent.generation, pending, s.version]);
  useEffect(() => {
    if (s.seq < previousSeq.current) {
      setWorkspace("approval");
      setRule("");
      setFollowup("");
      setSelection(null);
      setBatches(["QC"]);
      setCup("cup-1");
      setView("bench");
    }
    previousSeq.current = s.seq;
  }, [s.seq]);
  useEffect(() => {
    const highlighted = root.current?.querySelectorAll(".trouble-next");
    highlighted?.forEach((el) => el.classList.remove("trouble-next"));
    if (next)
      root.current
        ?.querySelector(`[data-guide="${next.target}"]`)
        ?.classList.add("trouble-next");
    return () => {
      root.current
        ?.querySelectorAll(".trouble-next")
        .forEach((el) => el.classList.remove("trouble-next"));
    };
  }, [next?.target, workspace, s.seq, phrase, rr, pending, collapsed, browse]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "e" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.defaultPrevented ||
        workspace !== "bench" ||
        pending ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,select,textarea,dialog"))
      )
        return;
      e.preventDefault();
      void prep(s.preparation.pipette ? "dispense" : "aspirate", cup);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function locate() {
    if (!next) return;
    root.current
      ?.querySelector(`[data-guide="${next.target}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const source = s.preparation.source ? catalogV2[s.preparation.source] : null,
    selectedCup = s.preparation.cups.find((c) => c.id === cup)!;
  const key = selection?.split(":")[1] || "",
    pair = key.endsWith("R2") ? "R2" : "R1";
  const finalReview = requiresQcConfirmation(s) && !!s.runs.final,
    finalAssessment = finalQcAssessment(s),
    finalAccepted = !!finalAssessment?.every((r) => r.accepted);
  const button = (
    id: string,
    text: string,
    action: () => void,
    disabled = pending,
  ) => (
    <button data-guide={id} disabled={disabled} onClick={action}>
      {text}
    </button>
  );
  return (
    <section
      ref={root}
      className={`trouble-room ${exam ? "trouble-exam" : ""}`}
      aria-label={exam ? "UIBC 障礙排除考試" : "UIBC 障礙排除練習"}
      data-mode={exam ? "exam" : "practice"}
      data-saving={busy}
      data-running={!!s.pending || moving}
      data-version={s.version}
      data-next={next?.target || ""}
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
            data-guide={`nav-${id}`}
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
          onSelect={(id) => {
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
            gate: gateForTrouble(s),
            view,
            exam,
            freeSimulation: true,
            materials: troubleMaterialsV2,
          }}
          troubleshooting={s}
          onTroubleMotion={setMoving}
          troubleSelection={selection}
          troubleGuideTarget={!exam ? next?.model : undefined}
          onPreparationSelect={(id) => {
            setSelection(null);
            void prep("select", id);
            if (id.startsWith("cup:")) setCup(id.split(":")[1]);
            if (id.startsWith("slot:")) {
              setRack(id.split(":")[1] as MaterialKind);
              setSlot(Number(id.split(":")[2]));
            }
          }}
          onTroubleSelect={pick}
        />
        <section
          className="lis-window"
          hidden={["bench", "reagent"].includes(workspace)}
          aria-label="UIBC 電腦視窗"
        >
          <header>
            <b>{nav.find(([id]) => id === workspace)?.[1] || "操作紀錄"}</b>
            <span>教學模擬　M229：AU5800</span>
            <button onClick={() => go("bench")} aria-label="收合電腦視窗">
              —
            </button>
          </header>
          <div className="lis-body">
            {workspace === "approval" && (
              <>
                <div className="lis-filter">
                  品管組：BIO 生化組　儀器：M229／AU5800　狀態：異常待處理
                </div>
                <ResultTable s={s} act={act} busy={pending} />
                <div className="lis-toolbar">
                  {button(
                    "approval-chart",
                    "查看 L-J 圖",
                    () => go("chart"),
                    false,
                  )}
                </div>
              </>
            )}
            {workspace === "chart" && (
              <>
                <LjCharts s={s} act={act} />
                {finalReview ? (
                  <section className="lis-final-qc" aria-label="兩濃度 QC 判讀">
                    <h3>校正後兩濃度 QC 判讀</h3>
                    <table aria-label="兩濃度 QC 允收結果">
                      <thead>
                        <tr>
                          <th>濃度</th>
                          <th>結果</th>
                          <th>允收範圍（±2 SD）</th>
                          <th>SDI</th>
                          <th>判讀</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalAssessment?.map((r) => (
                          <tr key={r.level}>
                            <td>
                              {r.level === "primary"
                                ? "MAS-1／第一濃度"
                                : "MAS-3／第二濃度"}
                            </td>
                            <td>{r.result.value}</td>
                            <td>
                              {r.min.toFixed(1)}～{r.max.toFixed(1)}
                            </td>
                            <td>
                              {r.sdi.toFixed(r.level === "primary" ? 2 : 3)}
                            </td>
                            <td
                              className={
                                r.accepted
                                  ? "lis-qc-accepted"
                                  : "lis-qc-rejected"
                              }
                            >
                              {r.accepted ? "本情境允收" : "未落在允收範圍"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p role="status" data-testid="final-qc-interpretation">
                      {finalAccepted
                        ? `兩個 level 的 QC 結果（${finalAssessment!.map((r) => r.result.value).join("、")}）均落在本情境允收範圍內。`
                        : "兩濃度 QC 結果尚待完成或未符合允收條件。"}
                      {s.qcRecovered
                        ? "已確認判讀，QC 恢復，回溯待完成。"
                        : "請核對兩濃度結果，點選「確認判讀」後進入檢體回溯填報。"}
                      常規病患檢體測試仍維持暫停，後續待主管審核／允收。
                    </p>
                    {button(
                      "confirm-qc",
                      "確認判讀",
                      () => void act({ action: "confirm-qc" }),
                      pending || s.qcRecovered || !finalAccepted,
                    )}
                  </section>
                ) : (
                  <div className="lis-toolbar">
                    <label>
                      判讀規則{" "}
                      <select
                        data-guide="rule"
                        aria-label="QC 規則判讀"
                        value={rule}
                        onChange={(e) => setRule(e.target.value)}
                      >
                        <option value="">請選擇</option>
                        {["1.2S", "1.3S", "2.2S"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      後續處理{" "}
                      <select
                        data-guide="followup"
                        aria-label="QC 後續處理"
                        value={followup}
                        onChange={(e) => setFollowup(e.target.value)}
                      >
                        <option value="">請選擇</option>
                        <option value="original">原杯品管液上機</option>
                        <option value="troubleshoot">進行異常處理</option>
                      </select>
                    </label>
                    {button(
                      "confirm-rule",
                      "確認判讀",
                      () =>
                        void act({
                          action: "confirm-rule",
                          value: rule,
                          data: { followup },
                        }),
                    )}
                    {button(
                      "open-original",
                      "原杯品管液上機",
                      () =>
                        void (async () => {
                          if (await act({ action: "open-original" })) {
                            setCup("cup-1");
                            setRack("QC");
                            setBatches(["QC"]);
                            go("bench");
                          }
                        })(),
                    )}
                  </div>
                )}
              </>
            )}
            {workspace === "factors" && (
              <>
                <p>未知瓶身資料仍待確認，查看不代表已通過期限核對。</p>
                {[
                  [
                    "qc",
                    "品管液",
                    "MAS chem-TRAK-H／MAS27091／批號27091。MAS-1為本情境指定別名，不由H推定濃度。",
                  ],
                  [
                    "reagent",
                    "UIBC 試劑",
                    "新泡製試劑背景，批號、效期、正式槽位與加入量待設定。",
                  ],
                  [
                    "calibration",
                    "校正",
                    "本次情境指定LCC-1；正式材料對應待確認，未改寫完整目錄的LCC2資料。",
                  ],
                ].map(([id, name, text]) => (
                  <details key={id} open={factor === id}>
                    <summary
                      data-guide={`factor-${id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setFactor(factor === id ? "" : id);
                      }}
                    >
                      {name}
                    </summary>
                    <p>{text}</p>
                    {id === "calibration" && (
                      <p className="lis-calibration-reminder" role="note">
                        檢查提醒：請檢查試劑校正效期、校正液效期與開封／泡製時間。
                        未提供的日期與時間仍待確認，查看資料不代表已通過期限核對。
                      </p>
                    )}
                    {id === "reagent" && (
                      <img
                        className="lis-reference"
                        src={asset("real-photos/UIBC試劑瓶.jpg")}
                        alt="UIBC試劑瓶實拍參考"
                      />
                    )}
                    {button(
                      `inspect-${id}`,
                      `已查看${name}資料`,
                      () => void act({ action: "inspect", target: id }),
                    )}
                    {s.factors.includes(id) && <span> 已查看</span>}
                  </details>
                ))}
              </>
            )}
            <div hidden={workspace !== "calibration"}>
              <p className="lis-interlock">
                {s.reagent.checked && s.calibration !== "success"
                  ? "UIBC 試劑已更換，請先完成校正。"
                  : `校正狀態：${s.calibration}`}
              </p>
              <RackRequisition
                d={{ rack: s.rack, setRack: () => {} }}
                notify={setNotice}
                canStart
                exam={exam}
                disabled={pending}
                combined
                onGuide={onRrGuide}
                onCombinedEntry={(selection, type) =>
                  act({ action: "batch-entry", data: { selection, type } })
                }
              />
              <div className="lis-toolbar">
                <button onClick={() => go("bench")}>前往備料與上機</button>
              </div>
            </div>
            <div hidden={workspace !== "management"}>
              <TroubleReagentManagement
                state={s}
                busy={pending}
                act={act}
                onGuide={!exam ? onManagementGuide : undefined}
              />
            </div>
            {workspace === "trace" && (
              <TraceForm
                s={s}
                busy={pending}
                act={act}
                networkFailure={networkFailure}
                onBrowse={onBrowse}
              />
            )}
            {workspace === "form" && (
              <IncidentForm
                s={s}
                busy={pending}
                exam={exam}
                act={act}
                onGuide={!exam ? onPhraseGuide : undefined}
              />
            )}
            {workspace === "sop" && <TroubleReferences />}
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
                  {s.log.map((r) => (
                    <tr key={r.seq}>
                      <td>{r.seq}</td>
                      <td>{r.action}</td>
                      <td>{r.target}</td>
                      <td>
                        {exam && !r.ok
                          ? "操作未完成，交卷後提供檢核。"
                          : r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        {workspace === "bench" && (
          <button
            className="trouble-bench-note-toggle"
            aria-expanded={benchNoteOpen}
            aria-controls="uibc-bench-note"
            hidden={exam}
            onClick={() => setBenchNoteOpen(!benchNoteOpen)}
          >
            {benchNoteOpen ? "收合備料小抄" : "備料小抄"}
          </button>
        )}
        {workspace === "bench" && (
          <section
            className="trouble-tools hud-card"
            aria-label="UIBC 備料操作"
          >
            <h2>CALI／QC 備料</h2>
            <p>分裝量、容器型號及正式架位待設定。原杯為杯1。</p>
            <div className="trouble-source-buttons">
              {troubleMaterialsV2.map((m) => (
                <button
                  key={m.id}
                  data-guide={`source-${m.id}`}
                  data-testid={`uibc-source-${m.id}`}
                  disabled={pending}
                  aria-pressed={s.preparation.source === m.id}
                  onClick={() => {
                    setSelection(null);
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
                ? catalogV2[s.preparation.pipette.materialId]?.name
                : "空"}
            </p>
            <label>
              容器{" "}
              <select
                data-guide="cup"
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
                    {c.materialId ? catalogV2[c.materialId]?.name : "空杯"}
                  </option>
                ))}
              </select>
            </label>
            <p>
              杯內：
              {selectedCup.materialId
                ? catalogV2[selectedCup.materialId]?.name
                : "空"}
              ／
              {selectedCup.rack
                ? `${selectedCup.rack} ${selectedCup.slot}`
                : "工作台"}
            </p>
            <div className="trouble-grid">
              {button("aspirate", "吸取來源液", () => void prep("aspirate"))}
              {button("dispense", "加入容器", () => void prep("dispense", cup))}
              {button(
                "discard-pipette",
                "清空移液器",
                () => void prep("discard-pipette"),
              )}
              {button("empty-cup", "清空容器", () => {
                if (window.confirm("清空此杯？歷史結果仍保留。"))
                  void prep("empty", cup);
              })}
            </div>
            <label>
              檢體架{" "}
              <select
                data-guide="rack"
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
                data-guide="slot"
                aria-label="UIBC 架位"
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}{" "}
                    {s.preparation.cups.some(
                      (c) => c.rack === rack && c.slot === i + 1,
                    )
                      ? "已占用"
                      : "空位"}
                  </option>
                ))}
              </select>
            </label>
            <div className="trouble-grid">
              {button(
                "place",
                "放入架位",
                () => void prep("place", cup, { rack, slot }),
              )}
              {button(
                "unrack",
                "容器取回工作台",
                () => void prep("unrack", cup),
              )}
              {button(
                "retrieve",
                "取回檢體架",
                () => void prep("retrieve", undefined, { rack }),
              )}
            </div>
            <fieldset className="trouble-batch">
              <legend>本次上機檢體架</legend>
              {(["RB", "CALI", "QC"] as const).map((k) => (
                <label key={k}>
                  <input
                    data-guide={`batch-${k}`}
                    type="checkbox"
                    aria-label={`本次上機 ${k}`}
                    checked={batches.includes(k)}
                    onChange={(e) =>
                      setBatches((v) =>
                        e.target.checked ? [...v, k] : v.filter((x) => x !== k),
                      )
                    }
                  />
                  {{ RB: "藍色 RB", CALI: "黃色 CALI", QC: "綠色 QC" }[k]}／
                  {
                    { bench: "工作台", entry: "進樣區", loaded: "已推入" }[
                      s.preparation.racks[k].location
                    ]
                  }
                </label>
              ))}
            </fieldset>
            <div className="trouble-grid">
              {button(
                "batch-stage",
                "放至進樣區",
                () => void batch("batch-stage"),
              )}
              {button("batch-push", "推入儀器", () => void batch("batch-push"))}
              {button(
                "batch-retrieve",
                "取回本次檢體架",
                () => void batch("batch-retrieve"),
              )}
              <button
                onClick={() =>
                  setView(view === "loading" ? "bench" : "loading")
                }
              >
                切換備料／進樣視角
              </button>
            </div>
          </section>
        )}
        {workspace === "reagent" && (
          <section
            className="trouble-tools hud-card"
            aria-label="UIBC 試劑操作"
          >
            <h2>UIBC 試劑準備與更換</h2>
            <div className="trouble-grid">
              {(["main", "R1", "R2"] as const).map((k) =>
                button(
                  `cover-${k}`,
                  `${s.covers?.[k] ? "關閉" : "打開"}${k === "main" ? "儀器" : k}上蓋`,
                  () =>
                    void act({
                      action: "cover",
                      target: k,
                      value: s.covers?.[k] ? "close" : "open",
                    }),
                ),
              )}
            </div>
            {button(
              "reagent-view",
              view === "reagent" ? "切換配製工作台" : "切換儲存槽",
              () => setView(view === "reagent" ? "bench" : "reagent"),
              false,
            )}
            <p>點選3D瓶身或下列物件，顯示該物件的操作。</p>
            <div className="trouble-source-buttons">
              {["old-R1", "old-R2", "R1a", "R2a", "new-R1", "new-R2"].map(
                (id) => (
                  <button
                    key={id}
                    data-guide={`object-${id}`}
                    aria-pressed={selection === `bottle:${id}`}
                    onClick={() => pick(`bottle:${id}`)}
                  >
                    {id.replace("old-", "舊 UIBC ").replace("new-", "新 UIBC ")}
                  </button>
                ),
              )}
            </div>
            <section className="trouble-context" aria-label="選取物件操作">
              <h3>
                {key
                  ? key.replace("old-", "舊 UIBC ").replace("new-", "新 UIBC ")
                  : "尚未選取物件"}
              </h3>
              {key.startsWith("old-") &&
                button(
                  "remove-old",
                  `取出舊 UIBC ${pair}`,
                  () => void act({ action: "remove-old", target: pair }),
                )}
              {key.endsWith("a") && (
                <div className="trouble-grid">
                  {(["R1", "R2"] as const).map((k) =>
                    button(
                      `pour-${k}`,
                      `加入 ${k}`,
                      () => void act({ action: "pour", target: k, value: key }),
                    ),
                  )}
                </div>
              )}
              {key.startsWith("new-") && (
                <>
                  <div className="trouble-grid">
                    {button(
                      "mix",
                      "混和均勻",
                      () => void act({ action: "mix", target: pair }),
                    )}
                    {button("install-open", "放入儀器", () => setInstall(true))}
                    {button(
                      "remove-new",
                      "取回新瓶",
                      () => void act({ action: "remove-new", target: pair }),
                    )}
                    {button("reset-reagent", "重新準備此新瓶", () => {
                      if (window.confirm("重新準備此新瓶？操作紀錄保留。"))
                        void act({ action: "reset-reagent", target: pair });
                    })}
                  </div>
                  {install && (
                    <>
                      <label>
                        儲存槽{" "}
                        <select
                          data-guide="bank"
                          aria-label="UIBC 目標儲存槽"
                          value={bank}
                          onChange={(e) => setBank(e.target.value)}
                        >
                          <option>R1</option>
                          <option>R2</option>
                        </select>
                      </label>
                      {button(
                        "install-confirm",
                        "確認放入儀器",
                        () =>
                          void (async () => {
                            if (
                              await act({
                                action: "install",
                                target: pair,
                                value: bank,
                              })
                            )
                              setInstall(false);
                          })(),
                      )}
                    </>
                  )}
                </>
              )}
            </section>
            <dl>
              {(["R1", "R2"] as const).map((k) => (
                <div key={k}>
                  <dt>{k}儲存槽</dt>
                  <dd>
                    {s.reagent.slots[k] || "空槽"} · 加入{" "}
                    {s.reagent.mix[k].source || "尚未加入"} ·{" "}
                    {s.reagent.mix[k].mixed ? "已混和均勻" : "未混勻"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="lis-inline">
              Reagent Check：
              {s.reagent.checked
                ? manualTroubleCheck(s)
                  ? "手動檢查成功；需校正"
                  : "自動檢查成功；需校正"
                : "尚未完成"}
            </p>
            <details>
              <summary>UIBC 試劑瓶實拍參考</summary>
              <img
                className="lis-reference"
                src={asset("real-photos/UIBC試劑瓶.jpg")}
                alt="UIBC瓶身外觀參考"
              />
            </details>
          </section>
        )}
      </main>
      <aside
        className={`trouble-hud hud-card ${collapsed ? "collapsed" : ""}`}
        aria-label="UIBC 任務資訊"
      >
        {!exam && workspace === "bench" && benchNoteOpen && (
          <section
            id="uibc-bench-note"
            className="trouble-bench-note"
            aria-label="本次備料小抄"
          >
            <h2>本次操作小抄</h2>
            {!s.runs.original ? (
              <>
                <p>將原杯 {catalogV2["uibc-primary"].name} 品管液重新上機。</p>
                <p>使用杯 1 原杯，裝入綠色 QC 架，放至進樣區後推入儀器。</p>
              </>
            ) : s.runs.final ? (
              <p>
                {requiresQcConfirmation(s) && !s.qcRecovered
                  ? "兩濃度 QC 已執行；請返回 L-J 圖核對允收範圍並確認判讀，再進行檢體回溯。"
                  : "本次校正與兩濃度 QC 已執行；可查看結果並繼續檢體回溯。"}
              </p>
            ) : (
              <>
                <p>
                  本次上機需要：
                  {troubleBatchRequirements
                    .map(([id]) => catalogV2[id].name)
                    .join("、")}
                  。
                </p>
                <ul>
                  {troubleBatchRequirements.map(([id, kind]) => (
                    <li key={id}>
                      {catalogV2[id].name} →{" "}
                      {
                        {
                          RB: "藍色 RB 架",
                          CALI: "黃色 CALI 架",
                          QC: "綠色 QC 架",
                        }[kind]
                      }
                    </li>
                  ))}
                </ul>
                <p>
                  先完成 UIBC 試劑更換與 Reagent Check，再於 Rack Requisition
                  登記 RB、Cal.、QC。選取來源 → 吸取 → 加入空杯 →
                  裝架；選取三架，放至進樣區後同批推入。
                </p>
                <p>兩濃度 QC 請重新分裝至空杯，不沿用杯 1 原杯。</p>
              </>
            )}
            <p className="trouble-gold-key">
              金色外框＝杯內已有液體；不代表來源、架色或上機判定正確。分裝量與正式架位仍待設定。
            </p>
          </section>
        )}
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
                  : `步驟 ${step + 1}／12`}
            </h2>
            <p className="trouble-warning">
              UIBC 常規病患檢體測試：暫停。僅允許本情境受控回溯。
            </p>
            {s.reagent.checked && s.calibration !== "success" && (
              <p className="trouble-interlock">
                UIBC 試劑已更換，請先完成校正。
              </p>
            )}
            {s.qcRecovered && <p>QC恢復，回溯／填報待完成。</p>}
            {s.submission === "sent-awaiting-review" && (
              <strong>已呈送，待審核／待主管審核／允收</strong>
            )}
            {!exam && (
              <>
                <p className="trouble-hint" aria-live="polite">
                  {next?.text ||
                    (pending
                      ? moving
                        ? "試劑瓶取放中，請稍候。"
                        : "模擬執行或保存中，請稍候。"
                      : "本次訓練操作完成；呈送不代表主管核准。")}
                </p>
                <button onClick={locate}>定位目前操作</button>
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
              <p>可主動查看原始結果、標籤與SOP，作答中不顯示檢核明細。</p>
            )}
            <p role={networkFailure ? "alert" : "status"}>
              {busy
                ? "保存中…"
                : moving
                  ? "試劑瓶取放中…"
                  : s.pending
                    ? "模擬執行中…"
                    : feedback || notice || "操作驅動進度；資料均為教學模擬。"}
            </p>
            {onRetry && button("retry", retryLabel, onRetry, busy)}
            <button onClick={() => go("log")}>檢視操作紀錄</button>
            <button onClick={() => go("sop")}>查看 SOP</button>
            {onReset &&
              button(
                "restart",
                "重新開始本情境",
                () => {
                  if (window.confirm("重新開始UIBC情境？其他任務不受影響。"))
                    onReset();
                },
                false,
              )}
          </>
        )}
      </aside>
    </section>
  );
}
