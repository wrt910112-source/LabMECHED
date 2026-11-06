import {
  initialTroubleshooting,
  advanceTroubleshooting,
  applyTroubleshooting,
  troubleChecks,
  troubleVersion,
  legacyTroubleVersion,
  previousTroubleVersion,
  manualTroubleVersion,
  type TroubleState,
  type TroubleAction,
} from "./troubleshooting.ts";
import {
  initialPreparation,
  applyPreparation,
  preparationProgress,
  preparationGate,
  syncPreparation,
  type PreparationState,
  type PreparationAction,
} from "./preparation.ts";
import { hasPreparation, legacyDailyV5 } from "./dailyScenario.ts";
import {
  initialDailyTasks,
  tasksReadiness,
  supplyIds,
  supplyComplete,
  supplyLabel,
  dailySyringes,
  iseReagentIds,
  iseReagentNames,
  applyDailyTask,
  recordSupply,
  type DailyTasksState,
} from "./dailyTasks.ts";
import {
  initialBottles,
  slotById,
  type BottleStates,
  type Fluid,
} from "../src/detergents.ts";
import {
  emptyRack,
  tests,
  type RackSelection,
} from "../src/requisitionData.ts";
import {
  dailyProbes,
  detailedProbes,
  mixerIds,
  wellIds,
  syringeIds,
  w2Positions,
  initialReagents,
  probeOperationNames,
  type ProbeOperation,
} from "./maintenance.ts";
import { dailyDependencies, dailyReadiness } from "./dailyRules.ts";
import {
  currentDailyVersion,
  hasDailyIseDrain,
  currentWeeklyVersion,
  legacyWeeklyV2,
  legacyDailyV4,
  hasDailyTasks,
  hasWeeklyHardware,
  hasRevisedWorkstation,
  canHandleBottle,
  validProbeDiag,
  canRunIseProbeDiag,
  legacyDailyV3,
  hasModernDaily,
  canRunIseProgram,
  initialInstrument,
  examReagents,
  reagentReady,
  calibrationNeeds,
  canWipe,
  canHandleCups,
  canRunIse,
  type InstrumentState,
  type ReagentBottle,
} from "./dailyScenario.ts";

export const rubricVersion = "AU5800-2026-10-v1";
export const weeklyRubricVersion = currentWeeklyVersion;
export const previousDailyRubricVersion = "AU5800-2026-10-21-v2";
export const dailyRubricVersion = currentDailyVersion;
export type ExamKind = "daily" | "weekly" | "troubleshooting";
export const versionForKind = (kind: ExamKind) =>
  kind === "daily"
    ? dailyRubricVersion
    : kind === "weekly"
      ? weeklyRubricVersion
      : troubleVersion;
export const supportsVersion = (kind: ExamKind, version: string) =>
  version === versionForKind(kind) ||
  (kind === "troubleshooting" &&
    [
      legacyTroubleVersion,
      previousTroubleVersion,
      manualTroubleVersion,
    ].includes(version)) ||
  (kind !== "troubleshooting" &&
    (version === rubricVersion ||
      (kind === "daily" &&
        [
          previousDailyRubricVersion,
          legacyDailyV3,
          legacyDailyV4,
          legacyDailyV5,
        ].includes(version)) ||
      (kind === "weekly" && version === legacyWeeklyV2)));
export const kindNames = {
  daily: "日保養",
  weekly: "周保養",
  troubleshooting: "UIBC 品管異常：從判讀到回溯",
};
export type User = {
  id: string;
  username: string;
  name: string;
  role: "administrator" | "learner";
  enabled: boolean;
  learnerCode: string;
  mustChangePassword: boolean;
  profileComplete: boolean;
  cohortId: string | null;
  profile: import("./accounts.ts").LearnerProfile | null;
  profileVersion: string;
  profileUpdatedAt: number | null;
};
export type ActionType =
  | "daily-syringe"
  | "ise-reagent"
  | "maintenance"
  | "cover"
  | "lid"
  | "prepared"
  | "syringe"
  | "probe"
  | "group"
  | "damage"
  | "swab"
  | "well"
  | "diag-config"
  | "diag"
  | "drain-result"
  | "mix-result"
  | "chemistry"
  | "bottle"
  | "cup"
  | "w2-options"
  | "w2-start"
  | "fast-forward"
  | "photocal-review"
  | "diluent-clean"
  | "temperature"
  | "index-edit"
  | "index"
  | "daily-mode"
  | "daily-wipe"
  | "daily-drain"
  | "daily-mix"
  | "cleaning"
  | "prime"
  | "drops"
  | "calibrate"
  | "cal-review"
  | "reagent"
  | "reagent-check"
  | "rack"
  | "rack-qc-entry"
  | "preparation"
  | "troubleshooting";
export interface ExamCommand {
  type: ActionType;
  target?: string;
  value?: string | number | boolean;
  data?: Record<string, unknown>;
}
export interface ProbeState {
  locked: boolean;
  installed: boolean;
  drained: boolean;
  wiped: boolean;
  wired: boolean;
  operation: string;
}
export interface Simulation {
  troubleshooting?: TroubleState;
  preparation?: PreparationState;
  dailyTasks?: DailyTasksState;
  instrument?: InstrumentState;
  maintenance: boolean;
  lid: boolean;
  prepared: boolean;
  syringes: Record<string, string>;
  probes: Record<string, ProbeState>;
  mixers: string[];
  damage: Record<string, string>;
  mix: string;
  swab: boolean;
  wells: string[];
  lastWell: string;
  batch: number;
  batchGroup: string;
  diagConfig: { target: string; cuvette: string; count: number; unit: boolean };
  diag: string;
  drains: Record<string, string>;
  chemistry: "hcl" | "bleach" | "";
  bottles: BottleStates;
  cup: "empty" | "full" | "used" | "discarded";
  photo: boolean;
  enhanced: boolean;
  phase: "idle" | "w2" | "photocal" | "done";
  deadline: number;
  reviewed: boolean;
  diluent: string[];
  temp: { bath: string; coolant: string; saved: boolean };
  index: string;
  indexEditing: boolean;
  dailyMode: string;
  wiped: string[];
  dailyDrains: Record<string, string>;
  dailyMix: Record<string, string>;
  cleaned: boolean;
  prime: number;
  drops: string[];
  cal: { serum: boolean; urine: boolean; checked: boolean };
  reagents: ReagentBottle[];
  reagentChecked: boolean;
  calibrationEntered?: boolean;
  rack: Record<string, RackSelection>;
}
export interface EngineState {
  sim: Simulation;
  ledger: Record<string, boolean>;
  waitingMs: number;
  skippedMs: number;
  waitStarted: number;
}
export interface ActionOutcome {
  state: EngineState;
  error: string;
  message: string;
  accepted: boolean;
  label: string;
}
export interface ExamEvent {
  id: string;
  at: number;
  source: string;
  command: ExamCommand;
  accepted: boolean;
  label: string;
  error: string;
}
export interface CheckItem {
  id: string;
  label: string;
  critical: boolean;
  completed: boolean;
  suggestion: string;
  diagnosis?: { status: string; reason: string };
}
export interface ScoreGroup {
  id: string;
  label: string;
  items: CheckItem[];
  proportion: number;
}
export interface ExamResult {
  score: number;
  criticalRatio: number;
  groups: ScoreGroup[];
  completedCount: number;
  totalCount: number;
  errors: ExamEvent[];
  corrections: number;
  repeatedActions: number;
  totalMs: number;
  operationMs: number;
  waitingMs: number;
  skippedMs: number;
  suggestions: string[];
  badges: string[];
}
export interface Attempt {
  readOnly?: boolean;
  backgroundSnapshot?: import("./accounts.ts").LearnerBackgroundSnapshot | null;
  backgroundVersion?: string | null;
  preparationAccess?: ReturnType<typeof preparationGate>;
  id: string;
  userId: string;
  kind: ExamKind;
  version: string;
  status: "active" | "submitted" | "abandoned";
  startedAt: number;
  submittedAt: number | null;
  revision: number;
  sim: Simulation;
  result: ExamResult | null;
  progress?: { completedGroups: number; totalGroups: number };
  events?: ExamEvent[];
  user?: Pick<User, "id" | "username" | "name" | "role" | "enabled">;
}

export function initialEngine(version = dailyRubricVersion): EngineState {
  return {
    ledger: {},
    waitingMs: 0,
    skippedMs: 0,
    waitStarted: 0,
    sim: {
      ...([
        troubleVersion,
        manualTroubleVersion,
        previousTroubleVersion,
        legacyTroubleVersion,
      ].includes(version)
        ? { troubleshooting: initialTroubleshooting(version) }
        : {}),
      ...(hasPreparation(version) ? { preparation: initialPreparation() } : {}),
      ...(hasDailyTasks(version) ? { dailyTasks: initialDailyTasks() } : {}),
      ...(hasModernDaily(version) || hasWeeklyHardware(version)
        ? { instrument: initialInstrument() }
        : {}),
      maintenance: false,
      lid: false,
      prepared: false,
      syringes: {},
      probes: Object.fromEntries(
        detailedProbes.map((id) => [
          id,
          {
            locked: true,
            installed: true,
            drained: false,
            wiped: false,
            wired: false,
            operation: "",
          },
        ]),
      ),
      mixers: [],
      damage: {},
      mix: "",
      swab: false,
      wells: [],
      lastWell: "",
      batch: 0,
      batchGroup: "R1S",
      diagConfig: { target: "Sample-1", cuvette: "內部", count: 3, unit: true },
      diag: "",
      drains: {},
      chemistry: "",
      bottles: initialBottles(),
      cup: "empty",
      photo: false,
      enhanced: false,
      phase: "idle",
      deadline: 0,
      reviewed: false,
      diluent: [],
      temp: { bath: "", coolant: "", saved: false },
      index: "",
      indexEditing: false,
      dailyMode: "",
      wiped: [],
      dailyDrains: {},
      dailyMix: {},
      cleaned: false,
      prime: 0,
      drops: ["", "", "", ""],
      cal: { serum: false, urine: false, checked: false },
      reagents: hasModernDaily(version)
        ? examReagents(version)
        : initialReagents(),
      reagentChecked: false,
      rack: emptyRack(),
    },
  };
}
export function advanceEngine(input: EngineState, now: number): EngineState {
  const state = structuredClone(input),
    s = state.sim;
  if (s.troubleshooting)
    s.troubleshooting = advanceTroubleshooting(s.troubleshooting, now);
  if (s.batch && now >= s.batch + 2400) {
    s.mixers = [
      ...new Set([
        ...s.mixers,
        ...mixerIds.filter((id) => id.startsWith(s.batchGroup + "-")),
      ]),
    ];
    s.batch = 0;
  }
  while ((s.phase === "w2" || s.phase === "photocal") && now >= s.deadline) {
    state.waitingMs += Math.max(0, s.deadline - state.waitStarted);
    state.waitStarted = s.deadline;
    if (s.phase === "w2") {
      state.ledger.w2 = true;
      s.cup = "used";
      if (s.photo) {
        s.phase = "photocal";
        s.deadline += 10000;
      } else {
        s.phase = "done";
        s.deadline = 0;
        state.waitStarted = 0;
      }
    } else {
      s.phase = "done";
      s.deadline = 0;
      state.waitStarted = 0;
      if (state.ledger.w2) state.ledger.photocal = true;
    }
  }
  return state;
}
const add = (xs: string[], id: string) => (xs.includes(id) ? xs : [...xs, id]);
function applyBaseCommand(
  input: EngineState,
  kind: ExamKind,
  c: ExamCommand,
  now: number,
  version = versionForKind(kind),
): ActionOutcome {
  const state = advanceEngine(input, now),
    s = state.sim;
  const out: ActionOutcome = {
    state,
    error: "",
    message: "",
    accepted: true,
    label: c.type,
  };
  const fail = (error: string, message = "操作未執行。") => {
    out.error =
      hasModernDaily(version) && message !== "操作未執行。"
        ? `${error}：${message}`
        : error;
    out.message = message;
    out.accepted = false;
    return out;
  };
  const note = (error: string) => {
    out.error = error;
  };
  const busy = !!s.batch || s.phase === "w2" || s.phase === "photocal";
  const modern = kind === "daily" && hasModernDaily(version);
  const v4 = kind === "daily" && hasDailyTasks(version);
  const revisedWorkstation = hasRevisedWorkstation(version);
  const v5 = kind === "daily" && hasDailyIseDrain(version);
  const instrument = s.instrument ?? initialInstrument();
  const hardware = modern || (kind === "weekly" && hasWeeklyHardware(version));
  const physical = () =>
    hardware
      ? instrument.analyzerMaintenance && canWipe(instrument, busy)
      : s.maintenance && s.lid && !busy;
  const iseAccess = () =>
    hardware
      ? instrument.iseMaintenance && canHandleCups(instrument, busy)
      : physical();
  const cupAccess = () =>
    hardware ? canHandleCups(instrument, busy) : physical();
  const revisedDaily = kind === "daily" && version !== rubricVersion;
  const id = c.target || "",
    value = c.value,
    data = c.data || {};
  const bool = () => typeof value === "boolean";
  const result = () => value === "正常" || value === "異常" || value === "";
  const dailyTypes = [
    "daily-syringe",
    "ise-reagent",
    "temperature",
    "index-edit",
    "index",
    "daily-mode",
    "daily-wipe",
    "daily-drain",
    "daily-mix",
    "cleaning",
    "prime",
    "drops",
    "calibrate",
    "cal-review",
    "reagent",
    "reagent-check",
    "rack",
    "rack-qc-entry",
    "preparation",
  ];
  const weeklyTypes = [
    "prepared",
    "syringe",
    "probe",
    "group",
    "damage",
    "swab",
    "well",
    "diag-config",
    "diag",
    "drain-result",
    "mix-result",
    "chemistry",
    "w2-options",
    "w2-start",
    "fast-forward",
    "photocal-review",
    "diluent-clean",
  ];
  const dailyIseCommand =
    v5 &&
    ((c.type === "diag-config" && id === "ISE") ||
      (c.type === "diag" && id === "ise" && s.diagConfig.target === "ISE") ||
      (c.type === "drain-result" && id === "ISE"));
  if (
    (kind === "daily" && weeklyTypes.includes(c.type) && !dailyIseCommand) ||
    (kind === "weekly" && dailyTypes.includes(c.type))
  )
    return fail("此操作不屬於本次保養測驗");
  switch (c.type) {
    case "preparation": {
      if (kind !== "daily" || !hasPreparation(version) || !s.preparation)
        return fail("此版本尚未開放備料操作。");
      if (busy) return fail("儀器運轉中，請稍候。");
      const action = data as unknown as PreparationAction;
      const result = applyPreparation(
        s.preparation,
        action,
        examPreparationGate(state, version),
      );
      s.preparation = result.state;
      out.label = `備料 ${String(action.action)}`;
      if (result.error) {
        const rejected = fail(result.error);
        rejected.message = result.error;
        return rejected;
      }
      out.message = "備料操作已保存。身份、劑量與正式架位核對狀態維持原紀錄。";
      break;
    }
    case "maintenance":
      if (!bool()) return fail("無效保養設定");
      if (busy)
        return fail("運轉期間更改保養模式", "儀器運轉中，無法更改模式。");
      if (hardware) {
        if (!["analyzer", "ise"].includes(c.target || "analyzer"))
          return fail("無效保養模組");
        instrument[
          c.target === "ise" ? "iseMaintenance" : "analyzerMaintenance"
        ] = value as boolean;
        s.instrument = instrument;
        s.maintenance = instrument.analyzerMaintenance;
      } else s.maintenance = value as boolean;
      if (value) state.ledger.maintenanceEntered = true;
      out.label = `${hardware ? (c.target === "ise" ? "ISE " : "Analyzer ") : ""}Maintenance ${value ? "On" : "Off"}`;
      break;
    case "cover":
      if (
        !hardware ||
        !bool() ||
        ![
          "mainLid",
          "iseTop",
          "iseModule",
          ...(v4
            ? ["frontSyringe", "rearSyringe", "iseReagents", "iseReference"]
            : []),
        ].includes(id)
      )
        return fail("無效蓋子設定");
      if (busy) return fail("運轉期間開關蓋子", "儀器運轉中，無法開關蓋子。");
      instrument[id as keyof InstrumentState] = value as boolean;
      s.instrument = instrument;
      s.lid = instrument.mainLid;
      if (value) state.ledger.lidOpened = true;
      out.label = `${{ mainLid: "分析單元主蓋", iseTop: "ISE 上蓋", iseModule: "ISE module 鐵蓋", frontSyringe: "前方 syringe 櫃門", rearSyringe: "後方 syringe 櫃門", iseReagents: "ISE Standard／Buffer 罩", iseReference: "ISE Reference 櫃門" }[id]}${value ? "開啟" : "關閉"}`;
      break;
    case "lid":
      if (!bool()) return fail("無效主蓋設定");
      if (busy) return fail("運轉期間開關主蓋", "儀器運轉中，主蓋無法開關。");
      s.lid = value as boolean;
      if (hardware) {
        instrument.mainLid = s.lid;
        s.instrument = instrument;
      }
      if (value) state.ledger.lidOpened = true;
      out.label = `主蓋${value ? "開啟" : "關閉"}`;
      break;
    case "prepared":
      if (!bool()) return fail("無效準備紀錄");
      s.prepared = value as boolean;
      out.label = "預熱／待機及工具準備";
      break;
    case "daily-syringe":
    case "ise-reagent": {
      if (!v4 || !s.dailyTasks) return fail("此評分版本未提供此操作");
      const error = applyDailyTask(
        s.dailyTasks,
        { ...c, type: c.type },
        instrument,
        busy,
      );
      out.label =
        c.type === "daily-syringe"
          ? `${id} ${data.finding === "leak" ? "漏水" : "水氣"}檢查：${value}`
          : `${iseReagentNames[id as keyof typeof iseReagentNames] || id} ${value === "replace" ? "更換" : "液量檢查"}`;
      if (error) return fail("操作狀態不允許", error);
      if (c.type === "ise-reagent" && value === "replace") {
        s.prime = 0;
        s.cal = { serum: false, urine: false, checked: false };
      }
      if (c.type === "daily-syringe" && value === "異常")
        note(`${id} ${data.finding === "leak" ? "漏水" : "水氣"}異常未排除`);
      break;
    }
    case "syringe":
      if (!syringeIds.includes(id) || !result())
        return fail("無效 syringe 檢查");
      s.syringes[id] = String(value);
      out.label = `${id} 水氣檢查：${value}`;
      if (value === "異常") note(`${id} 水氣檢查異常`);
      break;
    case "probe": {
      const p = s.probes[id],
        op = value as ProbeOperation;
      if (!p || !Object.hasOwn(probeOperationNames, op))
        return fail("無效探針操作");
      out.label = `${id} ${probeOperationNames[op]}`;
      if (!(id === "ISE" ? iseAccess() : physical()))
        return fail(
          "探針操作時儀器狀態不允許",
          "主蓋、保養模式或運轉狀態不允許拆洗。",
        );
      if (op === "unlock") {
        if (!p.installed)
          return fail("探針未裝回時旋開鎖頭", "探針未在安裝位置。");
        p.locked = false;
        p.drained = false;
        state.ledger[`unlocked-${id}`] = true;
      }
      if (op === "drain") {
        if (p.locked) return fail("未旋開鎖頭就排空探針", "鎖頭仍鎖緊。");
        p.drained = true;
      }
      if (op === "remove") {
        if (p.locked)
          return fail("未旋開鎖頭就取出探針", "鎖頭仍鎖緊，無法取出。");
        if (!p.installed) return fail("重複取出探針", "探針已取出。");
        if (!p.drained) note(`${id} 未等待液體滴完就取出`);
        state.ledger[`drained-${id}`] = p.drained;
        state.ledger[`removed-${id}`] = true;
        state.ledger[`installed-${id}`] = false;
        state.ledger[`locked-${id}`] = false;
        p.installed = false;
        p.wiped = false;
        p.wired = false;
        s.drains[id] = "";
        state.ledger[`diag-${id}`] = false;
      }
      if (op === "wipe" || op === "wire") {
        if (p.installed)
          return fail(
            `${id} 未取出就${probeOperationNames[op]}`,
            "探針仍在安裝位置。",
          );
        if (op === "wipe") p.wiped = true;
        else p.wired = true;
      }
      if (op === "install") {
        if (p.installed) return fail("重複裝回探針", "探針已在安裝位置。");
        if (!p.wiped || !p.wired) note(`${id} 裝回時清潔項目未完成`);
        p.installed = true;
        state.ledger[`installed-${id}`] = true;
      }
      if (op === "lock") {
        if (!p.installed) return fail("未裝回探針就鎖緊", "探針未在安裝位置。");
        p.locked = true;
        state.ledger[`locked-${id}`] = !!state.ledger[`installed-${id}`];
      }
      p.operation = op;
      break;
    }
    case "group":
      if (!["R1S", "R2"].includes(id)) return fail("無效 mixer bar 組別");
      if (!physical())
        return fail(
          "mixer bar 操作時儀器狀態不允許",
          "主蓋、保養模式或運轉狀態不允許拆洗。",
        );
      s.batch = now;
      s.batchGroup = id;
      s.mix = s.mix === "異常" ? s.mix : "";
      state.ledger.mixDiag = false;
      out.label = `${id} 取下清潔 mixer bar 並裝回`;
      break;
    case "damage":
      if (!["R1S", "R2"].includes(id) || !result())
        return fail("無效 mixer bar 檢查");
      s.damage[id] = String(value);
      out.label = `${id} 彎曲／損傷：${value}`;
      if (value === "異常") note(`${id} 彎曲／損傷異常`);
      break;
    case "swab":
      if (!physical())
        return fail("棉棒操作時儀器狀態不允許", "儀器狀態不允許操作。");
      s.swab = true;
      out.label = "棉棒沾取 Cleaning Solution";
      break;
    case "well":
      if (!wellIds.includes(id)) return fail("無效孔洞");
      if (!physical())
        return fail("孔洞操作時儀器狀態不允許", "儀器狀態不允許清潔。");
      out.label = `${id} 孔洞清潔`;
      s.lastWell = id;
      if (!s.swab) {
        note("棉棒未沾取 Cleaning Solution");
        break;
      }
      if (
        !mixerIds
          .filter((x) => x.startsWith(id.includes("R1S") ? "R1S-" : "R2-"))
          .every((x) => s.mixers.includes(x))
      )
        note("mixer bar 清潔前進行孔洞清潔");
      s.wells = add(s.wells, id);
      break;
    case "diag-config": {
      if (
        ![...detailedProbes, "mix"].includes(id) ||
        !["內部", "外部"].includes(String(data.cuvette)) ||
        !Number.isInteger(data.count) ||
        Number(data.count) < 1 ||
        Number(data.count) > 10 ||
        typeof data.unit !== "boolean"
      )
        return fail("無效 DIAG 設定");
      s.diagConfig = {
        target: id,
        cuvette: String(data.cuvette),
        count: Number(data.count),
        unit: data.unit as boolean,
      };
      s.diag = "";
      out.label = `${id} DIAG 設定 ${data.cuvette} ×${data.count} Unit ${data.unit ? 1 : "未選"}`;
      break;
    }
    case "diag": {
      if (!["front", "sample", "ise"].includes(id))
        return fail("無效 DIAG 位置");
      const d = s.diagConfig,
        expected =
          d.target === "mix" ? "front" : d.target === "ISE" ? "ise" : "sample";
      out.label = `DIAG ${id}：${d.target}`;
      if (v5 && d.target === "ISE" && !canRunIseProbeDiag(instrument, busy))
        return fail(
          "ISE 排水程序狀態不允許",
          "請勾選 ISE Maintenance、關閉 module 鐵蓋並等待 ISE 停止。",
        );
      if (
        (hardware
          ? d.target === "ISE"
            ? !instrument.iseMaintenance
            : !instrument.analyzerMaintenance
          : !s.maintenance) ||
        busy
      )
        return fail("DIAG 操作時儀器狀態不允許", "儀器狀態不允許執行 DIAG。");
      if (id !== expected) {
        note("按下不對應的 DIAG 按鍵");
        break;
      }
      if (
        d.target !== "mix" &&
        (!s.probes[d.target].installed || !s.probes[d.target].locked)
      )
        return fail("探針未復位鎖緊就執行 DIAG", "探針未鎖定在安裝位置。");
      s.diag = d.target;
      const valid =
        d.target === "mix" ? d.unit && d.count === 1 : validProbeDiag(d);
      state.ledger[d.target === "mix" ? "mixDiag" : `diag-${d.target}`] = valid;
      if (!valid) note("DIAG 次數或 Unit 設定不符合 SOP");
      break;
    }
    case "drain-result":
      if (!detailedProbes.includes(id) || !result())
        return fail("無效排水紀錄");
      out.label = `${id} 直線排水：${value}`;
      if (s.diag !== id) {
        note(`${id} 未執行對應 DIAG 就記錄排水`);
        break;
      }
      if (v5 && id === "ISE" && !canRunIseProbeDiag(instrument, busy))
        return fail("ISE 排水紀錄時儀器狀態不允許");
      s.drains[id] = String(value);
      if (v5 && id === "ISE")
        state.ledger.dailyIseDrain =
          value === "正常" && !!state.ledger["diag-ISE"];
      if (value === "異常") note(`${id} 排水異常`);
      break;
    case "mix-result":
      if (!result()) return fail("無效運轉紀錄");
      out.label = `攪拌運轉／異音：${value}`;
      if (s.diag !== "mix") {
        note("未執行 mixer bar DIAG 就記錄運轉");
        break;
      }
      s.mix = String(value);
      if (value === "異常") note("mixer bar 運轉／異音異常");
      break;
    case "chemistry":
      if (value !== "hcl" && value !== "bleach") return fail("無效清洗液");
      if (busy) return fail("運轉期間更改清洗液", "儀器運轉中，無法更改。");
      s.chemistry = value;
      out.label = `本周清洗液：${value === "hcl" ? "1N HCl" : "0.5% 漂白水"}`;
      break;
    case "bottle": {
      if (
        !slotById[id] ||
        !["replace", "remove", "refill"].includes(String(value))
      )
        return fail("無效瓶槽操作");
      out.label = `${slotById[id].label} ${value} ${data.fluid || ""}`;
      if (
        (hardware &&
          !canHandleBottle(
            instrument,
            slotById[id].module,
            busy,
            !revisedWorkstation,
          )) ||
        (!hardware && !physical())
      )
        return fail(
          "瓶槽操作時儀器狀態不允許",
          "主蓋、保養模式或運轉狀態不允許換瓶。",
        );
      const old = s.bottles[id];
      if (value === "remove") {
        if (!old.fluid) return fail("取出空槽瓶子", "此槽沒有瓶子。");
        if (id === "ise-wash-2") note("ISE DET-2 未全程保留");
        if (old.fluid === "w2") state.ledger[`w2Removed-${id}`] = true;
        s.bottles[id] = { fluid: null, level: 0, revision: old.revision + 1 };
      } else {
        const fluid = value === "refill" ? old.fluid : (data.fluid as Fluid);
        if (
          !fluid ||
          !["w2", "det1", "det2", "cln1", "diluent"].includes(fluid)
        )
          return fail("無效瓶子種類", "沒有可補充的瓶子。");
        const level = data.level === undefined ? 1 : Number(data.level);
        if (!Number.isFinite(level) || level < 0 || level > 1)
          return fail("無效液量");
        // Bottle compatibility is assessed, not a teaching gate. A wrong choice stays visible until corrected.
        const original = initialBottles()[id].fluid;
        if (fluid !== original && !(fluid === "w2" && w2Positions.includes(id)))
          note(`${slotById[id].label} 瓶子種類不符`);
        const chemistry =
          data.chemistry === "hcl" || data.chemistry === "bleach"
            ? data.chemistry
            : s.chemistry || undefined;
        s.bottles[id] = {
          fluid,
          level,
          revision: old.revision + 1,
          ...(fluid === "w2" ? { chemistry } : {}),
        };
      }
      if (v4 && s.dailyTasks && supplyIds.includes(id)) {
        if (value !== "remove") recordSupply(s.dailyTasks, id);
        s.reagentChecked = false;
        s.calibrationEntered = false;
        state.ledger.calEntry = false;
      }
      break;
    }
    case "cup":
      out.label =
        value === "full"
          ? "U-L／CLEAN 放入滿杯 Cleaning Solution"
          : "取出 CLEAN 杯";
      if (!cupAccess())
        return fail(
          "CLEAN 杯操作時儀器狀態不允許",
          hardware
            ? "ISE 上蓋未開啟或 ISE 正在運轉。"
            : "儀器狀態不允許操作杯子。",
        );
      if (value !== "full" && value !== "discarded")
        return fail("無效杯子操作");
      if (
        modern &&
        ((value === "discarded" && ["empty", "discarded"].includes(s.cup)) ||
          (value === "full" && ["full", "used"].includes(s.cup)))
      )
        return fail(
          "杯位狀態不允許此操作",
          value === "full" ? "杯位已有杯子。" : "杯位沒有杯子。",
        );
      s.cup = value;
      if (value === "discarded" && kind === "daily")
        state.ledger.cupRemoved = true;
      break;
    case "w2-options":
      if (
        typeof data.photo !== "boolean" ||
        typeof data.enhanced !== "boolean" ||
        busy
      )
        return fail("無效 W2 選項");
      s.photo = data.photo as boolean;
      s.enhanced = data.enhanced as boolean;
      out.label = `W2 選項 Photocal ${s.photo}／Enhanced ${s.enhanced}`;
      break;
    case "w2-start": {
      out.label = "Start W2";
      if (
        hardware
          ? busy ||
            instrument.mainLid ||
            instrument.iseModule ||
            !instrument.analyzerMaintenance ||
            !instrument.iseMaintenance
          : busy || s.lid || !s.maintenance
      )
        return fail(
          "W2 啟動時儀器狀態不允許",
          "主蓋、保養模式或運轉狀態不允許啟動。",
        );
      const configured =
        !!s.chemistry &&
        w2Positions.every(
          (x) =>
            s.bottles[x].fluid === "w2" &&
            s.bottles[x].level === 1 &&
            s.bottles[x].chemistry === s.chemistry,
        ) &&
        !s.bottles["sample-left-2"].fluid &&
        !s.bottles["sample-right-2"].fluid &&
        s.bottles["ise-wash-2"].fluid === "det2" &&
        s.cup === "full" &&
        s.photo &&
        s.enhanced;
      if (!configured) {
        note("W2 執行時清洗配置或選項不完整");
        break;
      }
      state.ledger.w2Prepared = true;
      s.phase = "w2";
      s.deadline = now + 1800000;
      state.waitStarted = now;
      s.reviewed = false;
      state.ledger.w2 = false;
      state.ledger.photocal = false;
      break;
    }
    case "fast-forward":
      if (s.phase !== "w2" && s.phase !== "photocal")
        return fail("沒有可快轉的程序");
      out.label = `${s.phase} 教學快轉`;
      state.skippedMs += Math.max(0, s.deadline - now);
      s.deadline = now;
      out.state = advanceEngine(state, now);
      break;
    case "photocal-review":
      out.label = "Photocal Monitor 結果檢查";
      if (!state.ledger.photocal || s.phase !== "done") {
        note("Photocal 完成前確認結果");
        break;
      }
      s.reviewed = true;
      break;
    case "diluent-clean":
      if (!["r1-inner-3", "r1-outer-3"].includes(id))
        return fail("無效 Diluent 瓶");
      out.label = `${slotById[id].label} 依科內 SOP 清潔`;
      if (!physical() || s.bottles[id].fluid === "diluent")
        return fail(
          "Diluent 未取出就記錄清潔",
          "瓶子仍在槽位或儀器狀態不允許操作。",
        );
      s.diluent = add(s.diluent, id);
      break;
    case "temperature":
      if (
        typeof data.bath !== "string" ||
        typeof data.coolant !== "string" ||
        !data.bath.trim() ||
        !data.coolant.trim() ||
        !Number.isFinite(Number(data.bath)) ||
        !Number.isFinite(Number(data.coolant))
      )
        return fail("無效溫度登記", "溫度欄位格式不正確。");
      s.temp = { bath: data.bath, coolant: data.coolant, saved: true };
      out.label = "儲存溫度紀錄";
      break;
    case "index-edit":
      s.indexEditing = true;
      out.label = "Start Condition · Edit";
      break;
    case "index":
      out.label = "New Index";
      if (!s.indexEditing)
        return fail("未進入 Edit 就建立 New Index", "目前不在編輯模式。");
      s.index = new Date(now).toISOString();
      s.indexEditing = false;
      if (!modern && !s.temp.saved) note("溫度登記前建立 New Index");
      break;
    case "daily-mode":
      if (value !== "wipe" && value !== "inspect") return fail("無效操作模式");
      out.label =
        value === "wipe" ? "Cleaning Probe" : "Inspect Probe & Mixing Bar";
      if (busy) return fail("運轉期間啟動探針程序", "儀器正在運轉。");
      if ((!modern || value === "inspect") && !s.maintenance)
        return fail("未進入 Maintenance 就啟動探針程序", "儀器不在保養模式。");
      s.dailyMode = value;
      if (value === "inspect") {
        const valid = dailyDependencies(s.wiped, s.cleaned, s.prime).canInspect;
        if (revisedDaily) state.ledger.dailyInspectValid = valid;
        if (!valid) note("六支探針擦拭前執行排水及攪拌檢查");
      }
      break;
    case "daily-wipe":
      if (!dailyProbes.includes(id)) return fail("無效探針");
      out.label = `${id} 酒精棉擦拭`;
      if (modern ? !canWipe(instrument, busy) : !physical())
        return fail(
          "探針擦拭時儀器狀態不允許",
          modern
            ? "分析單元主蓋未開啟或儀器正在運轉。"
            : "主蓋、保養模式或運轉狀態不允許操作。",
        );
      s.wiped = add(s.wiped, id);
      break;
    case "daily-drain":
      if (!dailyProbes.includes(id) || !result()) return fail("無效排水紀錄");
      if (s.dailyMode !== "inspect") {
        note("未執行 Inspect Probe 就記錄排水");
        break;
      }
      s.dailyDrains[id] = String(value);
      out.label = `${id} 排水：${value}`;
      if (revisedDaily) {
        state.ledger[`daily-drain-${id}`] =
          !!state.ledger.dailyInspectValid &&
          dailyDependencies(s.wiped, s.cleaned, s.prime).canInspect;
        if (!state.ledger[`daily-drain-${id}`])
          note("探針擦拭完成前的排水檢查，需於擦拭後重新執行檢查");
      }
      if (value === "異常") note(`${id} 排水異常`);
      break;
    case "daily-mix":
      if (!["左側", "右側"].includes(id) || !result())
        return fail("無效攪拌紀錄");
      if (s.dailyMode !== "inspect") {
        note("未執行 Inspect Mixing Bar 就記錄運轉");
        break;
      }
      s.dailyMix[id] = String(value);
      out.label = `${id} mixing bars：${value}`;
      if (revisedDaily) {
        state.ledger[`daily-mix-${id}`] =
          !!state.ledger.dailyInspectValid &&
          dailyDependencies(s.wiped, s.cleaned, s.prime).canInspect;
        if (!state.ledger[`daily-mix-${id}`])
          note("探針擦拭完成前的攪拌檢查，需於擦拭後重新執行檢查");
      }
      if (value === "異常") note(`${id} mixing bars 異常`);
      break;
    case "cleaning":
      out.label = "ISE Cleaning";
      if (
        modern
          ? !(v4
              ? canRunIseProgram(instrument, "cleaning", busy)
              : canRunIse(instrument, false, busy))
          : !s.maintenance || s.lid
      )
        return fail(
          "Cleaning 啟動時儀器狀態不允許",
          modern
            ? `ISE module 鐵蓋須關閉，並${v4 ? "關閉" : "開啟"} ISE Maintenance。`
            : "主蓋或保養模式不允許啟動。",
        );
      if (s.cup !== "full") {
        note("Cleaning 執行時 CLEAN 杯未就緒");
        break;
      }
      s.cleaned = true;
      s.cup = "used";
      state.ledger.cleaning = true;
      if (revisedDaily) {
        s.prime = 0;
        s.cal = { serum: false, urine: false, checked: false };
      }
      break;
    case "prime":
      out.label = "Total Prime";
      if (
        modern ? !canRunIse(instrument, false, busy) : !s.maintenance || s.lid
      )
        return fail(
          "Total Prime 啟動時儀器狀態不允許",
          modern
            ? "ISE module 鐵蓋須關閉，並開啟 ISE Maintenance。"
            : "主蓋或保養模式不允許啟動。",
        );
      if (v4 && !tasksReadiness(s.dailyTasks!, s.bottles).iseReady) {
        note("Total Prime 前 ISE 試劑檢查或不足更換尚未完成");
        break;
      }
      if (!dailyDependencies(s.wiped, s.cleaned, s.prime).canPrime) {
        note("ISE Cleaning 前執行 Total Prime");
        if (revisedDaily) break;
      }
      s.prime = Math.min(3, s.prime + 1);
      break;
    case "drops":
      if (
        !["S-H", "S-L", "U-H", "U-L"].includes(id) ||
        !Number.isInteger(value) ||
        Number(value) < 0 ||
        Number(value) > 100
      )
        return fail("無效校正杯液量");
      out.label = `${id} 校正液操作`;
      if (!cupAccess())
        return fail(
          "校正杯操作時儀器狀態不允許",
          hardware
            ? "ISE 上蓋未開啟或 ISE 正在運轉。"
            : "儀器狀態不允許放置杯子。",
        );
      s.drops[["S-H", "S-L", "U-H", "U-L"].indexOf(id)] = String(value);
      out.label = `${id} 校正液 ${value} 滴`;
      break;
    case "calibrate": {
      if (!["serum", "urine", "both"].includes(id)) return fail("無效校正種類");
      out.label = `ISE Calibration ${id}`;
      if (modern ? !canRunIse(instrument, true, busy) : !s.maintenance || s.lid)
        return fail(
          "校正啟動時儀器狀態不允許",
          modern
            ? "ISE module 鐵蓋須關閉，並關閉 ISE Maintenance。"
            : "主蓋或保養模式不允許啟動。",
        );
      if (v4 && !tasksReadiness(s.dailyTasks!, s.bottles).iseReady) {
        note("ISE 校正前試劑檢查或不足更換尚未完成");
        break;
      }
      if (
        revisedDaily &&
        !dailyDependencies(s.wiped, s.cleaned, s.prime).canCalibrate
      ) {
        note("ISE Cleaning 與三次 Total Prime 完成前執行校正");
        break;
      }
      if (
        s.cup !== "discarded" ||
        !s.drops.every((x) => x !== "" && Number(x) >= 10)
      ) {
        note("校正執行時 CLEAN 杯或校正液配置不完整");
        break;
      }
      if (id !== "urine") s.cal.serum = true;
      if (id !== "serum") s.cal.urine = true;
      s.cal.checked = false;
      if (s.prime < 3) note("三次 Total Prime 完成前執行校正");
      break;
    }
    case "cal-review":
      out.label = "ISE 校正結果檢查";
      if (!s.cal.serum || !s.cal.urine) {
        note("校正完成前確認結果");
        break;
      }
      s.cal.checked = true;
      break;
    case "reagent": {
      if (modern) {
        const r = s.reagents.find((r) => r.id === id);
        out.label = r ? `${r.name} ${r.side} 更換試劑` : "更換試劑";
        if (!r || value !== "replace") return fail("無效試劑操作");
        if (busy) return fail("運轉期間更換試劑", "儀器正在運轉。");
        if (v5 && r.replaced) return fail("試劑已更換，無須重複操作");
        r.replaced = true;
        r.reviewed = true;
        r.remaining = 500;
        r.rb = "unchecked";
        if (r.cal !== "na") r.cal = "unchecked";
        s.reagentChecked = false;
        s.rack.Serum.rb = [];
        s.rack.Serum.cal = [];
        state.ledger.calEntry = false;
        s.calibrationEntered = false;
        break;
      }
      const i = Number(id),
        r = s.reagents[i];
      if (
        !r ||
        !Number.isInteger(i) ||
        typeof data.reviewed !== "boolean" ||
        typeof data.note !== "string" ||
        typeof data.replaced !== "boolean"
      )
        return fail("無效試劑紀錄");
      r.reviewed = data.reviewed as boolean;
      r.note = String(data.note).slice(0, 500);
      r.replaced = data.replaced as boolean;
      r.remaining = r.replaced
        ? Math.max(r.need, 500)
        : initialReagents()[i].remaining;
      s.reagentChecked = false;
      out.label = `${r.name} ${r.side} 試劑檢查／更換`;
      break;
    }
    case "reagent-check":
      out.label = "Reagent Check · All positions";
      if (modern) {
        if (busy) return fail("運轉期間執行 Reagent Check", "儀器正在運轉。");
        if (!s.temp.saved || !s.index) {
          note("Reagent Check 前尚未完成溫度登記及 New Index");
          break;
        }
        if (v4 && !tasksReadiness(s.dailyTasks!, s.bottles).suppliesReady) {
          note("Reagent Check 前十二瓶洗滌液尚未逐瓶補滿或種類不符");
          break;
        }
        if (v5 && !s.reagents.every(reagentReady)) {
          note("All positions 執行時十一瓶必換試劑尚未就緒");
          break;
        }
        for (const r of s.reagents.filter(reagentReady)) {
          r.rb = "expired";
          if (r.cal !== "na") r.cal = "expired";
        }
        s.reagentChecked = s.reagents.every(reagentReady);
        if (!s.reagentChecked) note("All positions 執行時試劑未就緒");
        break;
      }
      if (
        !s.reagents.every(
          (r) =>
            r.reviewed &&
            r.note.trim() &&
            (r.reason === "足夠" || r.replaced) &&
            r.remaining >= r.need,
        )
      ) {
        note("All positions 執行時試劑未就緒");
        break;
      }
      s.reagentChecked = true;
      break;
    case "rack-qc-entry": {
      out.label = "Serum／Urine QC Entry";
      if (
        !["Serum", "Urine"].every(
          (t) =>
            Array.isArray(data[t]) &&
            (data[t] as unknown[]).every(
              (x) => typeof x === "string" && tests.includes(x),
            ),
        )
      )
        return fail("無效 QC 合併登記");
      if (revisedDaily && !dailyExamReadiness(state, version).rackReady) {
        note("其他日保養項目尚未全部完成就執行 Rack Requisition");
        break;
      }
      for (const t of ["Serum", "Urine"])
        s.rack[t] = { ...s.rack[t], qc: [...new Set(data[t] as string[])] };
      break;
    }
    case "rack": {
      out.label = `${id} Rack Requisition Entry`;
      if (revisedDaily && !dailyExamReadiness(state, version).rackReady) {
        note("其他日保養項目尚未全部完成就執行 Rack Requisition");
        break;
      }
      if (
        ["Serum", "Urine"].includes(id) &&
        data.selection &&
        typeof data.selection === "object" &&
        !Array.isArray(data.selection)
      ) {
        const selection = data.selection as Record<string, unknown>;
        if (
          !["cal", "qc", "sample", "rb"].every(
            (k) =>
              Array.isArray(selection[k]) &&
              (selection[k] as unknown[]).every(
                (x) => typeof x === "string" && tests.includes(x),
              ),
          )
        )
          return fail("無效 Rack Requisition");
        if (
          modern &&
          !["calibration", "qc", "sample"].includes(String(data.category))
        )
          return fail("無效 Rack Entry 分頁");
        s.rack[id] = Object.fromEntries(
          Object.entries(selection)
            .filter(([k]) => ["cal", "qc", "sample", "rb"].includes(k))
            .map(([k, xs]) => [
              k,
              modern &&
              !(data.category === "calibration"
                ? ["rb", "cal"].includes(k)
                : data.category === k)
                ? s.rack[id][k as keyof RackSelection]
                : [...new Set(xs as string[])],
            ]),
        ) as RackSelection;
        out.label = `${id} ${modern ? data.category + " " : ""}Rack Requisition Entry`;
        if (modern && id === "Serum" && data.category === "calibration") {
          s.calibrationEntered = true;
          const needs = calibrationNeeds(s.reagents);
          state.ledger.calEntry =
            needs.rb.every((x) => s.rack.Serum.rb.includes(x)) &&
            needs.cal.every((x) => s.rack.Serum.cal.includes(x));
          if (
            !state.ledger.calEntry &&
            (s.rack.Serum.rb.length || s.rack.Serum.cal.length)
          )
            note("Calibration Entry 未包含全部 expired RB／Cal 項目");
        }
        break;
      }
      if (
        !["Serum", "Urine"].includes(id) ||
        !["cal", "qc", "sample", "rb"].includes(String(data.category)) ||
        !Array.isArray(data.tests) ||
        !data.tests.every((x) => typeof x === "string" && tests.includes(x))
      )
        return fail("無效 Rack Requisition");
      if (modern) return fail("請使用完整 Rack Entry 選取資料");
      s.rack[id][data.category as keyof RackSelection] = [
        ...new Set(data.tests as string[]),
      ];
      out.label = `${id} ${data.category} Entry ${data.tests.length} 項`;
      break;
    }
    default:
      return fail("未知操作");
  }
  return out;
}

export function examPreparationGate(state: EngineState, version: string) {
  const s = state.sim,
    needs = calibrationNeeds(s.reagents);
  return preparationGate(
    hasPreparation(version) &&
      dailyExamReadiness(state, version).rackReady &&
      !!state.ledger.calEntry &&
      needs.rb.every((id) => s.rack.Serum.rb.includes(id)) &&
      needs.cal.every((id) => s.rack.Serum.cal.includes(id)) &&
      s.rack.Serum.qc.length > 0 &&
      s.rack.Urine.qc.length > 0,
    s.rack,
    s.index,
  );
}
export function applyCommand(
  input: EngineState,
  kind: ExamKind,
  c: ExamCommand,
  now: number,
  version = versionForKind(kind),
): ActionOutcome {
  if (kind === "troubleshooting") {
    const state = advanceEngine(input, now);
    if (
      ![
        troubleVersion,
        previousTroubleVersion,
        manualTroubleVersion,
        legacyTroubleVersion,
      ].includes(version) ||
      !state.sim.troubleshooting ||
      c.type !== "troubleshooting"
    )
      return {
        state,
        error: "此操作不屬於本情境",
        message: "操作未執行。",
        accepted: false,
        label: c.type,
      };
    const result = applyTroubleshooting(
      state.sim.troubleshooting,
      (c.data || {}) as unknown as TroubleAction,
      now,
    );
    state.sim.troubleshooting = result.state;
    return {
      state,
      error: result.error,
      message: result.error
        ? /UIBC.*校正|模擬執行中|已呈送/.test(result.error)
          ? result.error
          : "操作已記錄，請自行核對本次作業。"
        : "操作已保存。",
      accepted: result.accepted,
      label: result.label,
    };
  }
  const out = applyBaseCommand(input, kind, c, now, version);
  if (kind === "daily" && hasPreparation(version) && out.state.sim.preparation)
    syncPreparation(
      out.state.sim.preparation,
      examPreparationGate(out.state, version),
    );
  return out;
}
export function dailyExamReadiness(state: EngineState, version: string) {
  const s = state.sim,
    revised = version !== rubricVersion;
  const base = dailyReadiness({
    ...s,
    drains: Object.fromEntries(
      Object.entries(s.dailyDrains).filter(
        ([id]) => !revised || state.ledger[`daily-drain-${id}`],
      ),
    ),
    mix: Object.fromEntries(
      Object.entries(s.dailyMix).filter(
        ([id]) => !revised || state.ledger[`daily-mix-${id}`],
      ),
    ),
    cleanCup: s.cup,
    iseDrainRequired: hasDailyIseDrain(version),
    iseDrainValid: s.drains.ISE === "正常" && !!state.ledger.dailyIseDrain,
    reagentReady: hasModernDaily(version)
      ? s.reagents.every(reagentReady)
      : s.reagents.every(
          (r) =>
            r.reviewed &&
            !!r.note.trim() &&
            (r.reason === "足夠" || r.replaced) &&
            r.remaining >= r.need,
        ),
  });
  if (!hasDailyTasks(version) || !s.dailyTasks) return base;
  const extra = tasksReadiness(s.dailyTasks, s.bottles);
  return {
    ...base,
    rackReady:
      base.rackReady &&
      extra.suppliesReady &&
      extra.syringesReady &&
      extra.iseReady,
  };
}

export function attemptChecks(
  kind: ExamKind,
  state: EngineState,
  events: ExamEvent[],
  version = versionForKind(kind),
): ScoreGroup[] {
  const s = state.sim,
    groups: ScoreGroup[] = [];
  const group = (id: string, label: string, items: CheckItem[]) =>
    groups.push({
      id,
      label,
      items,
      proportion: items.filter((x) => x.completed).length / items.length,
    });
  const item = (
    id: string,
    label: string,
    completed: boolean,
    critical = false,
    suggestion = `依 SOP 完成「${label}」後再檢查。`,
  ): CheckItem => ({ id, label, completed: !!completed, critical, suggestion });
  if (kind === "troubleshooting") {
    if (s.troubleshooting)
      for (const check of troubleChecks(s.troubleshooting))
        group(
          check.id,
          check.label,
          check.flags.map((value, i) =>
            item(
              `${check.id}-${i}`,
              `${check.label}／操作證據 ${i + 1}`,
              value,
              false,
              `核對「${check.label}」的操作與保存紀錄。`,
            ),
          ),
        );
    return groups;
  }
  if (kind === "daily") {
    const revised = version !== rubricVersion;
    const rules = dailyExamReadiness(state, version);
    group("temp", "溫度登記", [
      item("temp", "Bath／Coolant 溫度登記", s.temp.saved),
    ]);
    group("index", "New Index", [item("index", "建立本次 Index", !!s.index)]);
    group(
      "wipe",
      "六支探針擦拭",
      dailyProbes.map((id) =>
        item(`wipe-${id}`, `${id} 擦拭`, s.wiped.includes(id)),
      ),
    );
    group("inspect", "排水與攪拌檢查", [
      ...(hasDailyIseDrain(version)
        ? [
            item(
              "drain-ISE",
              "ISE probe 排水正常紀錄",
              s.drains.ISE === "正常" && !!state.ledger.dailyIseDrain,
              true,
            ),
          ]
        : []),
      ...dailyProbes.map((id) =>
        item(
          `drain-${id}`,
          `${id} 排水正常紀錄`,
          s.dailyDrains[id] === "正常" &&
            (!revised || !!state.ledger[`daily-drain-${id}`]),
          true,
        ),
      ),
      ...["左側", "右側"].map((id) =>
        item(
          `mix-${id}`,
          `${id} 攪拌正常紀錄`,
          s.dailyMix[id] === "正常" &&
            (!revised || !!state.ledger[`daily-mix-${id}`]),
          true,
        ),
      ),
    ]);
    group("clean", "ISE Cleaning", [
      item(
        "clean",
        "CLEAN 杯就緒並有效執行 Cleaning",
        !!state.ledger.cleaning,
        true,
      ),
    ]);
    group(
      "prime",
      "Total Prime",
      [1, 2, 3].map((n) =>
        item(`prime-${n}`, `Total Prime 第 ${n} 次`, s.prime >= n),
      ),
    );
    group("cal", "ISE 校正與結果", [
      ...s.drops.map((x, i) =>
        item(
          `drop-${i}`,
          `${["S-H", "S-L", "U-H", "U-L"][i]} 校正液至少 10 滴`,
          x !== "" && Number(x) >= 10,
        ),
      ),
      item("serum", "Serum 校正", s.cal.serum, true),
      item("urine", "Urine 校正", s.cal.urine, true),
      item("calReview", "校正結果檢查", s.cal.checked, true),
      item("cleanRemoved", "用過的 CLEAN 杯移除", s.cup === "discarded"),
    ]);
    group("reagent", "試劑與 All positions", [
      ...s.reagents.map((r, i) =>
        item(
          `reagent-${i}`,
          hasModernDaily(version)
            ? `${r.name} ${r.side} 更換試劑`
            : `${r.name} ${r.side} 檢查、紀錄及必要更換`,
          hasModernDaily(version)
            ? reagentReady(r)
            : r.reviewed &&
                !!r.note.trim() &&
                (r.reason === "足夠" || r.replaced) &&
                r.remaining >= r.need,
        ),
      ),
      item("all", "All positions 檢查", s.reagentChecked),
    ]);
    if (hasDailyTasks(version) && s.dailyTasks) {
      const tasks = s.dailyTasks;
      group(
        "supplies",
        "補充 CLN-1、Diluent、DET-1、DET-2",
        supplyIds.map((id) =>
          item(
            `supply-${id}`,
            `${supplyLabel(id)} 補滿`,
            supplyComplete(tasks, s.bottles, id),
          ),
        ),
      );
      group(
        "syringes",
        "檢查 syringe 水氣／漏水",
        dailySyringes.flatMap((id) =>
          (["moisture", "leak"] as const).map((finding) =>
            item(
              `syringe-${id}-${finding}`,
              `${id} ${finding === "moisture" ? "水氣" : "漏水"}檢查`,
              tasks.syringes[id]?.[finding] === "正常",
            ),
          ),
        ),
      );
      group(
        "ise-reagents",
        "ISE Standard／Buffer／Reference",
        iseReagentIds.map((id) =>
          item(
            `ise-reagent-${id}`,
            `${iseReagentNames[id]} 檢查及必要更換`,
            tasks.iseReagents[id].checked && tasks.iseReagents[id].sufficient,
          ),
        ),
      );
    }
    group("rack", "Rack Requisition", [
      item(
        "calEntry",
        "Serum Calibration Entry",
        (hasModernDaily(version)
          ? !!state.ledger.calEntry
          : s.rack.Serum.cal.length > 0) &&
          (!revised || rules.rackReady),
      ),
      item(
        "serumEntry",
        "Serum QC Entry",
        s.rack.Serum.qc.length > 0 && (!revised || rules.rackReady),
      ),
      item(
        "urineEntry",
        "Urine QC Entry",
        s.rack.Urine.qc.length > 0 && (!revised || rules.rackReady),
      ),
    ]);
    if (hasPreparation(version) && s.preparation) {
      const progress = preparationProgress(
        s.preparation,
        examPreparationGate(state, version),
      );
      group(
        "preparation",
        "校正與品管上機（固定情境操作流程表現）",
        progress.items.flatMap((r) => [
          item(`prep-${r.id}-dispensed`, `${r.label} 分裝操作`, r.dispensed),
          item(`prep-${r.id}-racked`, `${r.label} 同色教學架裝架`, r.racked),
          item(`prep-${r.id}-loaded`, `${r.label} 推入上機`, r.loaded),
        ]),
      );
    }
  } else {
    group("ready", "準備與四支 syringe", [
      item("prepared", "預熱／待機與工具準備確認", s.prepared),
      ...syringeIds.map((id) =>
        item(`syringe-${id}`, `${id} 水氣檢查`, s.syringes[id] === "正常"),
      ),
    ]);
    group(
      "probes",
      "三支探針拆洗與排水",
      detailedProbes.flatMap((id) => {
        const p = s.probes[id];
        return [
          item(
            `${id}-unlock`,
            `${id} 旋開鎖頭`,
            !!state.ledger[`unlocked-${id}`],
          ),
          item(
            `${id}-drained`,
            `${id} 等待液體滴完`,
            !!state.ledger[`drained-${id}`],
          ),
          item(
            `${id}-remove`,
            `${id} 提起取出`,
            !!state.ledger[`removed-${id}`],
          ),
          item(`${id}-wipe`, `${id} 擦拭 tip`, p.wiped),
          item(`${id}-wire`, `${id} 鐵絲通孔`, p.wired, true),
          item(
            `${id}-install`,
            `${id} 清潔後裝回`,
            p.installed && !!state.ledger[`installed-${id}`],
          ),
          item(
            `${id}-lock`,
            `${id} 復位鎖緊`,
            p.installed && p.locked && !!state.ledger[`locked-${id}`],
            true,
          ),
          item(
            `${id}-diag`,
            `${id} 正確設定並執行 DIAG`,
            !!state.ledger[`diag-${id}`],
            true,
          ),
          item(
            `${id}-drain`,
            `${id} DIAG 排水正常紀錄`,
            !!state.ledger[`diag-${id}`] && s.drains[id] === "正常",
            true,
          ),
        ];
      }),
    );
    group(
      "mixers",
      "兩組 mixer bar 清潔",
      ["R1S", "R2"].map((id) =>
        item(
          `group-${id}`,
          `${id} 取下清潔並裝回`,
          mixerIds
            .filter((x) => x.startsWith(id + "-"))
            .every((x) => s.mixers.includes(x)),
        ),
      ),
    );
    group(
      "wells",
      "十八個孔洞清潔",
      wellIds.map((id) =>
        item(id, `${id.slice(5)} 棉棒清潔孔洞`, s.wells.includes(id)),
      ),
    );
    group("mixdiag", "mixer bar 檢查與 DIAG", [
      ...["R1S", "R2"].map((id) =>
        item(`damage-${id}`, `${id} 無彎曲／損傷確認`, s.damage[id] === "正常"),
      ),
      item(
        "mixdiag",
        "Unit 1／次數 1 並執行 DIAG",
        !!state.ledger.mixDiag,
        true,
      ),
      item(
        "mixresult",
        "DIAG 運轉與異音正常紀錄",
        !!state.ledger.mixDiag && s.mix === "正常",
        true,
      ),
    ]);
    group("w2prep", "W2 與 CLEAN 配置", [
      item(
        "w2prep",
        "執行當時七瓶滿瓶、清洗液一致、Sample DET-2 留空、ISE DET-2 保留及 CLEAN 滿杯",
        !!state.ledger.w2Prepared,
        true,
      ),
    ]);
    group("w2", "W2 與 Photocal", [
      item("w2", "有效完成 W2", !!state.ledger.w2, true),
      item("photocal", "有效完成 Photocal", !!state.ledger.photocal, true),
    ]);
    group("monitor", "Photocal Monitor", [
      item("monitor", "Photocal 完成後查看並確認結果", s.reviewed),
    ]);
    group("restore", "Diluent 與配置復原", [
      ...["r1-inner-3", "r1-outer-3"].map((id) =>
        item(
          `diluent-${id}`,
          `${slotById[id].label} 依科內 SOP 清潔`,
          s.diluent.includes(id),
        ),
      ),
      item(
        "bottles",
        "七瓶 W2 移除且常駐配置恢復",
        w2Positions.every((id) => state.ledger[`w2Removed-${id}`]) &&
          Object.entries(initialBottles()).every(
            ([id, b]) => s.bottles[id]?.fluid === b.fluid,
          ),
        true,
      ),
      item(
        "iseRetain",
        "ISE DET-2 全程保留",
        !!state.ledger.w2Prepared &&
          !events.some(
            (e) =>
              e.command.type === "bottle" &&
              e.command.target === "ise-wash-2" &&
              e.command.value === "remove" &&
              e.accepted,
          ),
        true,
      ),
      item("cup", "用過 CLEAN 杯移除", s.cup === "discarded"),
      item(
        "lid",
        "最後關蓋",
        !!state.ledger.lidOpened &&
          (s.instrument
            ? !s.instrument.mainLid &&
              !s.instrument.iseTop &&
              !s.instrument.iseModule
            : !s.lid),
        true,
      ),
      item(
        "maintenance",
        "最後退出保養模式",
        !!state.ledger.maintenanceEntered &&
          (s.instrument
            ? !s.instrument.analyzerMaintenance && !s.instrument.iseMaintenance
            : !s.maintenance),
        true,
      ),
    ]);
  }
  return groups;
}
export function attemptProgress(
  kind: ExamKind,
  state: EngineState,
  events: ExamEvent[],
  version = versionForKind(kind),
) {
  const groups = attemptChecks(kind, state, events, version);
  return {
    completedGroups: groups.filter((g) => g.items.every((x) => x.completed))
      .length,
    totalGroups: groups.length,
  };
}
export function scoreAttempt(
  kind: ExamKind,
  state: EngineState,
  events: ExamEvent[],
  startedAt: number,
  submittedAt: number,
  version = versionForKind(kind),
): ExamResult {
  const s = state.sim,
    groups = attemptChecks(kind, state, events, version);
  if (hasModernDaily(version))
    for (const g of groups)
      for (const x of g.items)
        x.diagnosis = diagnoseCheck(x, events, s.reagents);
  const all = groups.flatMap((g) => g.items),
    critical = all.filter((x) => x.critical),
    errors = events.filter((e) => e.error);
  const signatures = new Set<string>();
  let repeatedActions = 0;
  events
    .filter(
      (e) =>
        e.accepted &&
        !e.error &&
        ![
          "prime",
          "fast-forward",
          "lid",
          "maintenance",
          "daily-mode",
          "diag",
          "diag-config",
          "index-edit",
          "preparation",
          "troubleshooting",
        ].includes(e.command.type),
    )
    .forEach((e) => {
      const signature = JSON.stringify(e.command);
      if (signatures.has(signature)) repeatedActions++;
      signatures.add(signature);
    });
  // A correction is a later valid action of the same category/target after a recorded error.
  const corrections = errors.filter((e) =>
    events
      .slice(events.indexOf(e) + 1)
      .some(
        (next) =>
          !next.error &&
          next.accepted &&
          next.command.type === e.command.type &&
          next.command.target === e.command.target &&
          (!hasDailyTasks(version) ||
            e.command.type !== "daily-syringe" ||
            next.command.data?.finding === e.command.data?.finding) &&
          (!hasModernDaily(version) ||
            e.command.type !== "rack" ||
            next.command.data?.category === e.command.data?.category),
      ),
  ).length;
  const waitingMs =
      state.waitingMs +
      (state.waitStarted ? Math.max(0, submittedAt - state.waitStarted) : 0),
    totalMs = Math.max(0, submittedAt - startedAt);
  const score =
    Math.round(
      (groups.reduce((n, g) => n + g.proportion, 0) / groups.length) * 1000,
    ) / 10;
  const criticalRatio = critical.length
    ? Math.round(
        (critical.filter((x) => x.completed).length / critical.length) * 1000,
      ) / 10
    : 100;
  return {
    score,
    criticalRatio,
    groups,
    completedCount: all.filter((x) => x.completed).length,
    totalCount: all.length,
    errors,
    corrections,
    repeatedActions,
    totalMs,
    waitingMs,
    operationMs: Math.max(0, totalMs - waitingMs),
    skippedMs: state.skippedMs,
    suggestions: [
      ...new Set([
        ...all.filter((x) => !x.completed).map((x) => x.suggestion),
        ...errors.map((e) => `重看 SOP 中「${e.label}」的條件：${e.error}。`),
      ]),
    ],
    badges: criticalRatio === 100 ? ["關鍵步驟全數完成"] : [],
  };
}

/** Read-only evidence annotation; historical scores and completion flags remain unchanged. */
export function diagnoseCheck(
  item: CheckItem,
  events: ExamEvent[],
  reagents: ReagentBottle[] = [],
) {
  if (item.completed) return { status: "✓ 已完成", reason: "" };
  const id = item.id;
  const related = events.filter((e) => {
    const c = e.command;
    if (id.startsWith("supply-"))
      return c.type === "bottle" && c.target === id.slice(7);
    if (id.startsWith("ise-reagent-"))
      return c.type === "ise-reagent" && c.target === id.slice(12);
    if (id.startsWith("syringe-"))
      return (
        c.type === "daily-syringe" &&
        id === `syringe-${c.target}-${c.data?.finding}`
      );
    if (id.startsWith("wipe-"))
      return c.type === "daily-wipe" && c.target === id.slice(5);
    if (id.startsWith("drain-"))
      return c.type === "daily-drain" && c.target === id.slice(6);
    if (id.startsWith("mix-"))
      return c.type === "daily-mix" && c.target === id.slice(4);
    if (id.startsWith("prime-")) return c.type === "prime";
    if (id.startsWith("drop-"))
      return (
        c.type === "drops" &&
        c.target === ["S-H", "S-L", "U-H", "U-L"][Number(id.slice(5))]
      );
    if (id.startsWith("reagent-"))
      return (
        c.type === "reagent" &&
        (c.target === id.slice(8) ||
          c.target === reagents[Number(id.slice(8))]?.id)
      );
    if (["serum", "urine"].includes(id))
      return c.type === "calibrate" && [id, "both"].includes(c.target || "");
    if (["cleanRemoved", "cup"].includes(id))
      return c.type === "cup" && c.value === "discarded";
    if (["calEntry", "serumEntry", "urineEntry"].includes(id))
      return (
        c.type === "rack" &&
        c.target === (id === "urineEntry" ? "Urine" : "Serum") &&
        (!c.data?.category ||
          c.data.category === (id === "calEntry" ? "calibration" : "qc"))
      );
    return (
      c.type ===
      (
        {
          temp: "temperature",
          index: "index",
          clean: "cleaning",
          calReview: "cal-review",
          all: "reagent-check",
          photocal: "fast-forward",
          monitor: "photocal-review",
          w2: "w2-start",
        } as Record<string, string>
      )[id]
    );
  });
  const last = related.at(-1);
  if (!last) return { status: "未操作", reason: "沒有找到對應操作紀錄。" };
  if (!last.accepted)
    return { status: "曾嘗試但被阻擋", reason: last.error || "操作未執行。" };
  if (last.error)
    return {
      status: last.error.includes("異常") ? "異常未排除" : "順序或配置不符",
      reason: last.error,
    };
  if (id.startsWith("ise-reagent-"))
    return {
      status: "檢查或更換未完成",
      reason:
        "三瓶須分別執行液量檢查；Standard、Buffer 不足時須更換。更換操作不代替液量檢查。",
    };
  if (id.startsWith("prime-") || ["serum", "urine", "calReview"].includes(id)) {
    const reset = [...events]
      .reverse()
      .find(
        (e) =>
          e.accepted &&
          !e.error &&
          e.command.type === "ise-reagent" &&
          e.command.value === "replace",
      );
    if (reset && events.indexOf(reset) > events.indexOf(last))
      return {
        status: "配置變更後須重做",
        reason: `${reset.label}後，須重新執行三次 Total Prime 及 ISE 校正。`,
      };
  }
  return {
    status: "已操作但未完成",
    reason: "已有操作紀錄，但次數、必要項目或最終狀態尚未符合完成條件。",
  };
}
