import { AnalyzerStatusSurface } from "./AnalyzerStatusSurface";
import { StartCondition, Calibration, ProbePractice } from "./DailyTraining";
import { MaintenanceSurface } from "./MaintenanceSurface";
import {
  hasDailyIseDrain,
  hasRevisedWorkstation,
  hasPreparation,
  canHandleBottle,
} from "../shared/dailyScenario";
import { PartInformation } from "./SimulatorHud";
import { DailyTasksPanel } from "./DailyTasksPanel";
import { canRunIseProgram } from "../shared/dailyScenario";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Box, Plus, Minus, RotateCcw, Flag } from "lucide-react";
import Viewer, { type CameraRequest, type SceneSelection } from "./Viewer";
import PreparationPanel from "./PreparationPanel";
import { preparationViews, type PreparationView } from "./preparationModel";
import { api, ApiError } from "./examApi";
import {
  kindNames,
  type Attempt,
  type ExamCommand,
  type Simulation,
} from "../shared/exam";
import {
  dailyProbes,
  detailedProbes,
  mixerIds,
  syringeIds,
  w2Positions,
  probeOperationNames,
  type ProbeOperation,
} from "../shared/maintenance";
import {
  slotById,
  slotCamera,
  washSlots,
  fluidNames,
  type Fluid,
} from "./detergents";
import { closedDoors } from "./enclosures";
import { partById, views, asset, type PartId } from "./data";
import { analyzerFooter, iseFooter, mainMenu } from "./workstationData";
import RackRequisition from "./RackRequisition";
import { ExamReagentManagement } from "./ReagentManagement";
import { calibrationNeeds } from "../shared/dailyScenario";
import type { WeeklyVisual } from "./weeklyModel";

type Source = "model" | "workstation";
type Dispatch = (command: ExamCommand, source?: Source) => Promise<boolean>;
const cups = ["S-H", "S-L", "U-H", "U-L"];
function resultSelect(
  label: string,
  value: string,
  change: (value: string) => void,
  disabled: boolean,
) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={disabled}
      >
        <option value="">未記錄</option>
        <option>正常</option>
        <option>異常</option>
      </select>
    </label>
  );
}
const probeProgress = (s: Simulation, id: string) => {
  const p = s.probes[id];
  if (!p.installed)
    return p.operation === "wire" ? 5 : p.operation === "wipe" ? 4 : 3;
  if (p.locked) return p.operation ? 7 : 0;
  return p.operation === "install" ? 6 : p.drained ? 2 : 1;
};

export default function ExamRoom({
  initial,
  onUpdate,
  onFinished,
  onAbandon,
  onSessionExpired,
}: {
  initial: Attempt;
  onUpdate: (a: Attempt) => void;
  onFinished: (a: Attempt) => void;
  onAbandon: () => void;
  onSessionExpired?: () => void;
}) {
  const [attempt, setAttempt] = useState(initial),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState(""),
    [pending, setPending] = useState(false);
  const current = useRef(attempt),
    lock = useRef(false);
  const polling = useRef(false);
  current.current = attempt;
  const [place, setPlace] = useState<Source>("model"),
    [view, setView] = useState("儀器"),
    [target, setTarget] = useState(
      initial.kind === "weekly" ? "Sample-1" : "R1-1",
    );
  const [selected, setSelected] = useState<PartId>("overview"),
    [selectedSlot, setSelectedSlot] = useState<string | null>(null),
    [request, setRequest] = useState<CameraRequest>({ ...views[0], serial: 0 }),
    [zoom, setZoom] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<SceneSelection | null>(
    null,
  );
  const [panelOpen, setPanelOpen] = useState(true),
    [infoTab, setInfoTab] = useState<"actions" | "info" | "photo">("actions");
  const [confirm, setConfirm] = useState<"submit" | "abandon" | null>(null),
    [now, setNow] = useState(Date.now());
  const confirmDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirm && !confirmDialog.current?.open)
      confirmDialog.current?.showModal();
    else if (!confirm) confirmDialog.current?.close();
  }, [confirm]);
  const retry = useRef<{
    path: string;
    body: unknown;
    finish?: "submit" | "abandon";
  } | null>(null);
  const [hasRetry, setHasRetry] = useState(false);
  const [qcSavedVersion, setQcSavedVersion] = useState(0);
  const [preparationView, setPreparationView] =
    useState<PreparationView | null>(null);
  const [rackNavigation, setRackNavigation] = useState(0);
  const accept = useCallback(
    (a: Attempt) => {
      current.current = a;
      setAttempt(a);
      onUpdate(a);
    },
    [onUpdate],
  );
  async function send(requestData: NonNullable<typeof retry.current>) {
    if (lock.current) return false;
    const before = current.current;
    const command = (requestData.body as { command?: ExamCommand }).command;
    // Reflect checkbox input immediately; the server response remains authoritative.
    if (command) {
      const sim = { ...before.sim };
      if (command.type === "maintenance" && typeof command.value === "boolean")
        if (sim.instrument)
          sim.instrument = {
            ...sim.instrument,
            [command.target === "ise"
              ? "iseMaintenance"
              : "analyzerMaintenance"]: command.value,
          };
        else sim.maintenance = command.value;
      if (command.type === "lid" && typeof command.value === "boolean")
        sim.lid = command.value;
      if (
        command.type === "cover" &&
        sim.instrument &&
        typeof command.value === "boolean"
      )
        sim.instrument = {
          ...sim.instrument,
          [command.target!]: command.value,
        };
      if (command.type === "prepared" && typeof command.value === "boolean")
        sim.prepared = command.value;
      if (command.type === "w2-options") {
        sim.photo = !!command.data?.photo;
        sim.enhanced = !!command.data?.enhanced;
      }
      if (command.type === "cal-review" && sim.cal.serum && sim.cal.urine)
        sim.cal = { ...sim.cal, checked: true };
      setAttempt({ ...before, sim });
    }
    lock.current = true;
    setPending(true);
    setFailure("");
    setMessage("");
    retry.current = requestData;
    try {
      const response = await api<{
        attempt: Attempt;
        message?: string;
        applied?: boolean;
      }>(requestData.path, { method: "POST", body: requestData.body });
      retry.current = null;
      setHasRetry(false);
      setConfirm(null);
      if (requestData.finish === "abandon") onAbandon();
      else if (requestData.finish === "submit") onFinished(response.attempt);
      else {
        accept(response.attempt);
        if (command?.type === "rack-qc-entry" && response.applied !== false)
          setQcSavedVersion(response.attempt.revision);
        setMessage(response.message || "操作已保存。");
      }
      return response.applied !== false;
    } catch (error) {
      setAttempt(before);
      current.current = before;
      setFailure((error as Error).message);
      setHasRetry(true);
      if (error instanceof ApiError && error.status === 401)
        onSessionExpired?.();
      if (error instanceof ApiError && error.status === 409) {
        retry.current = null;
        setHasRetry(false);
        try {
          const { attempt: latest } = await api<{ attempt: Attempt }>(
            `/attempts/${current.current.id}`,
          );
          if (latest.status === "active") accept(latest);
          else if (latest.status === "submitted") onFinished(latest);
          else onAbandon();
        } catch {}
      }
      return false;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const dispatch: Dispatch = (command, source = place) => {
    if (lock.current || retry.current) return Promise.resolve(false);
    return send({
      path: `/attempts/${current.current.id}/events`,
      body: {
        id: crypto.randomUUID(),
        revision: current.current.revision,
        source,
        command,
      },
    });
  };
  const s = attempt.sim;
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      const a = current.current;
      if (
        !lock.current &&
        !retry.current &&
        !polling.current &&
        (a.sim.batch || a.sim.phase === "w2" || a.sim.phase === "photocal")
      ) {
        polling.current = true;
        void api<{ attempt: Attempt }>(`/attempts/${a.id}`)
          .then(({ attempt: latest }) => {
            if (
              !lock.current &&
              !retry.current &&
              latest.revision >= current.current.revision
            ) {
              accept(latest);
              setFailure("");
            }
          })
          .catch((e) => {
            if (!lock.current) setFailure(e.message);
          })
          .finally(() => {
            polling.current = false;
          });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [accept]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (lock.current || retry.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function focus(id: string) {
    setTarget(id);
    if (slotById[id]) {
      setView("瓶槽");
      setSelectedSlot(id);
      setSelected(slotById[id].module);
      setSelectedDetail({ partId: slotById[id].module, slotId: id });
      setRequest((r) => ({ ...slotCamera(id), serial: r.serial + 1 }));
      return;
    }
    setSelectedSlot(null);
    if (
      [
        "rear-syringes",
        "ise-reagents",
        "ise-reference",
        "ise-internal",
      ].includes(id)
    ) {
      const part = id as PartId;
      setSelected(part);
      setSelectedDetail({ partId: part });
      setRequest((r) => ({
        eye: partById[part].eye,
        target: partById[part].target,
        serial: r.serial + 1,
      }));
      return;
    }
    let part: PartId =
      id === "syringes"
        ? "syringes"
        : id === "ISE" || id === "diag-ise"
          ? "ise"
          : cups.includes(id)
            ? "ise-cups"
            : id.startsWith("Sample") || id === "diag-sample"
              ? "sample"
              : id.startsWith("group-") ||
                  id.startsWith("well-") ||
                  id === "左側" ||
                  id === "右側" ||
                  id === "diag-front"
                ? "mixing"
                : id.startsWith("R1")
                  ? "r1"
                  : id.startsWith("R2")
                    ? "r2"
                    : "overview";
    setSelected(part);
    setSelectedDetail({ partId: part, weeklyId: id });
    setRequest((r) => ({
      eye: partById[part].eye,
      target: partById[part].target,
      serial: r.serial + 1,
    }));
    if (id.startsWith("group-") || id.startsWith("well-")) {
      const x = id.includes("R2") ? 1.115 : 0.426,
        z = id.includes("R2") ? -0.17 : -0.29;
      setRequest((r) => ({
        eye: [
          x,
          view === "孔洞清潔" || id.startsWith("well-") ? 1.42 : 1.3,
          z - 0.32,
        ],
        target: [x, 0.99, z],
        serial: r.serial + 1,
      }));
    }
    if (id === "ISE")
      setRequest((r) => ({
        eye: [-0.4, 1.48, -1.05],
        target: [-0.04, 1.09, -0.44],
        serial: r.serial + 1,
      }));
  }
  function modelClick(id: string) {
    if (id.startsWith("lock-")) {
      const probe = id.slice(5);
      focus(probe);
      dispatch(
        {
          type: "probe",
          target: probe,
          value: s.probes[probe].locked ? "unlock" : "lock",
        },
        "model",
      );
      return;
    }
    if (id.startsWith("well-")) {
      setTarget(id);
      setSelectedDetail({ partId: "mixing", weeklyId: id });
      dispatch({ type: "well", target: id }, "model");
      return;
    }
    if (id.startsWith("group-")) {
      focus(id);
      dispatch({ type: "group", target: id.slice(6) }, "model");
      return;
    }
    if (id.startsWith("diag-")) {
      dispatch({ type: "diag", target: id.slice(5) }, "model");
      return;
    }
    focus(id.replace(/^(lock|tip)-/, ""));
  }
  const weekly: WeeklyVisual | undefined =
    attempt.kind === "weekly"
      ? {
          exam: true,
          probeStates: s.probes,
          target,
          view,
          lid: s.lid,
          iseTop: s.instrument?.iseTop ?? s.lid,
          progress: Object.fromEntries([
            ...detailedProbes.map((id) => [id, probeProgress(s, id)]),
            ...mixerIds.map((id) => [id, s.mixers.includes(id) ? 3 : 0]),
          ]),
          wells: s.wells,
          lastWell: s.lastWell,
          swabReady: s.swab,
          cup: s.cup === "full" || s.cup === "used",
          batch: s.batch,
          batchGroup: s.batchGroup,
          diag: s.diag,
          pendingDiag: "",
          busy: !!s.batch || s.phase === "w2" || s.phase === "photocal",
        }
      : undefined;
  const disabled = pending || hasRetry;
  const elapsed = Math.max(0, Math.floor((now - attempt.startedAt) / 1000));
  function finish(operation: "submit" | "abandon") {
    void send({
      path: `/attempts/${attempt.id}/${operation}`,
      body: { revision: attempt.revision },
      finish: operation,
    });
  }
  return (
    <section
      className="exam-room"
      data-preparation={!!preparationView}
      aria-label={`${kindNames[attempt.kind]}考試`}
    >
      <header className="exam-room-toolbar" hidden={place === "workstation"}>
        <strong>{kindNames[attempt.kind]}測驗</strong>
        <span>
          經過 {Math.floor(elapsed / 60)}:
          {String(elapsed % 60).padStart(2, "0")}
        </span>
        <button
          onClick={() => setPlace("model")}
          aria-pressed={place === "model"}
        >
          <Box size={17} />
          到模型操作
        </button>
        <button
          onClick={() => setPlace("workstation")}
          aria-pressed={place === "workstation"}
        >
          <Monitor size={17} />
          工作站
        </button>
        <div className="exam-toolbar-spacer" />
        {s.preparation && (
          <button
            onClick={() => {
              setPreparationView("bench");
              setPlace("model");
            }}
          >
            備料工作台
          </button>
        )}
        <button disabled={disabled} onClick={() => setConfirm("abandon")}>
          放棄本次
        </button>
        <button
          className="exam-primary"
          disabled={disabled}
          onClick={() => setConfirm("submit")}
        >
          <Flag size={17} />
          完成
        </button>
      </header>
      {(failure || message) && (
        <div
          className={
            failure ? "exam-error exam-save-status" : "exam-save-status"
          }
          hidden={place === "workstation"}
          role={failure ? "alert" : "status"}
        >
          {failure || message}
          {hasRetry && (
            <button
              disabled={pending}
              onClick={() => retry.current && void send(retry.current)}
            >
              重試保存
            </button>
          )}
        </div>
      )}
      <section
        className="exam-quest-summary hud-card"
        aria-label="考試目標與進度"
      >
        <strong>考試模式 · {kindNames[attempt.kind]}</strong>
        <p>完成本次儀器保養與必要登記。</p>
        <span>
          完成組數 {attempt.progress?.completedGroups ?? "—"}／
          {attempt.progress?.totalGroups ?? "—"}
        </span>
        <small>作答中不顯示檢核明細與答案提示</small>
      </section>
      <div className="exam-model-layout">
        <div className="exam-model-stage model-stage">
          <Viewer
            preparation={
              preparationView && s.preparation
                ? {
                    state: s.preparation,
                    gate: attempt.preparationAccess || {
                      ready: false,
                      token: "",
                    },
                    view: preparationView,
                    exam: true,
                  }
                : undefined
            }
            onPreparationSelect={(id) => {
              if (!disabled)
                void dispatch({
                  type: "preparation",
                  data: { action: "select", target: id },
                });
            }}
            suspended={place === "workstation"}
            topInset={125}
            rightInset={panelOpen ? Math.min(innerWidth * 0.25, 360) : 0}
            selection={selectedDetail}
            onClear={() => {
              setSelected("overview");
              setSelectedDetail(null);
              setPanelOpen(false);
            }}
            onInspect={(hit) => {
              if (hit.partId === "console") {
                setPlace("workstation");
                return;
              }
              setSelected(hit.partId);
              setSelectedDetail(hit);
              setPanelOpen(true);
              if (hit.slotId) {
                setSelectedSlot(hit.slotId);
                setTarget(hit.slotId);
                setView("瓶槽");
              } else if (hit.dailyId) {
                setTarget(hit.dailyId);
                setView(
                  cups.includes(hit.dailyId)
                    ? "CLEAN"
                    : ["左側", "右側"].includes(hit.dailyId)
                      ? "攪拌棒"
                      : "探針",
                );
              } else if (hit.weeklyId) {
                const id = hit.weeklyId.replace(/^(lock|tip)-/, "");
                setTarget(id);
                setView(
                  id.startsWith("well-")
                    ? "孔洞清潔"
                    : id.startsWith("group-")
                      ? "攪拌棒"
                      : "探針",
                );
              } else if (
                hit.partId === "ise-reagents" ||
                hit.partId === "ise-reference"
              )
                setView("ISE 試劑");
              else if (hit.partId.includes("syringes")) setView("syringes");
              setInfoTab("actions");
            }}
            daily={{
              active: true,
              mode: s.dailyMode,
              wiped: s.wiped,
              cleanCup: s.cup,
              drops: s.drops,
            }}
            weekly={weekly}
            onWeeklySelect={modelClick}
            practice={attempt.kind === "daily"}
            practiceTarget={selected === "overview" ? "" : target}
            onPracticeSelect={focus}
            doorState={{
              ...closedDoors,
              "ise-top": s.instrument?.iseTop ?? s.lid,
              "ise-top-rear": s.instrument?.iseTop ?? s.lid,
              "ise-middle": !!s.instrument?.iseReagents,
              "ise-bottom": !!s.instrument?.iseReference,
              "syringe-front": s.dailyTasks
                ? !!s.instrument?.frontSyringe
                : s.lid,
              "syringe-rear": !!s.instrument?.rearSyringe,
            }}
            iseState={{ open: s.instrument?.iseModule ?? s.lid, removed: [] }}
            selected={selected}
            internal={s.instrument?.mainLid ?? s.lid}
            labels={true}
            request={request}
            onSelect={(id) => {
              if (id === "console") {
                setPlace("workstation");
                return;
              }
              setSelected(id);
              setSelectedDetail(null);
              setPanelOpen(true);
            }}
            zoom={zoom}
            onReady={() => {}}
            onError={() => {}}
            bottles={s.bottles}
            selectedSlot={selectedSlot}
            onSlot={focus}
          />
          <div className="exam-view-tools" hidden={place !== "model"}>
            {views.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelected("overview");
                  setRequest((r) => ({ ...v, serial: r.serial + 1 }));
                }}
              >
                {v.label}
              </button>
            ))}
            <button
              aria-label="放大考試模型"
              onClick={() => setZoom((z) => z + 1)}
            >
              <Plus size={17} />
            </button>
            <button
              aria-label="縮小考試模型"
              onClick={() => setZoom((z) => z - 1)}
            >
              <Minus size={17} />
            </button>
            <button
              aria-label="重設考試視角"
              onClick={() =>
                setRequest((r) => ({ ...(preparationView ? preparationViews[preparationView] : views[0]), serial: r.serial + 1 }))
              }
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        <aside
          className="exam-model-panel"
          aria-label="考試模型工具"
          hidden={!panelOpen || place !== "model"}
        >
          <header className="hud-card-header">
            <strong>部件操作</strong>
            <button
              aria-label="收合考試部件資訊"
              onClick={() => setPanelOpen(false)}
            >
              −
            </button>
          </header>
          <nav className="hud-info-tabs">
            {(
              [
                ["actions", "操作"],
                ["info", "認識"],
                ["photo", "實機照片"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={infoTab === id}
                onClick={() => setInfoTab(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          {infoTab !== "actions" && (
            <PartInformation
              part={partById[selected]}
              tab={infoTab}
              detail={
                selectedDetail?.weeklyId ||
                selectedDetail?.dailyId ||
                (selectedDetail?.slotId
                  ? slotById[selectedDetail.slotId]?.label
                  : undefined)
              }
              photoSelection={{
                targetId: selectedDetail?.weeklyId || selectedDetail?.dailyId,
                slotId: selectedDetail?.slotId,
              }}
            />
          )}
          <div hidden={infoTab !== "actions"}>
            <nav className="exam-tool-tabs">
              {(attempt.kind === "weekly"
                ? [
                    "儀器",
                    "syringes",
                    "探針",
                    "攪拌棒",
                    "孔洞清潔",
                    "瓶槽",
                    "CLEAN",
                    "Diluent",
                  ]
                : [
                    "儀器",
                    "探針",
                    "攪拌棒",
                    "CLEAN",
                    "校正杯",
                    "瓶槽",
                    ...(s.dailyTasks ? ["syringes", "ISE 試劑"] : []),
                  ]
              ).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => {
                    setView(v);
                    if (v === "syringes") focus("syringes");
                    if (v === "探針")
                      focus(attempt.kind === "weekly" ? "Sample-1" : "R1-1");
                    if (v === "孔洞清潔" || v === "攪拌棒") focus("group-R1S");
                    if (v === "CLEAN") focus("U-L");
                  }}
                >
                  {v}
                </button>
              ))}
            </nav>
            <InstrumentControls
              s={s}
              dispatch={dispatch}
              disabled={disabled}
              weekly={attempt.kind === "weekly"}
            />
            {view === "syringes" && !s.dailyTasks && (
              <div className="exam-controls">
                <h3>四支 syringe</h3>
                {syringeIds.map((id) => (
                  <div key={id}>
                    <button onClick={() => focus("syringes")}>{id}</button>
                    {resultSelect(
                      `${id} 水氣檢查`,
                      s.syringes[id] || "",
                      (value) =>
                        dispatch({ type: "syringe", target: id, value }),
                      disabled,
                    )}
                  </div>
                ))}
              </div>
            )}
            {s.dailyTasks && (view === "syringes" || view === "ISE 試劑") && (
              <DailyTasksPanel
                tasks={s.dailyTasks}
                instrument={s.instrument!}
                bottles={s.bottles}
                disabled={disabled}
                section={view === "syringes" ? "syringes" : "ise"}
                command={dispatch}
                cover={(target, value) =>
                  dispatch({ type: "cover", target, value })
                }
                refill={(id) =>
                  dispatch({ type: "bottle", target: id, value: "refill" })
                }
                focus={focus}
              />
            )}
            {view === "探針" && (
              <ProbeControls
                s={s}
                dispatch={dispatch}
                disabled={disabled}
                kind={attempt.kind}
                allowIseDrain={hasDailyIseDrain(attempt.version)}
                target={target}
                focus={focus}
              />
            )}
            {view === "攪拌棒" && (
              <MixerControls
                s={s}
                dispatch={dispatch}
                disabled={disabled}
                weekly={attempt.kind === "weekly"}
                focus={focus}
              />
            )}
            {view === "孔洞清潔" && (
              <div className="exam-controls">
                <h3>mixer bar 下方孔洞</h3>
                <button
                  disabled={disabled}
                  onClick={() => dispatch({ type: "swab" })}
                >
                  棉棒沾取 Cleaning Solution
                </button>
                <div className="exam-inline">
                  <button onClick={() => focus("group-R1S")}>右側 R1／S</button>
                  <button onClick={() => focus("group-R2")}>左側 R2</button>
                </div>
                <div className="exam-hole-buttons">
                  {mixerIds
                    .filter((id) =>
                      id.startsWith(target.includes("R2") ? "R2-" : "R1S-"),
                    )
                    .map((id) => (
                      <button
                        key={id}
                        disabled={disabled}
                        onClick={() => {
                          focus(`well-${id}`);
                          dispatch({ type: "well", target: `well-${id}` });
                        }}
                      >
                        {id}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {(view === "CLEAN" || view === "校正杯") && (
              <CupControls
                s={s}
                dispatch={dispatch}
                disabled={disabled}
                daily={attempt.kind === "daily"}
                focus={focus}
              />
            )}
            {view === "瓶槽" && (
              <BottleControls
                version={attempt.version}
                s={s}
                dispatch={dispatch}
                disabled={disabled}
                focus={focus}
                selected={selectedSlot}
                weekly={attempt.kind === "weekly"}
              />
            )}
            {view === "Diluent" && (
              <div className="exam-controls">
                <h3>Diluent</h3>
                {["r1-inner-3", "r1-outer-3"].map((id) => (
                  <div key={id}>
                    <button onClick={() => focus(id)}>
                      {slotById[id].label}
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        dispatch({ type: "diluent-clean", target: id })
                      }
                    >
                      依科內 SOP 完成清潔：{slotById[id].label}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        {!panelOpen && (
          <button
            className="exam-panel-restore"
            onClick={() => setPanelOpen(true)}
          >
            展開部件操作
          </button>
        )}
      </div>
      {preparationView && s.preparation && (
        <div hidden={place !== "model"}>
          <PreparationPanel
            state={s.preparation}
            gate={attempt.preparationAccess || { ready: false, token: "" }}
            exam
            disabled={disabled || place !== "model"}
            feedback={failure || message}
            view={preparationView}
            onView={(view) => {
              setPreparationView(view);
              setRequest((r) => ({ ...preparationViews[view], serial: r.serial + 1 }));
            }}
            onClose={() => setPreparationView(null)}
            onComputer={() => {
              setRackNavigation((n) => n + 1);
              setPlace("workstation");
            }}
            onAction={(a) => dispatch({ type: "preparation", data: { ...a } })}
          />
        </div>
      )}
      <div
        className="exam-workstation-overlay"
        tabIndex={-1}
        hidden={place !== "workstation"}
        role="dialog"
        aria-label="考試操作工作站"
        onKeyDown={(e) => {
          if (e.key !== "Escape" || e.defaultPrevented) return;
          e.preventDefault();
          e.stopPropagation();
          if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
          ) {
            e.target.blur();
            e.currentTarget.focus();
            return;
          }
          setPlace("model");
        }}
      >
        <ExamWorkstation
          rackNavigation={rackNavigation}
          qcSavedVersion={qcSavedVersion}
          sessionHud={
            <>
              <span>
                考試模式 · 經過 {Math.floor(elapsed / 60)}:
                {String(elapsed % 60).padStart(2, "0")} · 完成組數{" "}
                {attempt.progress?.completedGroups ?? "—"}／
                {attempt.progress?.totalGroups ?? "—"}
              </span>
              <span role={failure ? "alert" : "status"}>
                {pending ? "保存中…" : failure || message || "已保存"}
              </span>
              {hasRetry && (
                <button
                  disabled={pending}
                  onClick={() => retry.current && void send(retry.current)}
                >
                  重試保存
                </button>
              )}
              <button disabled={disabled} onClick={() => setConfirm("abandon")}>
                放棄本次
              </button>
              {s.preparation && (
                <button
                  onClick={() => {
                    setPlace("model");
                    setPreparationView("bench");
                  }}
                >
                  備料工作台
                </button>
              )}
              <button disabled={disabled} onClick={() => setConfirm("submit")}>
                完成
              </button>
            </>
          }
          attempt={attempt}
          dispatch={dispatch}
          disabled={disabled}
          onModel={(id) => {
            setPlace("model");
            if (id) {
              setView(
                id === "rear-syringes" || id === "syringes"
                  ? "syringes"
                  : id === "ise-reagents" || id === "ise-reference"
                    ? "ISE 試劑"
                    : slotById[id]
                      ? "瓶槽"
                      : id.startsWith("group-")
                        ? "攪拌棒"
                        : cups.includes(id)
                          ? "CLEAN"
                          : "探針",
              );
              focus(id);
            }
          }}
          now={now}
        />
      </div>
      {confirm && (
        <dialog
          ref={confirmDialog}
          className="exam-confirm-backdrop"
          onCancel={(e) => {
            e.preventDefault();
            if (!pending) setConfirm(null);
          }}
        >
          <section
            role="alertdialog"
            aria-label={confirm === "submit" ? "確認交卷" : "確認放棄"}
            className="exam-card"
          >
            <h2>
              {confirm === "submit" ? "確定交卷？" : "確定放棄本次考試？"}
            </h2>
            <p>
              {confirm === "submit"
                ? "交卷後不能修改本次紀錄。"
                : "放棄後不能繼續本次考試，紀錄不納入成績比較。"}
            </p>
            <button disabled={disabled} onClick={() => setConfirm(null)}>
              取消
            </button>
            <button
              className="exam-primary"
              disabled={disabled}
              onClick={() => finish(confirm)}
            >
              {pending
                ? "保存中…"
                : confirm === "submit"
                  ? "確認交卷"
                  : "確認放棄"}
            </button>
          </section>
        </dialog>
      )}
    </section>
  );
}

function InstrumentControls({
  s,
  dispatch,
  disabled,
  weekly,
  modes = true,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
  weekly: boolean;
  modes?: boolean;
}) {
  if (s.instrument)
    return (
      <fieldset className="exam-controls">
        <legend>儀器狀態</legend>
        {(modes
          ? ([
              ["analyzerMaintenance", "Analyzer Maintenance", "analyzer"],
              ["iseMaintenance", "ISE Maintenance", "ise"],
            ] as const)
          : []
        ).map(([key, label, target]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={!!s.instrument![key]}
              disabled={disabled}
              onChange={(e) =>
                dispatch({
                  type: "maintenance",
                  target,
                  value: e.target.checked,
                })
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
              checked={!!s.instrument![key]}
              disabled={disabled}
              onChange={(e) =>
                dispatch({
                  type: "cover",
                  target: key,
                  value: e.target.checked,
                })
              }
            />
            {label}
          </label>
        ))}
        {s.dailyTasks && (
          <div className="cabinet-toggles">
            {(
              [
                ["frontSyringe", "front", "前方"],
                ["rearSyringe", "rear", "後方"],
              ] as const
            ).map(([key, id, label]) => (
              <button
                key={key}
                data-testid={`exam-${id}-syringe-toggle`}
                disabled={disabled}
                aria-pressed={!!s.instrument![key]}
                onClick={() =>
                  dispatch({
                    type: "cover",
                    target: key,
                    value: !s.instrument![key],
                  })
                }
              >
                {s.instrument![key] ? "關閉" : "開啟"}
                {label} syringe 櫃門
              </button>
            ))}
          </div>
        )}
        {weekly && (
          <label>
            <input
              type="checkbox"
              checked={s.prepared}
              disabled={disabled}
              onChange={(e) =>
                dispatch({ type: "prepared", value: e.target.checked })
              }
            />
            預熱／待機與工具準備
          </label>
        )}
      </fieldset>
    );
  return (
    <fieldset className="exam-controls">
      <legend>儀器狀態</legend>
      <label>
        <input
          type="checkbox"
          checked={s.maintenance}
          disabled={disabled}
          onChange={(e) =>
            dispatch({ type: "maintenance", value: e.target.checked })
          }
        />
        Analyzer／ISE Maintenance
      </label>
      <label>
        <input
          type="checkbox"
          checked={s.lid}
          disabled={disabled}
          onChange={(e) => dispatch({ type: "lid", value: e.target.checked })}
        />
        主蓋開啟
      </label>
      {weekly && (
        <label>
          <input
            type="checkbox"
            checked={s.prepared}
            disabled={disabled}
            onChange={(e) =>
              dispatch({ type: "prepared", value: e.target.checked })
            }
          />
          確認預熱／待機與工具準備
        </label>
      )}
    </fieldset>
  );
}
function ProbeControls({
  s,
  dispatch,
  disabled,
  kind,
  allowIseDrain = false,
  target,
  focus,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
  kind: Attempt["kind"];
  allowIseDrain?: boolean;
  target: string;
  focus: (id: string) => void;
}) {
  const ids =
      kind === "weekly"
        ? detailedProbes
        : allowIseDrain
          ? [...dailyProbes, "ISE"]
          : dailyProbes,
    id = ids.includes(target) ? target : ids[0];
  return (
    <div className="exam-controls">
      <h3>探針</h3>
      <div className="exam-inline">
        {ids.map((x) => (
          <button key={x} aria-pressed={x === id} onClick={() => focus(x)}>
            {x}
          </button>
        ))}
      </div>
      <h4>{id}</h4>
      {kind === "weekly" ? (
        <>
          <div className="exam-action-grid">
            {(
              Object.entries(probeOperationNames) as [ProbeOperation, string][]
            ).map(([operation, label]) => (
              <button
                key={operation}
                disabled={disabled}
                onClick={() =>
                  dispatch({ type: "probe", target: id, value: operation })
                }
              >
                {label}
              </button>
            ))}
          </div>
          {resultSelect(
            `${id} 直線排水檢查`,
            s.drains[id] || "",
            (value) => dispatch({ type: "drain-result", target: id, value }),
            disabled,
          )}
        </>
      ) : id === "ISE" ? (
        <>
          {resultSelect(
            "ISE 直線排水檢查",
            s.drains.ISE || "",
            (value) => {
              void dispatch({ type: "drain-result", target: "ISE", value });
            },
            disabled,
          )}
          <p>Replace Sample Probe · DIAG 設定位於操作工作站。</p>
        </>
      ) : (
        <>
          <button
            disabled={disabled}
            onClick={() => dispatch({ type: "daily-wipe", target: id })}
          >
            酒精棉擦拭 tip
          </button>
          {resultSelect(
            `${id} 排水`,
            s.dailyDrains[id] || "",
            (value) => dispatch({ type: "daily-drain", target: id, value }),
            disabled,
          )}
        </>
      )}
    </div>
  );
}
function MixerControls({
  s,
  dispatch,
  disabled,
  weekly,
  focus,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
  weekly: boolean;
  focus: (id: string) => void;
}) {
  return (
    <div className="exam-controls">
      <h3>mixer bar</h3>
      {weekly ? (
        <>
          {["R1S", "R2"].map((id) => (
            <div className="exam-control-block" key={id}>
              <button onClick={() => focus(`group-${id}`)}>
                {id === "R1S" ? "右側 R1／S · 12 支" : "左側 R2 · 6 支"}
              </button>
              <button
                disabled={disabled}
                onClick={() => dispatch({ type: "group", target: id })}
              >
                取下清潔 mixer bar 並裝回（{id === "R1S" ? "右" : "左"}側）
              </button>
              {resultSelect(
                `${id} 彎曲／損傷檢查`,
                s.damage[id] || "",
                (value) => dispatch({ type: "damage", target: id, value }),
                disabled,
              )}
            </div>
          ))}
          {resultSelect(
            "攪拌運轉／異音",
            s.mix,
            (value) => dispatch({ type: "mix-result", value }),
            disabled,
          )}
        </>
      ) : (
        ["左側", "右側"].map((id) => (
          <div key={id}>
            <button onClick={() => focus(id)}>{id}</button>
            {resultSelect(
              `${id} mixing bars`,
              s.dailyMix[id] || "",
              (value) => dispatch({ type: "daily-mix", target: id, value }),
              disabled,
            )}
          </div>
        ))
      )}
    </div>
  );
}
function CupControls({
  s,
  dispatch,
  disabled,
  daily,
  focus,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
  daily: boolean;
  focus?: (id: string) => void;
}) {
  const [drops, setDrops] = useState(s.drops);
  useEffect(() => {
    setDrops(s.drops);
  }, [s.drops]);
  return (
    <div className="exam-controls">
      <h3>試劑杯</h3>
      <p>
        U-L／CLEAN：
        {
          { empty: "空", full: "滿杯", used: "用過", discarded: "已移除" }[
            s.cup
          ]
        }
      </p>
      <button
        disabled={disabled}
        onClick={() => dispatch({ type: "cup", value: "full" })}
      >
        U-L／CLEAN 放入滿杯 Cleaning Solution
      </button>
      <button
        disabled={disabled}
        onClick={() => dispatch({ type: "cup", value: "discarded" })}
      >
        取出 CLEAN 杯
      </button>
      {daily &&
        cups.map((id, i) => (
          <div className="exam-control-block" key={id}>
            <button onClick={() => focus?.(id)}>{id}</button>
            <label>
              {id} 滴數
              <input
                aria-label={`${id} 校正液滴數`}
                type="number"
                min="0"
                max="100"
                value={drops[i]}
                onChange={(e) =>
                  setDrops((x) =>
                    x.map((v, j) => (i === j ? e.target.value : v)),
                  )
                }
              />
            </label>
            <button
              disabled={disabled}
              onClick={() =>
                dispatch({
                  type: "drops",
                  target: id,
                  value: drops[i] === "" ? -1 : Number(drops[i]),
                })
              }
            >
              放置 {id} 校正杯
            </button>
          </div>
        ))}
    </div>
  );
}
function BottleControls({
  version,
  s,
  dispatch,
  disabled,
  focus,
  selected,
  weekly,
}: {
  version: string;
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
  focus: (id: string) => void;
  selected: string | null;
  weekly: boolean;
}) {
  const [fluid, setFluid] = useState<Fluid>("w2"),
    [level, setLevel] = useState("1"),
    [chemistry, setChemistry] = useState("hcl");
  const id = selected || w2Positions[0];
  const accessible = s.instrument
    ? canHandleBottle(
        s.instrument,
        slotById[id].module,
        disabled,
        !hasRevisedWorkstation(version),
        weekly || !hasPreparation(version),
      )
    : !disabled && s.maintenance && s.lid;
  return (
    <div className="exam-controls">
      <h3>瓶槽</h3>
      {weekly && (
        <label>
          本周清洗液
          <select
            aria-label="本周清洗液"
            disabled={disabled}
            value={s.chemistry}
            onChange={(e) =>
              e.target.value &&
              dispatch({ type: "chemistry", value: e.target.value })
            }
          >
            <option value="">未選擇</option>
            <option value="hcl">1N HCl</option>
            <option value="bleach">0.5% 漂白水</option>
          </select>
        </label>
      )}
      <label>
        槽位
        <select
          aria-label="考試瓶槽"
          value={id}
          onChange={(e) => focus(e.target.value)}
        >
          {washSlots.map((x) => (
            <option key={x.id} value={x.id}>
              {x.module.toUpperCase()} · {x.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        {slotById[id].module.toUpperCase()} · {slotById[id].label}：
        {s.bottles[id].fluid
          ? `${fluidNames[s.bottles[id].fluid!]} ${Math.round(s.bottles[id].level * 100)}%`
          : "空槽"}
      </p>
      <label>
        瓶子
        <select
          aria-label="瓶子種類"
          value={fluid}
          onChange={(e) => setFluid(e.target.value as Fluid)}
        >
          {Object.entries(fluidNames).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        液量
        <select
          aria-label="瓶子液量"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="1">100%</option>
          <option value="0.5">50%</option>
          <option value="0">空瓶</option>
        </select>
      </label>
      {fluid === "w2" && (
        <label>
          瓶內清洗液
          <select
            aria-label="瓶內清洗液"
            value={chemistry}
            onChange={(e) => setChemistry(e.target.value)}
          >
            <option value="hcl">1N HCl</option>
            <option value="bleach">0.5% 漂白水</option>
          </select>
        </label>
      )}
      {!accessible && (
        <p role="note">上蓋、保養模式或運轉狀態不允許操作此瓶槽。</p>
      )}
      <div className="exam-action-grid">
        <button
          disabled={!accessible}
          onClick={() =>
            dispatch({ type: "bottle", target: id, value: "remove" })
          }
        >
          取出瓶子
        </button>
        <button
          disabled={!accessible}
          onClick={() =>
            dispatch({
              type: "bottle",
              target: id,
              value: "replace",
              data: { fluid, level: Number(level), chemistry },
            })
          }
        >
          放入瓶子
        </button>
        <button
          disabled={!accessible}
          onClick={() =>
            dispatch({
              type: "bottle",
              target: id,
              value: "refill",
              data: { level: Number(level), chemistry },
            })
          }
        >
          補充瓶子
        </button>
      </div>
    </div>
  );
}

function ExamWorkstation({
  rackNavigation = 0,
  qcSavedVersion,
  sessionHud,
  attempt,
  dispatch: perform,
  disabled,
  onModel,
  now,
}: {
  rackNavigation?: number;
  qcSavedVersion: number;
  sessionHud: ReactNode;
  attempt: Attempt;
  dispatch: Dispatch;
  disabled: boolean;
  onModel: (id?: string) => void;
  now: number;
}) {
  const s = attempt.sim,
    weekly = attempt.kind === "weekly",
    dispatch: Dispatch = (c) => perform(c, "workstation");
  const [page, setPage] = useState("Home"),
    [tab, setTab] = useState("Maintenance"),
    [w2, setW2] = useState(false),
    [diag, setDiag] = useState(""),
    [notice, setNotice] = useState(""),
    [physicalOpen, setPhysicalOpen] = useState(false);
  function navigate(p: string) {
    setPage(p);
    setTab("Maintenance");
    setW2(false);
    setDiag("");
    setNotice("");
  }
  useEffect(() => {
    if (rackNavigation) navigate("Rack Requisition");
  }, [rackNavigation]);
  const ise = page === "ISE Maintenance",
    maintenance = ise || page === "Analyzer Maintenance";
  function action(name: string) {
    if (
      name === "Replace Sample Probe" &&
      (weekly || (ise && hasDailyIseDrain(attempt.version)))
    ) {
      setDiag(ise ? "ISE" : "Sample-1");
      return;
    }
    if (name === "Replace Mix Bar" && weekly) {
      setDiag("mix");
      return;
    }
    if (name === "Cleaning Probe" || name === "Inspect Probe & Mixing Bar") {
      if (
        name === "Cleaning Probe" ||
        dailyProbes.every((id) => s.wiped.includes(id))
      )
        setPhysicalOpen(true);
      dispatch({
        type: "daily-mode",
        value: name === "Cleaning Probe" ? "wipe" : "inspect",
      });
      return;
    }
    if (name === "Total Prime" && !weekly) {
      dispatch({ type: "prime" });
      return;
    }
    setNotice(`${name} 尚未提供可執行的模擬程序。`);
  }
  return (
    <div
      className={`exam-workstation workstation-software ${page === "Rack Requisition" ? "exam-rack-workstation" : ""}`}
      onKeyDown={(e) => {
        if (
          e.key !== "Escape" ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLSelectElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        if (diag || w2 || physicalOpen) {
          e.preventDefault();
          e.stopPropagation();
          setDiag("");
          setW2(false);
          setPhysicalOpen(false);
        }
      }}
    >
      <div className="ws-session-hud">
        {sessionHud}
        <details className="ws-instrument-hud">
          <summary>儀器狀態</summary>
          <InstrumentControls
            s={s}
            dispatch={dispatch}
            disabled={disabled}
            weekly={false}
            modes={!(maintenance && tab === "Maintenance")}
          />
        </details>
      </div>
      <header className="ws-toolbar">
        <strong>
          AU5800 <span>操作工作站</span>
        </strong>
        <span className="ws-simulation">教學模擬 · 未連接實機</span>
        <button onClick={() => onModel()}>到模型操作</button>
        <button onClick={() => navigate("Home")}>Home 主選單</button>
        <button onClick={() => onModel()}>退出螢幕 ×</button>
      </header>
      <header className="ws-title">
        <span>{maintenance ? "Maintenance" : page}</span>
        <b>{maintenance ? "User Maintenance" : "AU5800"}</b>
      </header>

      {page === "Home" ? (
        <>
          <div className="ws-status-links">
            <button onClick={() => navigate("Sample Status")}>
              Sample Status
            </button>
            <button onClick={() => navigate("Analyzer Status")}>
              Analyzer Status
            </button>
          </div>
          <div className="ws-home">
            <div className="ws-machine">
              <img src={asset("exterior.jpg")} alt="AU5800 儀器外觀" />
            </div>
            <aside className="ws-home-message">
              <h2>Message</h2>
              <p>教學模擬 · 未連接實機</p>
            </aside>
          </div>
          {s.dailyTasks && (
            <button onClick={() => navigate("日保養補充與檢查")}>
              日保養補充與檢查
            </button>
          )}
          <nav className="ws-footer">
            {mainMenu.map((p) => (
              <button key={p} onClick={() => navigate(p)}>
                {p}
              </button>
            ))}
          </nav>
        </>
      ) : page === "日保養補充與檢查" && s.dailyTasks ? (
        <>
          <DailyTasksPanel
            tasks={s.dailyTasks}
            instrument={s.instrument!}
            bottles={s.bottles}
            disabled={disabled}
            command={dispatch}
            cover={(target, value) =>
              dispatch({ type: "cover", target, value })
            }
            refill={(target) =>
              dispatch({ type: "bottle", target, value: "refill" })
            }
            focus={onModel}
          />
        </>
      ) : maintenance ? (
        <>
          <nav className="ws-primary-tabs">
            <button
              aria-pressed={!ise}
              onClick={() => navigate("Analyzer Maintenance")}
            >
              Analyzer Maintenance
            </button>
            <button
              aria-pressed={ise}
              onClick={() => navigate("ISE Maintenance")}
            >
              ISE Maintenance
            </button>
            <button disabled>PRO Service</button>
            <button disabled>Load Reagent Parameters</button>
          </nav>
          <nav className="ws-tabs">
            {(ise
              ? [
                  "Maintenance",
                  "Calibration",
                  "Slope Chart",
                  "Selectivity Check",
                ]
              : ["Maintenance", "Consumption", "Photocal Monitor"]
            ).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => {
                  setTab(t);
                  setW2(false);
                  setDiag("");
                }}
              >
                {t}
              </button>
            ))}
          </nav>

          {tab === "Photocal Monitor" && !ise ? (
            <PhotocalMonitor s={s} dispatch={dispatch} disabled={disabled} />
          ) : tab === "Calibration" && ise && !weekly ? (
            <CalibrationControls
              s={s}
              dispatch={dispatch}
              disabled={disabled}
            />
          ) : tab === "Maintenance" ? (
            <>
              <MaintenanceSurface
                ise={ise}
                iseInterlocks={!!s.dailyTasks}
                enabled={
                  s.instrument
                    ? ise
                      ? s.instrument.iseMaintenance
                      : s.instrument.analyzerMaintenance
                    : s.maintenance
                }
                busy={disabled}
                blocked={!!(s.dailyTasks && s.instrument?.iseModule)}
                cleaningBlocked={!!(s.dailyTasks && s.instrument?.iseModule)}
                toggle={(value) => {
                  void dispatch({
                    type: "maintenance",
                    target: ise ? "ise" : "analyzer",
                    value,
                  });
                }}
                workspace={
                  !ise && !weekly && physicalOpen ? (
                    <div className="ws-inline-program">
                      <header>
                        <strong>Inspect Probe & Mixing Bar</strong>
                        <button onClick={() => setPhysicalOpen(false)}>
                          關閉子工作區
                        </button>
                      </header>
                      <div className="ws-program-content">
                        <ProbePractice
                          d={{
                            active: true,
                            mode: s.dailyMode,
                            wiped: s.wiped,
                            wipeAccessible: !disabled && !!s.instrument?.mainLid && !!s.instrument?.analyzerMaintenance,
                            canInspect: !disabled && !!s.instrument?.analyzerMaintenance,
                            drains: s.dailyDrains,
                            mix: s.dailyMix,
                            setWiped: () => {},
                            setDrains: () => {},
                            setMix: () => {},
                          }}
                          onWipe={(target) => {
                            void dispatch({ type: "daily-wipe", target });
                          }}
                          onDrain={(target, value) => {
                            void dispatch({
                              type: "daily-drain",
                              target,
                              value,
                            });
                          }}
                          onMix={(target, value) => {
                            void dispatch({ type: "daily-mix", target, value });
                          }}
                        />
                      </div>
                    </div>
                  ) : undefined
                }
                update={() => setNotice("Update 未改變保養紀錄。")}
                perform={(name) =>
                  name === "Cleaning"
                    ? void dispatch({ type: "cleaning" })
                    : action(name)
                }
              />
              <nav className="ws-footer">
                {(ise ? iseFooter : analyzerFooter).map((name) => (
                  <button
                    key={name}
                    disabled={disabled}
                    onClick={() =>
                      name === "W2" && weekly
                        ? setW2(true)
                        : setNotice(`${name} 未執行模擬程序。`)
                    }
                  >
                    {name}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            <div className="exam-controls">本頁尚無可執行的模擬程序。</div>
          )}
          {w2 && (
            <div
              className="exam-machine-dialog"
              role="dialog"
              aria-label="W2 設定"
            >
              <div className="weekly-w2">
                <h3>W2 (F6)</h3>
                <p>Please set detergent for W2. Start W2?</p>
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={s.photo}
                    onChange={(e) =>
                      dispatch({
                        type: "w2-options",
                        data: { photo: e.target.checked, enhanced: s.enhanced },
                      })
                    }
                  />
                  After W2 ends, perform the photocal
                </label>
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={s.enhanced}
                    onChange={(e) =>
                      dispatch({
                        type: "w2-options",
                        data: { photo: s.photo, enhanced: e.target.checked },
                      })
                    }
                  />
                  ISE Cleaning (Enhanced)
                </label>
                <div className="exam-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Position</th>
                        <th>W2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w2Positions.map((id) => (
                        <tr key={id}>
                          <td>
                            {slotById[id].module.toUpperCase()} ·{" "}
                            {slotById[id].label}
                          </td>
                          <td>
                            {s.bottles[id].fluid
                              ? `${fluidNames[s.bottles[id].fluid!]} ${Math.round(s.bottles[id].level * 100)}%`
                              : "空槽"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  程序狀態：{s.phase.toUpperCase()}{" "}
                  {(s.phase === "w2" || s.phase === "photocal") &&
                    `${Math.max(0, Math.ceil((s.deadline - now) / 1000))} 秒`}
                </p>
                <button
                  disabled={disabled}
                  onClick={() => dispatch({ type: "w2-start" })}
                >
                  OK · Start W2
                </button>
                <button disabled={disabled} onClick={() => setW2(false)}>
                  Cancel
                </button>
                {(s.phase === "w2" || s.phase === "photocal") && (
                  <button
                    disabled={disabled}
                    onClick={() => dispatch({ type: "fast-forward" })}
                  >
                    教學快轉
                  </button>
                )}
              </div>
            </div>
          )}
          {diag && (
            <DiagControls
              s={s}
              target={diag}
              dispatch={dispatch}
              disabled={disabled}
              close={() => setDiag("")}
              onModel={onModel}
            />
          )}
        </>
      ) : page === "Analyzer Status" ? (
        <TemperatureControls s={s} dispatch={dispatch} disabled={disabled} />
      ) : page === "Start Condition" ? (
        <StartCondition
          d={{
            active: true,
            editing: s.indexEditing,
            index: s.index,
            setIndex: () => {},
            setEditing: () => {},
          }}
          disabled={disabled}
          onEdit={() => {
            void dispatch({ type: "index-edit" });
          }}
          onIndex={() => {
            void dispatch({ type: "index" });
          }}
        />
      ) : page === "Reagent Management" && !weekly ? (
        s.instrument ? (
          <ExamReagentManagement
            rows={s.reagents}
            disabled={disabled}
            checked={s.reagentChecked}
            onReplace={(id) =>
              dispatch({ type: "reagent", target: id, value: "replace" })
            }
            onCheck={() => dispatch({ type: "reagent-check" })}
          />
        ) : (
          <ReagentControls s={s} dispatch={dispatch} disabled={disabled} />
        )
      ) : page === "Rack Requisition" && !weekly ? (
        <RackControls
          s={s}
          dispatch={dispatch}
          disabled={disabled}
          qcSavedVersion={qcSavedVersion}
        />
      ) : (
        <p className="exam-controls">{page} 尚無可執行的模擬程序。</p>
      )}
      <div className="ws-message" role="status">
        {notice ||
          "教學介面 · Entry 僅登記申請，不重設穩定時間。按 Esc 返回 3D 儀器。"}
      </div>
    </div>
  );
}
function DiagControls({
  s,
  target,
  dispatch,
  disabled,
  close,
  onModel,
}: {
  s: Simulation;
  target: string;
  dispatch: Dispatch;
  disabled: boolean;
  close: () => void;
  onModel: (id?: string) => void;
}) {
  const [id, setId] = useState(target),
    [count, setCount] = useState(target === "mix" ? 1 : 3),
    [cuvette, setCuvette] = useState("內部"),
    [unit, setUnit] = useState(true);
  return (
    <div role="dialog" aria-label="DIAG 設定" className="exam-machine-dialog">
      <div className="exam-card exam-controls">
        <h2>{target === "mix" ? "Replace Mix Bar" : "Replace Sample Probe"}</h2>
        {target !== "mix" && target !== "ISE" && (
          <label>
            Probe
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option>Sample-1</option>
              <option>Sample-2</option>
            </select>
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={unit}
            onChange={(e) => setUnit(e.target.checked)}
          />
          Unit 1
        </label>
        <label>
          Cuvette
          <select
            aria-label="DIAG 比色杯"
            value={cuvette}
            onChange={(e) => setCuvette(e.target.value)}
          >
            <option>內部</option>
            <option>外部</option>
          </select>
        </label>
        <label>
          Times
          <input
            aria-label="DIAG 次數"
            type="number"
            min="1"
            max="10"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <button
          disabled={disabled}
          onClick={() =>
            dispatch({
              type: "diag-config",
              target: id,
              data: { count, cuvette, unit },
            })
          }
        >
          OK · 儲存 DIAG 設定
        </button>
        <button
          disabled={disabled}
          onClick={() => onModel(id === "mix" ? "group-R1S" : id)}
        >
          到模型操作
        </button>
        <div className="exam-inline">
          {["front", "sample", "ise"].map((region) => (
            <button
              key={region}
              disabled={disabled}
              onClick={() => dispatch({ type: "diag", target: region })}
            >
              DIAG {region}
            </button>
          ))}
        </div>
        {id === "mix"
          ? resultSelect(
              "攪拌運轉／異音",
              s.mix,
              (value) => dispatch({ type: "mix-result", value }),
              disabled,
            )
          : resultSelect(
              `${id} 直線排水檢查`,
              s.drains[id] || "",
              (value) => dispatch({ type: "drain-result", target: id, value }),
              disabled,
            )}
        <button onClick={close}>關閉 DIAG 設定</button>
      </div>
    </div>
  );
}
function PhotocalMonitor({
  s,
  dispatch,
  disabled,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
}) {
  return (
    <section className="exam-controls">
      <h2>Photocal Monitor</h2>
      <p>執行狀態：{s.phase.toUpperCase()} · 教學模擬資料</p>
      <label>
        Cuvette
        <select>
          <option>Inner</option>
          <option>Outer</option>
        </select>
      </label>
      <div className="photocal-grid exam-photocal-grid">
        {Array.from({ length: 204 }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <div className="photocal-legend">
        <span style={{ background: "#84dc3c" }}>Cuvette Check Error</span>
        <span style={{ background: "#ed6666" }}>Mean Check Error</span>
        <span style={{ background: "#edbd45" }}>Lamp Check Error</span>
      </div>
      <p>
        {s.phase === "done"
          ? "本次模擬結果：未出現比色杯異常。"
          : "尚無本次完成結果。"}
      </p>
      <button
        disabled={disabled}
        onClick={() => dispatch({ type: "photocal-review" })}
      >
        確認本次結果
      </button>
    </section>
  );
}
function TemperatureControls({
  s,
  dispatch,
  disabled,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
}) {
  const [bath, setBath] = useState(s.temp.bath),
    [coolant, setCoolant] = useState(s.temp.coolant);
  return (
    <AnalyzerStatusSurface>
      <section className="ws-checks">
        <h2>Analyzer Status</h2>
        <p>示意讀值：Bath Temp. 37.0 °C · Coolant Temp. 8.2 °C</p>
        <label>
          Bath Temp. 登記
          <input
            type="number"
            step="0.1"
            value={bath}
            onChange={(e) => setBath(e.target.value)}
          />
        </label>
        <label>
          Coolant Temp. 登記
          <input
            type="number"
            step="0.1"
            value={coolant}
            onChange={(e) => setCoolant(e.target.value)}
          />
        </label>
        <button
          disabled={disabled}
          onClick={() =>
            dispatch({ type: "temperature", data: { bath, coolant } })
          }
        >
          儲存溫度紀錄
        </button>
      </section>
    </AnalyzerStatusSurface>
  );
}
function CalibrationControls({
  s,
  dispatch,
  disabled,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
}) {
  return (
    <Calibration
      d={{
        active: true,
        instrument: s.instrument || {
          analyzerMaintenance: s.maintenance,
          iseMaintenance: !s.maintenance,
          mainLid: s.lid,
          iseTop: s.lid,
          iseModule: s.lid,
        },
        iseReady: true,
        canCalibrate: true,
        cleanCup: s.cup,
        drops: s.drops,
        cal: s.cal,
        setCal: () => {},
      }}
      disabled={disabled}
      notify={() => {}}
      onStart={(serum, urine) => {
        void dispatch({
          type: "calibrate",
          target: serum && urine ? "both" : serum ? "serum" : "urine",
        });
      }}
      onReview={() => {
        void dispatch({ type: "cal-review" });
      }}
    />
  );
}
function ReagentControls({
  s,
  dispatch,
  disabled,
}: {
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(s.reagents);
  const change = (i: number, patch: Partial<Simulation["reagents"][number]>) =>
    setDraft((xs) => xs.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  return (
    <div className="exam-controls">
      <h2>Reagent Management · Details</h2>
      <div className="exam-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>R1/R2</th>
              <th>Shots／需求</th>
              <th>狀態</th>
              <th>紀錄</th>
              <th>更換</th>
              <th>檢查</th>
              <th>保存</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={i}>
                <th>{r.name}</th>
                <td>{r.side}</td>
                <td>
                  {s.reagents[i].remaining}／{r.need}
                </td>
                <td>{r.reason}</td>
                <td>
                  <input
                    aria-label={`${r.name} ${r.side} 紀錄`}
                    value={r.note}
                    onChange={(e) => change(i, { note: e.target.value })}
                  />
                </td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`更換 ${r.name} ${r.side}`}
                      checked={r.replaced}
                      onChange={(e) =>
                        change(i, { replaced: e.target.checked })
                      }
                    />
                    更換
                  </label>
                </td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`${r.name} ${r.side} 用量已檢查`}
                      checked={r.reviewed}
                      onChange={(e) =>
                        change(i, { reviewed: e.target.checked })
                      }
                    />
                    檢查
                  </label>
                </td>
                <td>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      dispatch({
                        type: "reagent",
                        target: String(i),
                        data: {
                          reviewed: r.reviewed,
                          replaced: r.replaced,
                          note: r.note,
                        },
                      })
                    }
                  >
                    Entry {r.name} {r.side}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        disabled={disabled}
        onClick={() => dispatch({ type: "reagent-check" })}
      >
        Reagent Check · All positions
      </button>
    </div>
  );
}
function RackControls({
  qcSavedVersion,
  s,
  dispatch,
  disabled,
}: {
  qcSavedVersion: number;
  s: Simulation;
  dispatch: Dispatch;
  disabled: boolean;
}) {
  return (
    <div className="exam-native-rack">
      <RackRequisition
        exam
        qcSavedVersion={qcSavedVersion}
        disabled={disabled}
        onQcEntry={(data) => dispatch({ type: "rack-qc-entry", data })}
        calibrationNeeds={
          s.instrument ? calibrationNeeds(s.reagents) : undefined
        }
        autoCalibration={false}
        d={{ rack: s.rack, setRack: () => {} }}
        notify={() => {}}
        onEntry={(type, selection, category) =>
          dispatch({
            type: "rack",
            target: type,
            data: { selection, category },
          })
        }
      />
    </div>
  );
}
