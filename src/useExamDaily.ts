import { useEffect, useRef, useState, type SetStateAction } from "react";
import type { Attempt, ExamCommand } from "../shared/exam";
import { dailyProbes } from "../shared/maintenance";
import type { Daily } from "./DailyTraining";
import {
  initialInstrument,
  calibrationNeeds,
  canWipe,
  canHandleCups,
  validProbeDiag,
} from "../shared/dailyScenario";
import { dailyReadiness } from "../shared/dailyRules";
import { initialDailyTasks, tasksReadiness } from "../shared/dailyTasks";
import { initialPreparation, preparationProgress } from "../shared/preparation";

const valueOf = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (v: T) => T)(current) : value;
// A UI adapter only. Every mutation is an exam event; the server owns progress and grading.
export function useExamDaily(
  attempt: Attempt,
  dispatch: (command: ExamCommand) => Promise<boolean>,
  blocked: boolean,
  reset: () => void,
): Daily {
  const s = attempt.sim;
  const instrument = s.instrument || initialInstrument();
  const tasks = s.dailyTasks || initialDailyTasks();
  const [tempDraft, setTempDraft] = useState<typeof s.temp | null>(null);
  const [dropDraft, setDropDraft] = useState<string[] | null>(null);
  const dropRef = useRef(s.drops);
  dropRef.current = dropDraft || s.drops;
  useEffect(() => {
    if (blocked) {
      setTempDraft(null);
      setDropDraft(null);
    }
  }, [blocked]);
  useEffect(() => {
    if (JSON.stringify(s.drops) === JSON.stringify(dropRef.current))
      setDropDraft(null);
  }, [s.drops]);
  const call = (c: ExamCommand) => {
    if (!blocked)
      void dispatch(c).then((ok) => {
        if (!ok) {
          setTempDraft(null);
          setDropDraft(null);
        }
      });
  };
  const extra = tasksReadiness(tasks, s.bottles);
  const iseDrainValid = s.diag === "ISE" && s.drains.ISE === "正常";
  const needs = calibrationNeeds(s.reagents);
  const reagentReady = s.reagents.every(
    (r) => r.replaced && r.remaining >= r.need,
  );
  const rules = dailyReadiness({
    ...s,
    temp: s.temp,
    drains: s.dailyDrains,
    mix: s.dailyMix,
    cleanCup: s.cup,
    reagentReady,
    reagentChecked: s.reagentChecked,
    analyzerMaintenance: instrument.analyzerMaintenance,
    iseDrainRequired: true,
    iseDrainValid,
  });
  const rackReady =
    rules.rackReady &&
    extra.suppliesReady &&
    extra.syringesReady &&
    extra.iseReady;
  const preparation = s.preparation || initialPreparation();
  const loadingGate = attempt.preparationAccess || { ready: false, token: "" };
  const loadingProgress = preparationProgress(preparation, loadingGate);
  const completed = [
    ...rules.beforeRack.slice(0, 7),
    extra.suppliesReady,
    rules.beforeRack[7],
    extra.syringesReady,
    extra.iseReady,
    rackReady &&
      needs.rb.length > 0 &&
      needs.rb.every((id) => s.rack.Serum.rb.includes(id)) &&
      needs.cal.every((id) => s.rack.Serum.cal.includes(id)) &&
      s.rack.Serum.qc.length > 0 &&
      s.rack.Urine.qc.length > 0,
    loadingProgress.done,
  ];
  return {
    ...extra,
    ...rules,
    active: true,
    instrument,
    bottles: s.bottles,
    tasks,
    preparation,
    loadingGate,
    loadingProgress,
    completed,
    stage: completed.findIndex((v) => !v),
    reset,
    setInstrument: (change) => {
      const next = valueOf(change, instrument);
      for (const key of Object.keys(next) as (keyof typeof instrument)[]) {
        if (next[key] === instrument[key]) continue;
        if (key === "analyzerMaintenance" || key === "iseMaintenance")
          call({
            type: "maintenance",
            target: key === "iseMaintenance" ? "ise" : "analyzer",
            value: !!next[key],
          });
        else call({ type: "cover", target: key, value: !!next[key] });
      }
    },
    temp: tempDraft || s.temp,
    setTemp: (change) => {
      const next = valueOf(change, tempDraft || s.temp);
      setTempDraft(next);
      if (next.saved)
        call({
          type: "temperature",
          data: { bath: next.bath, coolant: next.coolant },
        });
    },
    editing: s.indexEditing,
    index: s.index,
    setEditing: (change) => {
      if (valueOf(change, s.indexEditing)) call({ type: "index-edit" });
    },
    setIndex: () => call({ type: "index" }),
    mode: instrument.analyzerMaintenance ? s.dailyMode : "",
    wiped: s.wiped,
    drains: { ...s.dailyDrains, ISE: s.drains.ISE || "" },
    mix: s.dailyMix,
    setWiped: (change) => {
      for (const id of valueOf(change, s.wiped).filter(
        (id) => !s.wiped.includes(id),
      ))
        call({ type: "daily-wipe", target: id });
    },
    setDrains: (change) => {
      const next = valueOf(change, s.dailyDrains);
      for (const [id, value] of Object.entries(next))
        if (dailyProbes.includes(id) && value !== s.dailyDrains[id])
          call({ type: "daily-drain", target: id, value });
    },
    setMix: (change) => {
      const next = valueOf(change, s.dailyMix);
      for (const [id, value] of Object.entries(next))
        if (value !== s.dailyMix[id])
          call({ type: "daily-mix", target: id, value });
    },
    cleanCup: s.cup,
    setCleanCup: (change) =>
      call({ type: "cup", value: valueOf(change, s.cup) }),
    cleaned: s.cleaned,
    prime: s.prime,
    drops: dropDraft || s.drops,
    setDrops: (change) => {
      const next = valueOf(change, dropRef.current);
      const before = dropRef.current;
      dropRef.current = next;
      setDropDraft(next);
      next.forEach((n, i) => {
        if (n !== before[i] && n !== "")
          call({
            type: "drops",
            target: ["S-H", "S-L", "U-H", "U-L"][i],
            value: Number(n),
          });
      });
    },
    cal: s.cal,
    setCal: (change) => {
      const next = valueOf(change, s.cal);
      call(
        next.checked
          ? { type: "cal-review" }
          : {
              type: "calibrate",
              target:
                next.serum && next.urine
                  ? "both"
                  : next.serum
                    ? "serum"
                    : "urine",
            },
      );
    },
    reagents: s.reagents,
    reagentReady,
    reagentChecked: s.reagentChecked,
    setReagents: (change) => {
      const next = valueOf(change, s.reagents);
      next.forEach((r, i) => {
        if (r.replaced && !s.reagents[i].replaced)
          call({ type: "reagent", target: r.id, value: "replace" });
      });
    },
    setReagentChecked: (change) => {
      if (valueOf(change, s.reagentChecked)) call({ type: "reagent-check" });
    },
    replaceReagent: (id) =>
      call({ type: "reagent", target: id, value: "replace" }),
    checkReagents: () => {
      call({ type: "reagent-check" });
      return "操作已送出。";
    },
    calibrationNeeds: needs,
    rack: s.rack,
    setRack: (change) => {
      const next = valueOf(change, s.rack);
      for (const [type, selection] of Object.entries(next))
        if (JSON.stringify(selection) !== JSON.stringify(s.rack[type]))
          call({
            type: "rack",
            target: type,
            data: { category: "calibration", selection },
          });
    },
    canInspect: rules.canInspect && instrument.analyzerMaintenance,
    rackReady,
    wipeAccessible: canWipe(instrument) && instrument.analyzerMaintenance,
    cupAccessible: canHandleCups(instrument),
    iseDrainValid,
    iseDiag: {
      unit: s.diagConfig.unit,
      cuvette: s.diagConfig.cuvette,
      count: s.diagConfig.count,
      saved: s.diagConfig.target === "ISE" && validProbeDiag(s.diagConfig),
      ran: s.diag === "ISE",
    },
    saveIseDiag: (config) => {
      call({ type: "diag-config", target: "ISE", data: config });
      return "操作已送出。";
    },
    runIseDiag: () => {
      call({ type: "diag", target: "ise" });
      return "操作已送出。";
    },
    recordIseDrain: (value) => {
      call({ type: "drain-result", target: "ISE", value });
      return "操作已送出。";
    },
    taskAction: (command) => {
      call(command);
      return "操作已送出。";
    },
    refill: (id) => {
      call({ type: "bottle", target: id, value: "refill" });
      return "操作已送出。";
    },
    supplyChanged: (id, next) =>
      call({
        type: "bottle",
        target: id,
        value: next[id].fluid ? "replace" : "remove",
        data: { fluid: next[id].fluid || "" },
      }),
    prepare: (data) => {
      call({ type: "preparation", data: { ...data } });
      return "";
    },
    action: (name) => {
      call(
        name === "Cleaning"
          ? { type: "cleaning" }
          : name === "Total Prime"
            ? { type: "prime" }
            : {
                type: "daily-mode",
                value: name === "Cleaning Probe" ? "wipe" : "inspect",
              },
      );
      return "操作已送出。";
    },
  };
}
