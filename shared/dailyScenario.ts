import type { RackSelection } from "../src/requisitionData.ts";

export const legacyDailyV3 = "AU5800-2026-10-21-v3";
export const legacyDailyV4 = "AU5800-2026-10-22-v4";
export const legacyDailyV5 = "AU5800-2026-10-27-v5";
export const currentDailyVersion = "AU5800-2026-10-28-v6";
export const hasPreparation = (version: string) =>
  version === currentDailyVersion;
export const legacyWeeklyV2 = "AU5800-weekly-2026-10-21-v2";
export const currentWeeklyVersion = "AU5800-weekly-2026-10-27-v3";
export const hasDailyIseDrain = (version: string) =>
  [legacyDailyV5, currentDailyVersion].includes(version);
export const hasDailyTasks = (version: string) =>
  [legacyDailyV4, legacyDailyV5, currentDailyVersion].includes(version);
export const hasRevisedWorkstation = (version: string) =>
  [legacyDailyV5, currentDailyVersion, currentWeeklyVersion].includes(version);
export const hasWeeklyHardware = (version: string) =>
  [legacyWeeklyV2, currentWeeklyVersion].includes(version);
export const hasModernDaily = (version: string) =>
  [legacyDailyV3, legacyDailyV4, legacyDailyV5, currentDailyVersion].includes(
    version,
  );
export interface ReagentBottle {
  id?: string;
  test?: string;
  name: string;
  side: string;
  remaining: number;
  need: number;
  reason: string;
  reviewed: boolean;
  replaced: boolean;
  note: string;
  rb?: "valid" | "expired" | "unchecked";
  cal?: "valid" | "expired" | "na" | "unchecked";
}
export function examReagents(version = currentDailyVersion): ReagentBottle[] {
  const rows = [
    ["ALT", "3.ALT", "R1", "R1-21"],
    ["ALT", "3.ALT", "R2", "R2-22"],
    ["HDL", "15.HDL", "R1", "R1-15"],
    ["HDL", "15.HDL", "R2", "R2-15"],
    ["LDL", "20.LDL", "R1", "R1-20"],
    ["LDL", "20.LDL", "R2", "R2-20"],
    ["CRE", "9.CRE", "R1", "R1-27"],
    ["CRE", "9.CRE", "R2", "R2-38"],
    ["AMY", "4.AMY", "R1", "R1-49"],
  ];
  if (hasDailyIseDrain(version))
    rows.splice(
      2,
      0,
      ["AST", "5.AST", "R1", "R1-33"],
      ["AST", "5.AST", "R2", "R2-24"],
    );
  return rows.map(([name, test, side, id]) => ({
    id,
    test,
    name,
    side,
    remaining: name === "AMY" ? 180 : 25,
    need: 100,
    reason: name === "AMY" ? "即將到期" : "量不足",
    reviewed: false,
    replaced: false,
    note: "",
    rb: "valid",
    cal: ["ALT", "AST", "AMY"].includes(name) ? "na" : "valid",
  }));
}
export const reagentReady = (r: ReagentBottle) =>
  r.replaced && r.remaining >= r.need;
export function calibrationNeeds(
  reagents: ReagentBottle[],
): Pick<RackSelection, "rb" | "cal"> {
  return {
    rb: [
      ...new Set(
        reagents
          .filter((r) => r.rb === "expired" && r.test)
          .map((r) => r.test!),
      ),
    ],
    cal: [
      ...new Set(
        reagents
          .filter((r) => r.cal === "expired" && r.test)
          .map((r) => r.test!),
      ),
    ],
  };
}

export interface InstrumentState {
  analyzerMaintenance: boolean;
  iseMaintenance: boolean;
  mainLid: boolean;
  iseTop: boolean;
  iseModule: boolean;
  frontSyringe?: boolean;
  rearSyringe?: boolean;
  iseReagents?: boolean;
  iseReference?: boolean;
}
export const initialInstrument = (): InstrumentState => ({
  analyzerMaintenance: false,
  iseMaintenance: false,
  mainLid: false,
  iseTop: false,
  iseModule: false,
});
export const canWipe = (s: InstrumentState, busy = false) => s.mainLid && !busy;
export const canHandleCups = (s: InstrumentState, busy = false) =>
  s.iseTop && !busy;
export const canRunIse = (
  s: InstrumentState,
  calibration = false,
  busy = false,
) =>
  !busy && !s.iseModule && (calibration ? !s.iseMaintenance : s.iseMaintenance);

export const canRunIseProgram = (
  s: InstrumentState,
  program: "cleaning" | "prime" | "calibration",
  busy = false,
) =>
  !busy &&
  !s.iseModule &&
  (program === "prime" ? s.iseMaintenance : !s.iseMaintenance);

/** Bottle access differs from program access; v5 does not require ISE Maintenance. */
export function canHandleBottle(
  s: InstrumentState,
  module: string,
  busy = false,
  iseMaintenanceRequired = false,
) {
  return (
    !busy &&
    (module === "ise"
      ? s.iseTop && (!iseMaintenanceRequired || s.iseMaintenance)
      : s.mainLid && s.analyzerMaintenance)
  );
}
export const validProbeDiag = (c: { unit: boolean; count: number }) =>
  c.unit && Number.isInteger(c.count) && c.count >= 3 && c.count <= 10;
export const canRunIseProbeDiag = (s: InstrumentState, busy = false) =>
  canRunIse(s, false, busy);
