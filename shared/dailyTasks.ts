import {
  initialBottles,
  slotById,
  type BottleStates,
} from "../src/detergents.ts";
import type { InstrumentState } from "./dailyScenario.ts";

export const supplyIds = Object.entries(initialBottles())
  .filter(([, b]) => b.fluid)
  .map(([id]) => id);
export const dailySyringes = [
  "R2-2",
  "R2-1",
  "R1-1",
  "R1-2",
  "後方 syringe 組",
];
export const iseReagentIds = ["standard", "buffer", "reference"] as const;
export type IseReagentId = (typeof iseReagentIds)[number];
export const iseReagentNames = {
  standard: "ISE Standard",
  buffer: "ISE Buffer",
  reference: "ISE Reference",
};
export type Finding = "" | "正常" | "異常";
export interface DailyTasksState {
  refilled: string[];
  syringes: Record<string, { moisture: Finding; leak: Finding }>;
  iseReagents: Record<
    IseReagentId,
    { checked: boolean; sufficient: boolean; replaced: boolean }
  >;
}
export const initialDailyTasks = (): DailyTasksState => ({
  refilled: [],
  syringes: {},
  iseReagents: {
    standard: { checked: false, sufficient: false, replaced: false },
    buffer: { checked: false, sufficient: false, replaced: false },
    reference: { checked: false, sufficient: true, replaced: false },
  },
});
export const supplyComplete = (
  tasks: DailyTasksState,
  bottles: BottleStates,
  id: string,
) =>
  tasks.refilled.includes(id) &&
  bottles[id]?.fluid === initialBottles()[id].fluid &&
  bottles[id]?.level === 1;
export function tasksReadiness(tasks: DailyTasksState, bottles: BottleStates) {
  return {
    suppliesReady: supplyIds.every((id) => supplyComplete(tasks, bottles, id)),
    syringesReady: dailySyringes.every(
      (id) =>
        tasks.syringes[id]?.moisture === "正常" &&
        tasks.syringes[id]?.leak === "正常",
    ),
    iseReady: iseReagentIds.every(
      (id) => tasks.iseReagents[id].checked && tasks.iseReagents[id].sufficient,
    ),
  };
}
export type DailyTaskCommand = {
  type: "daily-syringe" | "ise-reagent";
  target?: string;
  value?: string | number | boolean;
  data?: Record<string, unknown>;
};
/** Mutates only a caller-owned copy; same physical rules in practice and exams. */
export function applyDailyTask(
  tasks: DailyTasksState,
  c: DailyTaskCommand,
  instrument: InstrumentState,
  busy = false,
): string {
  if (busy) return "儀器運轉中，無法操作。";
  const id = c.target || "";
  if (c.type === "daily-syringe") {
    if (
      !dailySyringes.includes(id) ||
      !["moisture", "leak"].includes(String(c.data?.finding)) ||
      !["", "正常", "異常"].includes(String(c.value))
    )
      return "無效 syringe 檢查。";
    if (
      !(id === "後方 syringe 組"
        ? instrument.rearSyringe
        : instrument.frontSyringe)
    )
      return "請先開啟對應的 syringe 櫃門。";
    const finding = c.data!.finding as "moisture" | "leak";
    tasks.syringes[id] = {
      ...(tasks.syringes[id] || { moisture: "", leak: "" }),
      [finding]: c.value as Finding,
    };
    return "";
  }
  if (
    !iseReagentIds.includes(id as IseReagentId) ||
    !["inspect", "replace"].includes(String(c.value))
  )
    return "無效 ISE 試劑操作。";
  if (!(id === "reference" ? instrument.iseReference : instrument.iseReagents))
    return "請先開啟對應的 ISE 試劑櫃門。";
  const reagent = tasks.iseReagents[id as IseReagentId];
  if (c.value === "inspect") reagent.checked = true;
  if (c.value === "replace") {
    reagent.sufficient = true;
    reagent.replaced = true;
  }
  return "";
}
export function recordSupply(tasks: DailyTasksState, id: string) {
  if (supplyIds.includes(id) && !tasks.refilled.includes(id))
    tasks.refilled.push(id);
}
export const supplyLabel = (id: string) =>
  `${slotById[id].bankId} · ${slotById[id].label}`;
export const dailySteps = [
  ["登記溫度", "Analyzer Status"],
  ["New Index", "Start Condition"],
  ["擦拭 6 支探針", "Analyzer Maintenance"],
  ["排水與攪拌檢查", "Analyzer Maintenance"],
  ["ISE Cleaning", "ISE Maintenance"],
  ["Total Prime × 3", "ISE Maintenance"],
  ["ISE 校正與結果檢查", "ISE Maintenance"],
  ["補充 CLN-1、Diluent、DET-1、DET-2", "日保養補充與檢查"],
  ["試劑更換與 All positions", "Reagent Management"],
  ["檢查 syringe 水氣／漏水", "日保養補充與檢查"],
  ["檢查 ISE Standard／Buffer／Reference", "日保養補充與檢查"],
  ["Rack Requisition · Calibration／Serum QC／Urine QC", "Rack Requisition"],
  ["校正與品管上機", "校正與品管上機"],
] as const;
