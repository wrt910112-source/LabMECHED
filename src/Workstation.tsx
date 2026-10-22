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
  analyzerActions,
  iseActions,
  analyzerFooter,
  iseFooter,
  analyzerRows,
  iseRows,
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

export default function Workstation({
  open,
  onExit,
  dailyRequest = 0,
  daily,
  onModel,
  weekly,
  bottles,
  onWeeklyModel,
}: {
  weekly?: Weekly;
  bottles: BottleStates;
  onWeeklyModel: (id: string) => void;
  open: boolean;
  onExit: () => void;
  dailyRequest?: number;
  daily: Daily;
  onModel: (area: "probes" | "cups") => void;
}) {
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
  const [selected, setSelected] = useState<Record<string, number>>({}),
    [pending, setPending] = useState(false),
    [soon, setSoon] = useState(false);
  useEffect(() => {
    if (dailyRequest > 0) setPage("日保養");
  }, [dailyRequest]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  function navigate(next: string) {
    setW2Open(false);
    setPage(next);
    setTab("Maintenance");
    setMessage("");
    setPending(false);
    setSoon(false);
  }
  const isIse = page === "ISE Maintenance",
    isMaintenance = page === "Analyzer Maintenance" || isIse;
  const notice = (name: string) =>
    setMessage(
      `已選取 ${name}。此版建立選單入口，詳細操作流程尚未加入；未執行儀器動作。`,
    );
  function perform(name: string) {
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
  const rows = isIse ? iseRows : analyzerRows;
  return (
    <dialog
      ref={dialog}
      className="workstation"
      aria-label="AU5800 操作工作站"
      onCancel={(e) => {
        e.preventDefault();
        onExit();
      }}
      onClose={onExit}
    >
      <header className="ws-toolbar">
        <strong>
          AU5800 <span>操作工作站</span>
        </strong>
        <span className="ws-simulation">教學模擬 · 未連接實機</span>
        <span className="daily-progress">
          {weekly
            ? `周保養 · ${weekly.complete ? "已完成" : weekly.view}`
            : daily.active
              ? `日保養 ${daily.completed.filter(Boolean).length}／${daily.completed.length}`
              : ""}
        </span>
        <button
          className="daily-nav"
          onClick={() => navigate(weekly ? "周保養" : "日保養")}
        >
          {weekly ? "周保養" : "日保養"}
        </button>
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
        <button className="ws-exit" onClick={onExit}>
          退出螢幕 ×
        </button>
      </header>
      <div className="ws-title">
        <span>{isMaintenance ? "Maintenance" : page}</span>
        <b>{isMaintenance ? "User Maintenance" : "AU5800"}</b>
      </div>
      {!weekly && daily.active && page !== "日保養補充與檢查" && (
        <DailyInstrumentControls d={daily} modes={false} />
      )}
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
          <DailyInstrumentControls d={daily} />
          <DailyTasksPanel
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
        <ReagentManagement d={daily} notify={setMessage} />
      ) : page === "Rack Requisition" ? (
        <RackRequisition
          d={daily}
          notify={setMessage}
          canStart={!daily.active || daily.rackReady}
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
              <p>
                每次保養請檢查
                <br />
                <strong>
                  Bath Temp.
                  <br />
                  Coolant Temp.
                </strong>
              </p>
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
          <div className="ws-analyzer-status">
            <div className="ws-status-schematic" aria-label="儀器狀態配置示意">
              <div className="ws-track">Sample transport</div>
              <div className="ws-loader">
                Rack Loader
                <br />
                <span>⇄</span>
                <div>Master Wash Solution</div>
              </div>
              <div className="ws-ise-column">
                ISE
                {["REF", "MID", "BUF"].map((n) => (
                  <span key={n}>{n} ●</span>
                ))}
              </div>
              <div className="ws-analysis">
                <div className="ws-incubator">Incubator</div>
                <div className="ws-discs">
                  <span>R2</span>
                  <span>R1</span>
                </div>
                <div className="ws-temps">
                  <div>
                    Bath Temp. <output>37.0</output> °C
                  </div>
                  <div>
                    Coolant Temp. <output>8.2</output> °C
                  </div>
                  <small>照片數值示意，非即時量測或合格範圍</small>
                </div>
                <div className="ws-fluid-grid">
                  {[
                    "D.I. Water",
                    "Diluted Wash Sol.",
                    "Conc. Waste",
                    "Vacuum Tank",
                    "Wash Solution",
                    "Waste",
                  ].map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </div>
            </div>
            <section className="ws-checks">
              <span className="ws-kicker">每次保養檢查</span>
              <h2>確認兩項溫度</h2>
              <p>
                閱讀畫面中的 Bath Temp. 與 Coolant Temp. 後，逐項標記已檢查。
              </p>
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
              <small>
                僅記錄是否查看，不自動判定溫度合格。重新整理頁面會清除練習紀錄。
              </small>
              <TemperatureRecord d={daily} />
            </section>
          </div>
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
                <div className="ws-maintenance-body">
                  <section className="ws-maintenance-list">
                    {!weekly && daily.active && (
                      <button
                        onClick={() => onModel(isIse ? "cups" : "probes")}
                      >
                        前往 3D 模型操作{isIse ? "試劑杯" : "探針與攪拌單元"}
                      </button>
                    )}
                    {!weekly && daily.active && (
                      <div
                        className="daily-scroll"
                        style={{ maxHeight: "55%", flexShrink: 0 }}
                      >
                        {isIse ? (
                          <IsePreparation d={daily} />
                        ) : (
                          <ProbePractice d={daily} />
                        )}
                      </div>
                    )}
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
                            <th>No.</th>
                            <th>Maintenance</th>
                            <th>Pending</th>
                            <th>Performed</th>
                            <th>Frequency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pending || soon ? (
                            <tr>
                              <td colSpan={5}>
                                尚無待執行或即將到期的模擬紀錄。
                              </td>
                            </tr>
                          ) : (
                            rows.map(([name, freq], i) => (
                              <tr
                                key={name}
                                className={
                                  selected[page] === i ? "selected" : ""
                                }
                              >
                                <td>{i + 1}</td>
                                <td>
                                  <button
                                    onClick={() =>
                                      setSelected({ ...selected, [page]: i })
                                    }
                                  >
                                    {name}
                                  </button>
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
                    <small>
                      項目與頻率依照片呈現；未載入保養日期及執行紀錄。
                    </small>
                  </section>
                  <aside className="ws-actions" aria-label={`${page} 操作按鈕`}>
                    <button
                      className="ws-update"
                      onClick={() => notice("Update")}
                    >
                      Update
                    </button>
                    <label className="ws-enable">
                      <input
                        type="checkbox"
                        checked={
                          weekly
                            ? isIse
                              ? weekly.iseMaintenance
                              : weekly.maintenance
                            : daily.active
                              ? isIse
                                ? daily.instrument.iseMaintenance
                                : daily.instrument.analyzerMaintenance
                              : isIse
                                ? maintenance.ise
                                : maintenance.analyzer
                        }
                        onChange={(e) =>
                          weekly
                            ? isIse
                              ? weekly.setIseMaintenance(e.target.checked)
                              : weekly.setMaintenance(e.target.checked)
                            : daily.active
                              ? daily.setInstrument((s) => ({
                                  ...s,
                                  [isIse
                                    ? "iseMaintenance"
                                    : "analyzerMaintenance"]: e.target.checked,
                                }))
                              : setMaintenance({
                                  ...maintenance,
                                  [isIse ? "ise" : "analyzer"]:
                                    e.target.checked,
                                })
                        }
                      />
                      {page}
                    </label>
                    <div className="ws-action-grid">
                      {(isIse ? iseActions : analyzerActions).flatMap(
                        (row, i) =>
                          row.map((name, j) =>
                            name ? (
                              <button
                                key={`${i}-${j}`}
                                disabled={
                                  isIse &&
                                  (!iseEnabled ||
                                    iseBusy ||
                                    (!weekly &&
                                      daily.active &&
                                      daily.instrument.iseModule))
                                }
                                onClick={() => perform(name)}
                              >
                                {name}
                              </button>
                            ) : (
                              <span key={`${i}-${j}`} aria-hidden="true" />
                            ),
                          ),
                      )}
                    </div>
                    {isIse && (
                      <div className="daily-cleaning-buttons">
                        <button
                          disabled={
                            iseEnabled ||
                            iseBusy ||
                            (!weekly &&
                              daily.active &&
                              daily.instrument.iseModule)
                          }
                          onClick={() => perform("Cleaning")}
                        >
                          Cleaning
                        </button>
                        <button
                          disabled={
                            iseEnabled ||
                            iseBusy ||
                            (!weekly &&
                              daily.active &&
                              daily.instrument.iseModule)
                          }
                          onClick={() => perform("Cleaning (Enhanced)")}
                        >
                          Cleaning (Enhanced)
                        </button>
                      </div>
                    )}
                  </aside>
                </div>
              ) : weekly && tab === "Photocal Monitor" ? (
                <div className="weekly-panel">
                  <Photocal w={weekly} />
                </div>
              ) : isIse && tab === "Calibration" ? (
                <Calibration d={daily} notify={setMessage} />
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
        {message ||
          "教學介面 · 按 Home 返回主選單；按 Esc 或「退出螢幕」返回 3D 儀器。"}
      </div>
    </dialog>
  );
}
