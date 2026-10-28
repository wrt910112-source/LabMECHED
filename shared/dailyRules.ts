import { dailyProbes } from "./maintenance.ts";

export function dailyDependencies(
  wiped: readonly string[],
  cleaned: boolean,
  prime: number,
) {
  return {
    canInspect: dailyProbes.every((id) => wiped.includes(id)),
    canPrime: cleaned,
    canCalibrate: cleaned && prime >= 3,
  };
}

export interface DailyRuleState {
  iseDrainRequired?: boolean;
  iseDrainValid?: boolean;
  temp: { saved: boolean };
  index: string;
  wiped: readonly string[];
  drains: Record<string, string>;
  mix: Record<string, string>;
  cleaned: boolean;
  prime: number;
  cal: { serum: boolean; urine: boolean; checked: boolean };
  drops: readonly string[];
  cleanCup: string;
  reagentReady: boolean;
  reagentChecked: boolean;
}

export function dailyReadiness(s: DailyRuleState) {
  const dependencies = dailyDependencies(s.wiped, s.cleaned, s.prime);
  const beforeRack = [
    s.temp.saved,
    !!s.index,
    dependencies.canInspect,
    dependencies.canInspect &&
      dailyProbes.every((id) => s.drains[id] === "正常") &&
      ["左側", "右側"].every((id) => s.mix[id] === "正常") &&
      (!s.iseDrainRequired || !!s.iseDrainValid),
    s.cleaned,
    dependencies.canCalibrate,
    dependencies.canCalibrate &&
      s.cal.serum &&
      s.cal.urine &&
      s.cal.checked &&
      s.cleanCup === "discarded" &&
      s.drops.length === 4 &&
      s.drops.every(
        (n) => n !== "" && Number.isInteger(Number(n)) && Number(n) >= 10,
      ),
    s.reagentReady && s.reagentChecked,
  ];
  return { ...dependencies, beforeRack, rackReady: beforeRack.every(Boolean) };
}
