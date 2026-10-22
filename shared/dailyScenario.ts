import type { RackSelection } from "../src/requisitionData.ts";

export const legacyDailyV3 = "AU5800-2026-10-21-v3";
export const currentDailyVersion = "AU5800-2026-10-22-v4";
export const hasModernDaily = (version: string) =>
  [legacyDailyV3, currentDailyVersion].includes(version);
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
export function examReagents(): ReagentBottle[] {
  return [
    ["ALT", "3.ALT", "R1", "R1-21"],
    ["ALT", "3.ALT", "R2", "R2-22"],
    ["HDL", "15.HDL", "R1", "R1-15"],
    ["HDL", "15.HDL", "R2", "R2-15"],
    ["LDL", "20.LDL", "R1", "R1-20"],
    ["LDL", "20.LDL", "R2", "R2-20"],
    ["CRE", "9.CRE", "R1", "R1-27"],
    ["CRE", "9.CRE", "R2", "R2-38"],
    ["AMY", "4.AMY", "R1", "R1-49"],
  ].map(([name, test, side, id]) => ({
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
    cal: ["ALT", "AMY"].includes(name) ? "na" : "valid",
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
