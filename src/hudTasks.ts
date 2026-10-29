import { practiceAction } from "./dailyActions";
import type { Daily } from "./DailyTraining";
import {
  weeklyCompletion,
  weeklyStepNames,
  type Weekly,
  weeklyProbes,
  weeklyRods,
  mixerGroups,
  weeklyWells,
} from "./WeeklyTraining";
import {
  dailySteps,
  supplyIds,
  supplyComplete,
  dailySyringes,
  iseReagentIds,
} from "../shared/dailyTasks";
import { dailyProbes } from "../shared/maintenance";

export type Quest = {
  id: string;
  label: string;
  route: string;
  done: boolean;
  available: boolean;
  reason: string;
  targets: string[];
  count?: number;
  total?: number;
  instruction?: string;
  controls?: string[];
};
export function dailyQuests(d: Daily): Quest[] {
  const targets = [
    ["console"],
    ["console"],
    d.wipeAccessible
      ? dailyProbes.filter((id) => !d.wiped.includes(id))
      : ["analyzer"],
    d.mode === "inspect"
      ? [
          ...dailyProbes.filter((id) => d.drains[id] !== "正常"),
          ...["左側", "右側"].filter((id) => d.mix[id] !== "正常"),
          ...(!d.iseDrainValid ? ["console"] : []),
        ]
      : ["console"],
    d.cleanCup === "full" ? ["console"] : d.cupAccessible ? ["U-L"] : ["ise"],
    ["console"],
    d.cleanCup !== "discarded" ||
    d.drops.some((n) => n === "" || Number(n) < 10)
      ? !d.cupAccessible
        ? ["ise"]
        : d.cleanCup !== "discarded"
          ? ["U-L"]
          : ["S-H", "S-L", "U-H", "U-L"].filter(
              (_, i) => d.drops[i] === "" || Number(d.drops[i]) < 10,
            )
      : ["console"],
    ["console"],
    [
      ...new Set(
        supplyIds
          .filter((id) => !supplyComplete(d.tasks, d.bottles, id))
          .map((id) =>
            id.startsWith("ise-")
              ? !d.instrument.iseTop
                ? "ise"
                : id
              : !d.instrument.mainLid
                ? "analyzer"
                : !d.instrument.analyzerMaintenance
                  ? "console"
                  : id,
          ),
      ),
    ],
    ["syringes", "rear-syringes"],
    ["ise-reagents", "ise-reference"],
    ["console"],
  ];
  const available = [
    true,
    true,
    true,
    d.canInspect || !d.iseDrainValid,
    true,
    d.canPrime && d.iseReady,
    d.canCalibrate && d.iseReady,
    true,
    true,
    true,
    true,
    d.rackReady,
  ];
  targets.push(["preparation"]);
  available.push(d.loadingGate.ready);
  const reasons = [
    "",
    "",
    "",
    "先完成六支探針擦拭",
    "",
    "先完成 Cleaning，並確認三瓶 ISE 試劑",
    "先完成 Cleaning、三次 Prime 及 ISE 試劑檢查",
    "",
    "",
    "",
    "",
    "先完成其他保養項目",
  ];
  const instructions = [
    "操作電腦 → Analyzer Status，輸入 Bath／Coolant 讀值，按儲存溫度紀錄。",
    "操作電腦 → Start Condition，選 Edit 後建立 New Index；溫度與 Index 可互換順序。",
    d.wipeAccessible
      ? "選取任一尚未擦拭的探針，使用酒精棉。六支之間不限制先後。"
      : practiceAction(d, "wipe", dailyProbes[0]).reason,
    d.mode === "inspect"
      ? "六支分析探針排水、左右攪拌及 ISE 排水共九項。ISE 在 ISE Maintenance → Replace Sample Probe 設定並執行 DIAG；不依賴六支擦拭。"
      : "分析單元檢查須先完成六支擦拭；ISE 排水可獨立在 ISE Maintenance → Replace Sample Probe 執行。",
    d.cleanCup !== "full"
      ? "開啟 ISE 黑色上蓋，在 CLEAN 位置放入裝滿 Cleaning Solution 的杯子。"
      : "關閉 module 鐵蓋，取消 ISE Maintenance，選 Cleaning。",
    "確認三瓶 ISE 試劑、關閉 module 鐵蓋並勾選 ISE Maintenance，在電腦執行三次 Total Prime。",
    "取出用過 CLEAN，四個校正杯各至少十滴；取消 ISE Maintenance 後執行 Serum／Urine 校正並檢查結果。",
    "在 Reagent Management 檢查、記錄及更換必要試劑；溫度、Index 與十二瓶補充完成後執行 All positions。",
    "逐瓶補滿或更換十二瓶。依所選槽位開啟對應上蓋及 Maintenance，不提供一鍵全部補滿。",
    "開啟對應前／後櫃門，分別記錄水氣與漏水；前方四支及後方整組都須確認。",
    "開啟 Standard／Buffer 黑蓋及 Reference 櫃門，逐瓶檢查，並更換不足者。",
    "其他項目完成後，在 Rack Requisition Entry 保存 Calibration，再一次 Entry 保存 Serum／Urine QC。",
  ];
  const controls = [
    [
      "Analyzer Status",
      "input:Bath Temp. 登記",
      "input:Coolant Temp. 登記",
      "儲存溫度紀錄",
    ],
    ["Start Condition", d.editing ? "New Index" : "Edit"],
    [
      "Analyzer Maintenance",
      "主蓋開啟",
      ...dailyProbes
        .filter((id) => practiceAction(d, "wipe", id).enabled)
        .map((id) => `酒精棉擦拭 ${id}`),
    ],
    [
      "Analyzer Maintenance",
      d.canInspect ? "Inspect Probe & Mixing Bar" : "Cleaning Probe",
    ],
    [
      "ISE Maintenance",
      ...(d.instrument.iseMaintenance ? ["input:ISE Maintenance"] : []),
      ...(d.instrument.iseModule ? ["input:ISE module 蓋開啟"] : []),
      d.cleanCup === "full"
        ? "Cleaning"
        : "在 CLEAN 放置裝滿的 Cleaning Solution",
    ],
    [
      "ISE Maintenance",
      ...(!d.instrument.iseMaintenance ? ["input:ISE Maintenance"] : []),
      ...(d.instrument.iseModule ? ["input:ISE module 蓋開啟"] : []),
      ...(d.canPrime && d.iseReady ? ["Total Prime"] : []),
    ],
    ["ISE Maintenance", "Calibration"],
    ["Reagent Management", "Details"],
    ["日保養補充與檢查"],
    ["日保養補充與檢查"],
    ["日保養補充與檢查"],
    ["Rack Requisition", "Calibration", "QC"],
  ];
  reasons.push("先完成有效的十二組保養及 Rack 登記。");
  instructions.push(
    "前往備料工作台：選取來源液、吸取、分裝、同色架裝架，放至進樣區並推入。固定16份獨立教學情境。",
  );
  controls.push([]);
  const counts: [number, number][] = [
    [Number(d.temp.saved), 1],
    [Number(!!d.index), 1],
    [
      dailyProbes.filter((id) => d.wiped.includes(id)).length,
      dailyProbes.length,
    ],
    [
      dailyProbes.filter((id) => d.drains[id] === "正常").length +
        ["左側", "右側"].filter((id) => d.mix[id] === "正常").length +
        Number(d.iseDrainValid),
      9,
    ],
    [Number(d.cleaned), 1],
    [d.prime, 3],
    [
      Number(d.cal.serum) +
        Number(d.cal.urine) +
        Number(d.cal.checked) +
        Number(d.cleanCup === "discarded") +
        d.drops.filter(
          (n) => n !== "" && Number.isInteger(Number(n)) && Number(n) >= 10,
        ).length,
      8,
    ],
    [
      d.reagents.filter((r) => r.replaced && r.remaining >= r.need).length,
      d.reagents.length,
    ],
    [
      supplyIds.filter((id) => supplyComplete(d.tasks, d.bottles, id)).length,
      supplyIds.length,
    ],
    [
      dailySyringes.reduce(
        (n, id) =>
          n +
          Number(d.tasks.syringes[id]?.moisture === "正常") +
          Number(d.tasks.syringes[id]?.leak === "正常"),
        0,
      ),
      dailySyringes.length * 2,
    ],
    [
      iseReagentIds.filter(
        (id) =>
          d.tasks.iseReagents[id].checked && d.tasks.iseReagents[id].sufficient,
      ).length,
      iseReagentIds.length,
    ],
    [
      Number(
        d.reagentChecked &&
          d.calibrationNeeds.rb.length > 0 &&
          d.calibrationNeeds.rb.every((id) => d.rack.Serum.rb.includes(id)) &&
          d.calibrationNeeds.cal.every((id) => d.rack.Serum.cal.includes(id)),
      ) +
        Number(d.rack.Serum.qc.length > 0) +
        Number(d.rack.Urine.qc.length > 0),
      3,
    ],
  ];
  counts.push([d.loadingProgress.completed, d.loadingProgress.total]);
  return dailySteps.map(([label, route], i) => ({
    id: `daily-${i}`,
    label,
    route,
    done: !!d.completed[i],
    available: available[i],
    reason: available[i] ? "" : reasons[i],
    targets: targets[i],
    instruction: instructions[i],
    controls: controls[i],
    count: counts[i][0],
    total: counts[i][1],
  }));
}
export function weeklyQuests(w: Weekly): Quest[] {
  const done = weeklyCompletion(w);
  // These describe the existing step/cleanWell/cleanGroup/start guards. They
  // never mutate progress or turn list position into a required sequence.
  const rodsClean = weeklyRods.every((id) => w.progress[id] === 3);
  const pendingProbes = weeklyProbes.filter(
    (id) => w.progress[id] !== 7 || w.drains[id] !== "正常",
  );
  const probeTargets = [
    ...new Set(
      pendingProbes.map((id) =>
        (id === "ISE" ? !w.iseTop : !w.lid)
          ? id === "ISE"
            ? "ise"
            : "analyzer"
          : (id === "ISE" ? !w.iseMaintenance : !w.maintenance) ||
              w.progress[id] === 7
            ? "console"
            : id,
      ),
    ),
  ];
  const rodTargets = !w.lid
    ? ["analyzer"]
    : !w.maintenance
      ? ["console"]
      : mixerGroups
          .filter(
            (g) =>
              !weeklyRods
                .filter((id) => id.startsWith(g + "-"))
                .every((id) => w.progress[id] === 3),
          )
          .map((g) => `group-${g}`);
  const targets = [
    ["syringes"],
    probeTargets,
    rodTargets,
    !w.lid
      ? ["analyzer"]
      : !w.maintenance
        ? ["console"]
        : !w.swabReady
          ? ["group-R1S"]
          : weeklyWells.filter((id) => !w.wells.includes(id)),
    [w.pendingDiag === "mix" ? "diag-front" : "console"],
    ["r1-inner-1", "r2-outer-1", w.iseTop ? "U-L" : "ise"],
    ["console"],
    ["console"],
    ["r1-inner-3", "r1-outer-3"],
  ];
  const available = [
    true,
    w.ready,
    w.ready,
    w.ready && rodsClean,
    rodsClean && w.wellsDone,
    true,
    w.ready && w.probesDone && w.rodsDone && w.wellsDone && w.w2Ready && w.cup,
    w.phase === "done",
    w.phase === "done",
  ].map((v) => v && !w.busy);
  const reasons = [
    "",
    "先完成準備及四支 syringe 檢查",
    "先完成準備及四支 syringe 檢查",
    "先完成兩組攪拌棒清潔",
    "先完成攪拌棒及 18 孔清潔",
    "",
    "先完成探針、攪拌檢查、18 孔清潔及 W2／CLEAN 配置",
    "等待 W2 與 Photocal 完成",
    "等待 W2 與 Photocal 完成",
  ];
  const instructions = [
    "確認準備物品，開啟前方 syringe 櫃門，逐支記錄水氣正常。",
    "Sample 與 ISE 探針可分別進行。開啟對應上蓋及 Maintenance，依鎖頭、探針工具操作，裝回後設定排水及記錄結果。",
    "開啟主蓋並進入 Analyzer Maintenance，分別取下清潔兩組 mixer bar、裝回並記錄損傷檢查。",
    "兩組攪拌棒清潔後，將棉棒沾 Cleaning Solution，再逐孔清潔。18 孔之間不限制順序。",
    "記錄兩組損傷檢查正常，在電腦設定 Replace Mix Bar，再按模型 DIAG 並記錄攪拌狀態。",
    "依既有槽位放入同種滿瓶 W2，Sample 兩側 DET-2 留空，ISE DET-2 保留，並準備 CLEAN 滿杯。",
    "在 Analyzer Maintenance 開啟 W2，確認 Photocal 與 ISE Cleaning (Enhanced)，依原條件關蓋後開始。",
    "在 Analyzer Maintenance 的 Photocal Monitor 檢查本次結果並確認。",
    "依原流程取出 W2、清潔 Diluent 槽、裝回原配置及取出 CLEAN，最後退出保養模式並關閉蓋子。",
  ];
  const counts: [number, number][] = [
    [
      Number(w.prepared) +
        Object.values(w.syringes).filter((v) => v === "正常").length,
      5,
    ],
    [
      weeklyProbes.reduce(
        (n, id) => n + (w.progress[id] || 0) + Number(w.drains[id] === "正常"),
        0,
      ),
      weeklyProbes.length * 8,
    ],
    [
      mixerGroups.filter((g) =>
        weeklyRods
          .filter((id) => id.startsWith(g + "-"))
          .every((id) => w.progress[id] === 3),
      ).length,
      mixerGroups.length,
    ],
    [w.wells.length, weeklyWells.length],
    [
      Number(w.mix === "正常") +
        mixerGroups.filter((g) => w.damage[g] === "正常").length,
      3,
    ],
    [Number(w.w2Ready) + Number(w.cup), 2],
    [Number(w.phase === "done"), 1],
    [Number(w.reviewed), 1],
    [Number(w.complete), 1],
  ];
  return weeklyStepNames.map((label, i) => ({
    id: `weekly-${i}`,
    label,
    done: !!done[i],
    route: [4, 6, 7].includes(i) ? "Analyzer Maintenance" : "周保養",
    available: available[i],
    reason: available[i]
      ? ""
      : w.busy
        ? "儀器程序執行中，請等待完成。"
        : reasons[i],
    targets: available[i] ? targets[i] : [],
    instruction: instructions[i],
    count: counts[i][0],
    total: counts[i][1],
    controls:
      i === 6
        ? ["Analyzer Maintenance", "W2"]
        : i === 7
          ? ["Analyzer Maintenance", "Photocal Monitor", "確認本次正常結果"]
          : i === 4
            ? ["Analyzer Maintenance", "Replace Mix Bar"]
            : [],
  }));
}
