import { AnalyzerStatusSurface } from "./AnalyzerStatusSurface";
import { MaintenanceSurface } from "./MaintenanceSurface";
import { IseDrainWorkspace } from "./IseDrainWorkspace";
import { DailyTasksPanel } from "./DailyTasksPanel";
import { useEffect, useRef, useState } from "react";
import {
  WeeklyPanel,
  WeeklyOverview,
  Photocal,
  type Weekly,
} from "./WeeklyTraining";
import type { BottleStates } from "./detergents";
import { asset } from "./data";
import {
  mainMenu,
  maintenancePages,
  analyzerTabs,
  iseTabs,
  analyzerFooter,
  iseFooter,
} from "./workstationData";
import "./workstation.css";
import {
  DailyOverview,
  DailyInstrumentControls,
  TemperatureRecord,
  StartCondition,
  ProbePractice,
  IsePreparation,
  Calibration,
} from "./DailyTraining";
import ReagentManagement from "./ReagentManagement";
import RackRequisition from "./RackRequisition";
import type { Daily } from "./DailyTraining";
import type { ReactNode } from "react";
import type { ExamCommand } from "../shared/exam";
export interface AssessmentActions {
  practice?: boolean;
  dispatch: (command: ExamCommand) => Promise<boolean>;
  disabled: boolean;
  qcSavedVersion: number;
}

export default function Workstation({
  open,
  active = true,
  onExit,
  dailyRequest = 0,
  requestedRoute = "",
  guidance,
  guideControls = [],
  daily,
  onModel,
  weekly,
  bottles,
  onWeeklyModel,
  onPreparation,
  assessment,
  sessionStatus,
  sessionControls,
  sessionFeedback,
}: {
  assessment?: AssessmentActions;
  sessionStatus?: ReactNode;
  sessionControls?: ReactNode;
  sessionFeedback?: string;
  onPreparation?: () => void;
  weekly?: Weekly;
  bottles: BottleStates;
  onWeeklyModel: (id: string) => void;
  open: boolean;
  active?: boolean;
  onExit: () => void;
  dailyRequest?: number;
  requestedRoute?: string;
  guidance?: string;
  guideControls?: string[];
  daily: Daily;
  onModel: (area: "probes" | "cups") => void;
}) {
  const exam = !!assessment && !assessment.practice;
  const dialog = useRef<HTMLDialogElement>(null);
  const [w2Open, setW2Open] = useState(false);
  useEffect(() => {
    if (weekly) setPage("周保養");
  }, [!!weekly]);
  const [page, setPage] = useState("Home"),
    [tab, setTab] = useState("Maintenance"),
    [message, setMessage] = useState("");
  const [checks, setChecks] = useState({ bath: false, coolant: false }),
    [maintenance, setMaintenance] = useState({ analyzer: false, ise: false });
  const [program, setProgram] = useState("");
  useEffect(() => {
    if (dailyRequest > 0) setPage(requestedRoute || "日保養");
  }, [dailyRequest, requestedRoute]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    const elements = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(
        "button,input,select",
      ) || []),
    ];
    const marked: HTMLElement[] = [];
    for (const el of elements) {
      const label =
        el instanceof HTMLInputElement || el instanceof HTMLSelectElement
          ? el.getAttribute("aria-label") ||
            el.closest("label")?.textContent?.trim()
          : el.textContent?.trim();
      if (
        open &&
        guidance &&
        label &&
        guideControls.includes(
          el instanceof HTMLInputElement
            ? `input:${label}`
            : el instanceof HTMLSelectElement
              ? `select:${label}`
              : label,
        ) &&
        !(el as HTMLButtonElement).disabled
      ) {
        el.classList.add("hud-control-target");
        marked.push(el);
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          const parent = el.closest("label");
          if (parent) {
            parent.classList.add("hud-control-target");
            marked.push(parent);
          }
        }
      }
    }
    return () =>
      marked.forEach((el) => el.classList.remove("hud-control-target"));
  });
  function navigate(next: string) {
    if (next === "校正與品管上機") {
      onPreparation?.();
      return;
    }
    setW2Open(false);
    setPage(next);
    setTab("Maintenance");
    setMessage("");
    setProgram("");
  }
  const isIse = page === "ISE Maintenance",
    isMaintenance = page === "Analyzer Maintenance" || isIse;
  const notice = (name: string) =>
    setMessage(
      `已選取 ${name}。此版建立選單入口，詳細操作流程尚未加入；未執行儀器動作。`,
    );
  async function perform(name: string) {
    if (
      assessment &&
      [
        "Cleaning Probe",
        "Inspect Probe & Mixing Bar",
        "Cleaning",
        "Total Prime",
      ].includes(name)
    ) {
      const command: ExamCommand =
        name === "Cleaning"
          ? { type: "cleaning" }
          : name === "Total Prime"
            ? { type: "prime" }
            : {
                type: "daily-mode",
                value: name === "Cleaning Probe" ? "wipe" : "inspect",
              };
      if (await assessment.dispatch(command)) {
        if (name === "Cleaning Probe") setProgram("Wipe");
        if (name === "Inspect Probe & Mixing Bar") setProgram("Inspect");
      }
      return;
    }
    if (
      !weekly &&
      daily.active &&
      name === "Cleaning Probe" &&
      daily.wipeAccessible
    )
      setProgram("Wipe");
    if (!weekly && daily.active && name === "Replace Sample Probe" && isIse) {
      setProgram("ISE DIAG");
      return;
    }
    if (
      !weekly &&
      daily.active &&
      name === "Inspect Probe & Mixing Bar" &&
      daily.canInspect
    )
      setProgram("Inspect");
    if (weekly) {
      if (name === "Replace Sample Probe" || name === "Replace Mix Bar") {
        weekly.setView(name === "Replace Mix Bar" ? "攪拌棒" : "探針");
        onWeeklyModel(
          name === "Replace Mix Bar" ? "group-R1S" : isIse ? "ISE" : "Sample-1",
        );
      } else notice(name);
      return;
    }
    const result = daily.action(
      name,
      daily.active
        ? isIse
          ? daily.instrument.iseMaintenance
          : daily.instrument.analyzerMaintenance
        : isIse
          ? maintenance.ise
          : maintenance.analyzer,
    );
    if (result !== null) setMessage(result);
    else notice(name);
  }
  const iseEnabled = weekly
    ? weekly.iseMaintenance
    : daily.active
      ? daily.instrument.iseMaintenance
      : maintenance.ise;
  const iseBusy = weekly ? weekly.busy : false;

  return (
    <dialog
      ref={dialog}
      className={active ? "workstation" : "workstation-retained"}
      data-assessment={!!assessment}
      data-save-blocked={assessment?.disabled || undefined}
      aria-label="AU5800 操作工作站"
      onCancel={(e) => {
        e.preventDefault();
        if (
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement instanceof HTMLSelectElement
        ) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (program) {
          setProgram("");
          return;
        }
        if (w2Open) {
          setW2Open(false);
          return;
        }
        onExit();
      }}
      onClose={onExit}
    >
      <div className="ws-session-hud">
        {sessionStatus || (
          <span>
            {weekly
              ? "周保養練習"
              : daily.active
                ? `日保養 ${daily.completed.filter(Boolean).length}／${daily.completed.length}`
                : "自由探索"}
          </span>
        )}
        {sessionControls}
        {guidance && <span className="ws-session-target">{guidance}</span>}
        {!weekly && daily.active && (
          <details className="ws-instrument-hud">
            <summary>儀器狀態</summary>
            <DailyInstrumentControls
              d={daily}
              modes={!(isMaintenance && tab === "Maintenance")}
            />
          </details>
        )}
        {weekly && (
          <details className="ws-instrument-hud">
            <summary>儀器狀態</summary>
            <fieldset
              className="daily-inline daily-instrument"
              disabled={weekly.busy}
            >
              <legend>儀器狀態</legend>
              {[
                ["主蓋開啟", weekly.lid, weekly.setLid],
                ["ISE 上蓋開啟", weekly.iseTop, weekly.setIseTop],
                ["ISE module 蓋開啟", weekly.iseModule, weekly.setIseModule],
                ...(!(isMaintenance && tab === "Maintenance")
                  ? [
                      [
                        "Analyzer Maintenance",
                        weekly.maintenance,
                        weekly.setMaintenance,
                      ],
                      [
                        "ISE Maintenance",
                        weekly.iseMaintenance,
                        weekly.setIseMaintenance,
                      ],
                    ]
                  : []),
              ].map(([label, value, change]) => (
                <label key={label as string}>
                  <input
                    type="checkbox"
                    checked={value as boolean}
                    onChange={(e) =>
                      (change as (v: boolean) => void)(e.target.checked)
                    }
                  />
                  {label as string}
                </label>
              ))}
            </fieldset>
          </details>
        )}
      </div>
      <header className="ws-toolbar">
        <strong>
          AU5800 <span>操作工作站</span>
        </strong>
        <span className="ws-simulation">教學模擬 · 未連接實機</span>
        {weekly && <button onClick={() => navigate("周保養")}>周保養</button>}
        {weekly && (
          <button onClick={() => onWeeklyModel(weekly.target)}>
            到模型操作
          </button>
        )}
        {!weekly && daily.active && (
          <button onClick={() => onModel(isIse ? "cups" : "probes")}>
            到模型操作
          </button>
        )}
        <button onClick={() => navigate("Home")}>Home 主選單</button>
        {!weekly && daily.active && isIse && (
          <button onClick={() => setProgram("Cups")}>試劑杯準備</button>
        )}
        <button className="ws-exit" onClick={onExit}>
          退出螢幕 ×
        </button>
      </header>
      <div className="ws-title">
        <span>{isMaintenance ? "Maintenance" : page}</span>
        <b>{isMaintenance ? "User Maintenance" : "AU5800"}</b>
      </div>
      {weekly && page === "周保養" ? (
        <WeeklyOverview w={weekly} go={navigate} onModel={onWeeklyModel} />
      ) : page === "日保養" ? (
        <DailyOverview
          d={{
            ...daily,
            reset: () => {
              daily.reset();
              setMaintenance({ analyzer: false, ise: false });
              setChecks({ bath: false, coolant: false });
              setMessage("");
            },
          }}
          go={navigate}
        />
      ) : page === "Start Condition" ? (
        <StartCondition d={daily} />
      ) : page === "日保養補充與檢查" ? (
        <>
          <DailyTasksPanel
            guidance={daily.active && !exam}
            tasks={daily.tasks}
            instrument={daily.instrument}
            bottles={bottles}
            command={(c) => setMessage(daily.taskAction(c))}
            cover={(id, open) =>
              daily.setInstrument((s) => ({ ...s, [id]: open }))
            }
            refill={(id) => setMessage(daily.refill(id))}
            focus={onWeeklyModel}
          />
          <button onClick={() => navigate("日保養")}>返回日保養</button>
        </>
      ) : page === "Reagent Management" ? (
        <ReagentManagement
          d={daily}
          notify={setMessage}
          onCheck={
            assessment
              ? () => assessment.dispatch({ type: "reagent-check" })
              : undefined
          }
        />
      ) : page === "Rack Requisition" ? (
        <RackRequisition
          exam={exam}
          disabled={assessment?.disabled}
          qcSavedVersion={assessment?.qcSavedVersion}
          onEntry={
            assessment
              ? (type, selection, category) =>
                  assessment.dispatch({
                    type: "rack",
                    target: type,
                    data: { category, selection },
                  })
              : undefined
          }
          onQcEntry={
            assessment
              ? (data) => assessment.dispatch({ type: "rack-qc-entry", data })
              : undefined
          }
          d={daily}
          notify={setMessage}
          canStart={!daily.active || daily.rackReady}
          calibrationNeeds={
            daily.active && daily.reagentChecked
              ? daily.calibrationNeeds
              : undefined
          }
          autoCalibration={false}
        />
      ) : page === "Home" ? (
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
              <p>選擇下方選單，開始認識儀器操作畫面</p>
            </div>
            <aside className="ws-home-message">
              <h2>Message</h2>
              <p>選單導覽練習</p>
              {!exam && (
                <p>
                  每次保養請檢查
                  <br />
                  <strong>
                    Bath Temp.
                    <br />
                    Coolant Temp.
                  </strong>
                </p>
              )}
              <p>本畫面不顯示患者資料或實機警報。</p>
            </aside>
          </div>
          <nav className="ws-footer ws-home-footer" aria-label="主選單">
            {mainMenu.map((name) => (
              <button key={name} onClick={() => navigate(name)}>
                {name}
              </button>
            ))}
          </nav>
        </>
      ) : page === "Analyzer Status" ? (
        <>
          <AnalyzerStatusSurface>
            <section className="ws-checks">
              <span className="ws-kicker">每次保養檢查</span>
              <h2>確認兩項溫度</h2>
              {!exam && (
                <p>
                  閱讀畫面中的 Bath Temp. 與 Coolant Temp. 後，逐項標記已檢查。
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={checks.bath}
                  onChange={(e) =>
                    setChecks({ ...checks, bath: e.target.checked })
                  }
                />
                Bath Temp. 已檢查
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checks.coolant}
                  onChange={(e) =>
                    setChecks({ ...checks, coolant: e.target.checked })
                  }
                />
                Coolant Temp. 已檢查
              </label>
              <p className="ws-check-count">
                已檢查 {Number(checks.bath) + Number(checks.coolant)}／2 項
              </p>
              <button
                onClick={() => setChecks({ bath: false, coolant: false })}
              >
                開始新的保養檢查
              </button>
              {!exam && (
                <small>
                  僅記錄是否查看，不自動判定溫度合格；查看標記僅供本次導覽。
                </small>
              )}
              <TemperatureRecord d={daily} />
            </section>
          </AnalyzerStatusSurface>
          <nav className="ws-footer">
            <button onClick={() => notice("Rack Data")}>Rack Data</button>
          </nav>
        </>
      ) : isMaintenance || page === "Load Reagent Parameters" ? (
        <>
          <nav className="ws-primary-tabs" aria-label="維護主選單">
            {maintenancePages.map((name) => (
              <button
                key={name}
                disabled={name === "PRO Service"}
                title={
                  name === "PRO Service" ? "檢驗師不使用，未開放" : undefined
                }
                aria-pressed={page === name}
                onClick={() => navigate(name)}
              >
                {name}
              </button>
            ))}
          </nav>
          {isMaintenance ? (
            <>
              <nav className="ws-tabs" aria-label="維護分頁">
                {(isIse ? iseTabs : analyzerTabs).map((name) => (
                  <button
                    key={name}
                    aria-pressed={tab === name}
                    onClick={() => {
                      setTab(name);
                      setMessage("");
                    }}
                  >
                    {name}
                  </button>
                ))}
              </nav>
              {tab === "Maintenance" ? (
                <MaintenanceSurface
                  ise={isIse}
                  enabled={
                    isIse
                      ? iseEnabled
                      : weekly
                        ? weekly.maintenance
                        : daily.active
                          ? daily.instrument.analyzerMaintenance
                          : maintenance.analyzer
                  }
                  busy={iseBusy}
                  blocked={
                    !weekly && daily.active && daily.instrument.iseModule
                  }
                  cleaningBlocked={
                    !weekly && daily.active && daily.instrument.iseModule
                  }
                  toggle={(value) =>
                    weekly
                      ? isIse
                        ? weekly.setIseMaintenance(value)
                        : weekly.setMaintenance(value)
                      : daily.active
                        ? daily.setInstrument((v) => ({
                            ...v,
                            [isIse ? "iseMaintenance" : "analyzerMaintenance"]:
                              value,
                          }))
                        : setMaintenance((v) => ({
                            ...v,
                            [isIse ? "ise" : "analyzer"]: value,
                          }))
                  }
                  perform={perform}
                  update={() => notice("Update")}
                  workspace={
                    program === "Inspect" || program === "Wipe" ? (
                      <div className="ws-inline-program">
                        <header>
                          <strong>
                            {program === "Wipe"
                              ? "Cleaning Probe"
                              : "Inspect Probe & Mixing Bar"}
                          </strong>
                          <button onClick={() => setProgram("")}>
                            關閉子工作區
                          </button>
                        </header>
                        <div className="ws-program-content">
                          <ProbePractice d={daily} />
                          <button onClick={() => onModel("probes")}>
                            前往 3D 模型觀察
                          </button>
                        </div>
                      </div>
                    ) : undefined
                  }
                />
              ) : weekly && tab === "Photocal Monitor" ? (
                <div className="weekly-panel">
                  <Photocal w={weekly} />
                </div>
              ) : isIse && tab === "Calibration" ? (
                <Calibration
                  d={daily}
                  notify={setMessage}
                  onStart={
                    assessment
                      ? (serum, urine) => {
                          void assessment.dispatch({
                            type: "calibrate",
                            target:
                              serum && urine
                                ? "both"
                                : serum
                                  ? "serum"
                                  : "urine",
                          });
                        }
                      : undefined
                  }
                  onReview={
                    assessment
                      ? () => {
                          void assessment.dispatch({ type: "cal-review" });
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="ws-placeholder">
                  <h2>{tab}</h2>
                  <p>已建立分頁入口，內容將在後續情境中加入。</p>
                </div>
              )}
              <nav
                className={`ws-footer ${isIse ? "ws-ise-footer" : ""}`}
                aria-label="維護下方選單"
              >
                {(isIse
                  ? tab === "Calibration"
                    ? ["ISE Stop", "Print"]
                    : iseFooter
                  : analyzerFooter
                ).map((name) => (
                  <button
                    key={name}
                    onClick={() =>
                      weekly && name === "W2" ? setW2Open(true) : notice(name)
                    }
                  >
                    {name}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            <div className="ws-placeholder">
              <h2>Load Reagent Parameters</h2>
              <p>已建立選單入口，參數載入流程尚未加入。</p>
            </div>
          )}
        </>
      ) : (
        <div className="ws-placeholder">
          <h2>{page}</h2>
          <p>已建立選單入口，詳細畫面尚未加入。</p>
          <button onClick={() => navigate("Home")}>返回主選單</button>
        </div>
      )}
      {program && !["Inspect", "Wipe"].includes(program) && (
        <div
          className="ws-program-dialog"
          role="dialog"
          aria-label={
            program === "ISE DIAG"
              ? "DIAG 設定"
              : program === "Cups"
                ? "ISE 試劑杯準備"
                : "Inspect Probe & Mixing Bar"
          }
        >
          <header>
            <strong>
              {program === "ISE DIAG"
                ? "Replace Sample Probe · ISE"
                : program === "Cups"
                  ? "ISE 試劑杯準備"
                  : "Inspect Probe & Mixing Bar"}
            </strong>
            <button onClick={() => setProgram("")}>關閉子工作區</button>
          </header>
          {program === "ISE DIAG" ? (
            <IseDrainWorkspace
              d={daily}
              notify={setMessage}
              onModel={() => onWeeklyModel("ISE")}
            />
          ) : program === "Cups" ? (
            <div className="ws-program-content">
              <IsePreparation d={daily} />
              <button onClick={() => onModel("cups")}>
                前往 3D 模型操作試劑杯
              </button>
            </div>
          ) : (
            <div className="ws-program-content">
              <ProbePractice d={daily} />
              <button onClick={() => onModel("probes")}>
                前往 3D 模型觀察
              </button>
            </div>
          )}
        </div>
      )}
      {weekly && w2Open && (
        <div className="weekly-dialog" role="dialog" aria-label="W2 設定">
          <button onClick={() => setW2Open(false)}>關閉 W2 設定</button>
          <WeeklyPanel
            screen
            w={{
              ...weekly,
              view: "Analyzer Maintenance",
              setView: () => setW2Open(false),
            }}
            bottles={bottles}
            onFocus={onWeeklyModel}
          />
        </div>
      )}
      <div className="ws-message" role="status">
        {sessionFeedback ||
          message ||
          (!exam &&
            "教學介面 · 按 Home 返回主選單；按 Esc 或「退出螢幕」返回 3D 儀器。")}
      </div>
    </dialog>
  );
}
