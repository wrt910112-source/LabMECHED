import { materialById, type Material } from "./materialCatalog.ts";
import {
  applyPreparation,
  initialPreparation,
  cupFilled,
  type PreparationState,
  type PreparationAction,
} from "./preparation.ts";
import { emptyRack, type RackSelection } from "../src/requisitionData.ts";

export const troubleVersion = "AU5800-UIBC-2026-10-29-v1";
export const troubleTitle = "UIBC 品管異常：從判讀到回溯";
export const troubleGate = { ready: true, token: troubleVersion };
export const troubleIdentity = {
  instrument: "M229／AU5800",
  test: "UIBC",
  name: "MAS chem-TRAK-H",
  specimen: "MAS27091",
  lot: "27091",
  level: "異常濃度（正式濃度代碼待確認）",
};
export const levels = {
  primary: {
    label: "異常濃度",
    mean: 157,
    sd: 8,
    history: [154, 160, 156, 159, 153, 161, 157, 155, 158, 154, 162, 156],
  },
  second: {
    label: "第二濃度",
    mean: 50.4,
    sd: 7.3,
    history: [50, 53, 49, 52, 48, 54, 51, 50, 52, 49, 53, 51],
  },
};
export type Level = keyof typeof levels;
export type RunKind = "original" | "fresh" | "calibration" | "final";
export const runNames: Record<RunKind, string> = {
  original: "原杯品管重新上機",
  fresh: "更換品管液後重測",
  calibration: "UIBC 重新校正",
  final: "重新執行兩濃度 QC",
};
export const troubleMaterials: Material[] = [
  materialById.lcc1,
  materialById.lcc2,
  ...(["primary", "second"] as const).map((level) => ({
    ...materialById["mas-1"],
    id: `uibc-${level}`,
    name: level === "primary" ? "MAS chem-TRAK-H／MAS27091" : "第二濃度",
    concentration: levels[level].label,
    identity: "pending" as const,
    aliases: [],
    notes: ["本情境不由 H 推定濃度。正式瓶身效期、濃度代碼待設定。"],
    photo: {
      file: "real-photos/QC.jpg",
      caption: "本院 QC 儲存架參考，非本情境27091批號核對證據",
    },
  })),
];
export const troubleCatalog = Object.fromEntries(
  troubleMaterials.map((m) => [m.id, m]),
);
export const traceRows = [
  { id: "P01", original: 322, current: 320 },
  { id: "P02", original: 167, current: 165 },
];
export const differencePercent = (original: number, current: number) =>
  (Math.abs(current - original) / original) * 100;
export const traceAcceptable = (original: number, current: number) =>
  original > 0 && differencePercent(original, current) < 10.2;
export const sdi = (level: Level, value: number) =>
  (value - levels[level].mean) / levels[level].sd;
export function qcRule(level: Level, value: number, previous?: number | null) {
  const current = sdi(level, value),
    prior = previous == null ? 0 : sdi(level, previous);
  if (Math.abs(current) > 3) return "1.3S";
  if (Math.abs(current) > 2 && Math.abs(prior) > 2 && current * prior > 0)
    return "2.2S";
  return "";
}
export const phraseLists = {
  cause: [
    ["A1", "品管液放反"],
    ["A2", "新批號試劑"],
    ["A3", "新泡製試劑"],
    ["A4", "新瓶品管液"],
    ["A5", "新品管液批號"],
    ["A6", "Random error"],
    ["A7", "品管液污染"],
  ],
  actions: [
    ["B21", "重新執行品管"],
    ["B22", "執行檢體回溯"],
    ["B23", "無檢體上機，不需執行檢體回溯。"],
    ["B24", "原杯品管液重測"],
    ["B25", "原罐品管液"],
    ["B26", "開新品管液"],
    ["B27", "重新校正"],
    ["B28", "更換試劑"],
  ],
  results: [
    ["C1", "品管合格"],
    ["C2", "品管不合格"],
    ["C3", "進行檢體回溯，待合批收。"],
    ["C4", "前一班無檢體上機，不需進行檢體回溯。"],
  ],
  prevention: [],
} as const;
export type FormField = keyof typeof phraseLists;
export const expectedPhrases = {
  cause: ["A3"],
  actions: ["B28", "B27", "B21", "B22"],
  results: ["C1", "C3"],
};
export function phraseText(field: FormField, ids: string[]) {
  const ordered =
    field === "actions"
      ? [
          ...expectedPhrases.actions,
          ...ids.filter((id) => !expectedPhrases.actions.includes(id)),
        ]
      : ids;
  return [...new Set(ordered)]
    .filter((id) => ids.includes(id))
    .map((id) => phraseLists[field].find((p) => p[0] === id)?.[1] || "")
    .filter(Boolean)
    .join("\n");
}
export interface TroubleResult {
  id: string;
  level: Level;
  stage: string;
  value: number | null;
  rule: string;
  order: number;
  context: string;
}
export interface TroubleLog {
  seq: number;
  action: string;
  target: string;
  ok: boolean;
  message: string;
}
type Pair = "R1" | "R2";
export interface TroubleState {
  version: string;
  seq: number;
  preparation: PreparationState;
  reviewed: string[];
  chartSeen: boolean;
  factors: string[];
  rule13: boolean;
  rule22: boolean;
  originalVerified: boolean;
  sourceVersion: number;
  aliquots: Record<string, { version: number; serial: number }>;
  used: string[];
  reagent: {
    old: Record<Pair, boolean>;
    mix: Record<Pair, { source: string | null; mixed: boolean }>;
    slots: Record<Pair, string | null>;
    checked: boolean;
    generation: number;
  };
  calibration: "baseline" | "required" | "running" | "success" | "failed";
  qcRecovered: boolean;
  patientHold: true;
  results: TroubleResult[];
  runs: Partial<Record<RunKind, boolean>>;
  rack: ReturnType<typeof emptyRack>;
  trace: string[];
  report: {
    file: string | null;
    status: "pending" | "uploading" | "success" | "failed";
  };
  form: Record<FormField, { ids: string[]; text: string }>;
  submission: "draft" | "sending" | "sent-awaiting-review";
  pending: null | {
    kind: RunKind | "upload" | "submit";
    due: number;
    success: boolean;
    signatures: string[];
  };
  log: TroubleLog[];
}
export interface TroubleAction {
  action:
    | "view"
    | "review-result"
    | "inspect"
    | "confirm-rule"
    | "verify-original"
    | "replace-qc"
    | "preparation"
    | "run"
    | "remove-old"
    | "pour"
    | "mix"
    | "install"
    | "remove-new"
    | "reset-reagent"
    | "reagent-check"
    | "rack-entry"
    | "trace-check"
    | "select-report"
    | "upload"
    | "save-phrases"
    | "submit";
  target?: string;
  value?: string;
  data?: Record<string, unknown>;
}
export function initialTroubleshooting(): TroubleState {
  const preparation = initialPreparation();
  preparation.scenario = troubleVersion;
  Object.assign(preparation.cups[0], {
    materialId: "uibc-primary",
    concentration: levels.primary.label,
    additions: 1,
    fillSerial: 1,
  });
  return {
    version: troubleVersion,
    seq: 0,
    preparation,
    reviewed: [],
    chartSeen: false,
    factors: [],
    rule13: false,
    rule22: false,
    originalVerified: false,
    sourceVersion: 0,
    aliquots: {},
    used: [],
    reagent: {
      old: { R1: true, R2: true },
      mix: {
        R1: { source: null, mixed: false },
        R2: { source: null, mixed: false },
      },
      slots: { R1: "old-R1", R2: "old-R2" },
      checked: false,
      generation: 0,
    },
    calibration: "baseline",
    qcRecovered: false,
    patientHold: true,
    results: [
      {
        id: "initial",
        level: "primary",
        stage: "initial",
        value: 183,
        rule: "1.3S",
        order: 13,
        context: "保養後首次 QC；待處理",
      },
    ],
    runs: {},
    rack: emptyRack(),
    trace: [],
    report: { file: null, status: "pending" },
    form: {
      cause: { ids: [], text: "" },
      actions: { ids: [], text: "" },
      results: { ids: [], text: "" },
      prevention: { ids: [], text: "" },
    },
    submission: "draft",
    pending: null,
    log: [],
  };
}
const add = (xs: string[], id: string) => (xs.includes(id) ? xs : [...xs, id]);
function record(
  s: TroubleState,
  action: string,
  target: string,
  ok: boolean,
  message: string,
) {
  s.log.push({ seq: ++s.seq, action, target, ok, message });
}
export const aliquotSignature = (c: PreparationState["cups"][number]) =>
  `${c.id}:${c.fillSerial || 0}:${c.materialId}`;
function invalidate(s: TroubleState) {
  s.reagent.checked = false;
  s.reagent.generation++;
  s.calibration = "required";
  s.qcRecovered = false;
  s.trace = [];
  s.report.status = "pending";
  s.runs.calibration = false;
  s.runs.final = false;
  // Physical cups stay where the learner put them, but a load performed for
  // an earlier reagent configuration cannot count as a new execution.
  for (const rack of ["CALI", "QC"] as const)
    s.preparation.racks[rack].loadedToken = null;
}
export function chartRows(s: TroubleState, level: Level): TroubleResult[] {
  return [
    ...levels[level].history.map((value, i) => ({
      id: `history-${level}-${i}`,
      level,
      stage: "history",
      value,
      rule: "",
      order: i + 1,
      context: "模擬正常歷史",
    })),
    ...s.results.filter((r) => r.level === level && r.value !== null),
  ];
}
export function advanceTroubleshooting(
  input: TroubleState,
  now: number,
): TroubleState {
  const s = structuredClone(input),
    p = s.pending;
  if (!p || now < p.due) return s;
  s.pending = null;
  if (p.kind === "upload") s.report.status = p.success ? "success" : "failed";
  else if (p.kind === "submit")
    s.submission = p.success ? "sent-awaiting-review" : "draft";
  else if (p.kind === "calibration") {
    s.calibration = p.success ? "success" : "failed";
    s.runs.calibration = p.success;
  } else if (p.success) {
    const order = Math.max(...s.results.map((r) => r.order)) + 1;
    if (p.kind === "original")
      s.results.push({
        id: "original",
        level: "primary",
        stage: "original",
        value: 179,
        rule: qcRule("primary", 179, 183),
        order,
        context: "核對原杯、裝架上機後重測",
      });
    if (p.kind === "fresh")
      s.results.push({
        id: "fresh",
        level: "primary",
        stage: "fresh",
        value: null,
        rule: "仍異常",
        order,
        context: "更換品管液後實際重測；量測值待設定，不繪製圖點",
      });
    if (p.kind === "final")
      for (const [level, value] of [
        ["primary", 155],
        ["second", 50],
      ] as const)
        s.results.push({
          id: `final-${level}-${s.reagent.generation}`,
          level,
          stage: "final",
          value,
          rule: "",
          order,
          context: "重新校正成功後重新執行 QC",
        });
    s.runs[p.kind] = true;
  }
  if (p.success) s.used = [...new Set([...s.used, ...p.signatures])];
  record(
    s,
    "執行完成",
    p.kind,
    p.success,
    p.success
      ? p.kind === "submit"
        ? "已呈送，待審核"
        : p.kind === "upload"
          ? "模擬回溯報告上傳成功"
          : p.kind === "original"
            ? "原杯重測完成：179，SDI +2.75，2.2S"
            : p.kind === "fresh"
              ? "更換品管液後重測仍異常；數值待設定"
              : p.kind === "final"
                ? "兩濃度QC執行完成：155（SDI −0.25）、50（SDI約−0.055），待各自核對"
                : `${p.kind in runNames ? runNames[p.kind as RunKind] : p.kind}完成`
      : "模擬執行失敗；條件維持未完成，可重試",
  );
  return s;
}
export const troubleStepNames = [
  "審核 QC",
  "查看 L-J 圖與相關因素",
  "原杯品管重新上機",
  "再次審批與判讀 2.2S",
  "材料處理與更換 UIBC 試劑",
  "重新校正",
  "執行並確認兩濃度 QC",
  "檢體回溯與上傳報告",
  "填寫原因探討",
  "記錄矯正措施",
  "記錄矯正結果",
  "呈送",
];
function correctField(s: TroubleState, field: keyof typeof expectedPhrases) {
  const ids = expectedPhrases[field],
    f = s.form[field];
  return (
    f.ids.length === ids.length &&
    ids.every((id) => f.ids.includes(id)) &&
    f.text.trim() === phraseText(field, ids)
  );
}
export function troubleChecks(s: TroubleState) {
  const flags = [
    [s.reviewed.includes("initial"), s.chartSeen],
    [
      s.rule13,
      ...["qc", "reagent", "calibration"].map((id) => s.factors.includes(id)),
    ],
    [s.originalVerified, !!s.runs.original],
    [s.reviewed.includes("original"), s.rule22],
    [
      s.sourceVersion > 0,
      !!s.runs.fresh,
      !s.reagent.old.R1,
      !s.reagent.old.R2,
      ...(["R1", "R2"] as const).flatMap((p) => [
        s.reagent.mix[p].source === p + "a",
        s.reagent.mix[p].mixed,
        s.reagent.slots[p] === `new-${p}`,
      ]),
      s.reagent.checked,
    ],
    [s.rack.Serum.cal.includes("27.UIBC"), s.calibration === "success"],
    [!!s.runs.final, s.qcRecovered],
    [
      s.trace.includes("P01"),
      s.trace.includes("P02"),
      s.report.status === "success",
    ],
    [correctField(s, "cause")],
    [correctField(s, "actions")],
    [correctField(s, "results")],
    [s.submission === "sent-awaiting-review"],
  ];
  return troubleStepNames.map((label, i) => ({
    id: `uibc-${i + 1}`,
    label,
    flags: flags[i],
    done: flags[i].every(Boolean),
  }));
}
export function readyToSend(s: TroubleState) {
  return troubleChecks(s)
    .slice(0, 11)
    .every((g) => g.done);
}
export function applyTroubleshooting(
  input: TroubleState,
  c: TroubleAction,
  now: number,
  options: {
    durationMs?: number;
    calibrationOutcome?: boolean;
    uploadOutcome?: boolean;
  } = {},
) {
  const s = advanceTroubleshooting(input, now),
    a = typeof c?.action === "string" ? c.action : "invalid",
    t = typeof c?.target === "string" ? c.target : "",
    data = c?.data || {};
  const done = (error = "", label: string = a, target = t) => {
    record(s, label, target, !error, error || "操作已記錄");
    return { state: s, error, label, accepted: !error };
  };
  const fail = (error: string) => done(error);
  if (
    !c ||
    a === "invalid" ||
    (c.target !== undefined && typeof c.target !== "string") ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  )
    return fail("無效情境操作");
  if (a === "view") {
    if (t === "chart" && s.reviewed.includes("initial")) s.chartSeen = true;
    return done("", `查看 ${t}`);
  }
  if (a === "review-result") {
    const r = s.results.find((r) => r.id === t);
    if (!r) return fail("結果尚未產生");
    s.reviewed = add(s.reviewed, t);
    const finals = s.results
      .filter(
        (r) => r.stage === "final" && r.id.endsWith(`-${s.reagent.generation}`),
      )
      .slice(-2);
    if (
      s.calibration === "success" &&
      s.runs.final &&
      finals.length === 2 &&
      finals.every((r) => s.reviewed.includes(r.id) && !r.rule)
    )
      s.qcRecovered = true;
    return done("", `查看 QC ${r.value ?? "仍異常，數值待設定"}`);
  }
  if (a === "inspect") {
    if (!["qc", "reagent", "calibration"].includes(t))
      return fail("無效的因素資料");
    s.factors = add(s.factors, t);
    return done("", `查看 ${t} 因素`);
  }
  if (s.submission === "sent-awaiting-review")
    return fail("本次已呈送，待主管審核／允收");
  if (s.pending) return fail("模擬執行中，請稍候");
  if (a === "confirm-rule") {
    if (c.value === "1.3S" && s.chartSeen && s.reviewed.includes("initial"))
      s.rule13 = true;
    else if (
      c.value === "2.2S" &&
      s.reviewed.includes("original") &&
      s.results.some((r) => r.id === "original")
    )
      s.rule22 = true;
    else return fail("判讀與目前執行紀錄不符");
    return done("", `確認判讀 ${c.value}`);
  }
  if (a === "verify-original") {
    if (
      data.test !== "UIBC" ||
      data.specimen !== "MAS27091" ||
      data.cup !== "cup-1"
    )
      return fail("項目、標本號或原杯身分不符");
    s.originalVerified = true;
    return done("", "核對原杯身分");
  }
  if (a === "replace-qc") {
    if (!s.rule22) return fail("請先完成原杯重測結果的再次判讀");
    if (!s.sourceVersion) s.sourceVersion = 1;
    return done("", "更換本次品管液來源瓶（批號27091）");
  }
  if (a === "preparation") {
    const command = data as unknown as PreparationAction;
    if (command.action === "reset") return fail("請從情境入口重新開始本次任務");
    const result = applyPreparation(s.preparation, command, troubleGate, {
      catalog: troubleCatalog,
    });
    s.preparation = result.state;
    if (!result.error && command.action === "dispense") {
      const cup = s.preparation.cups.find((x) => x.id === command.target)!;
      s.aliquots[cup.id] = {
        version: s.sourceVersion,
        serial: cup.fillSerial || 0,
      };
    }
    return done(
      result.error,
      `備料 ${String(command.action)}`,
      typeof command.target === "string"
        ? command.target
        : typeof command.rack === "string"
          ? command.rack
          : s.preparation.source || "",
    );
  }
  const pair = t as Pair;
  if (
    [
      "remove-old",
      "mix",
      "install",
      "remove-new",
      "reset-reagent",
      "pour",
    ].includes(a)
  ) {
    if (!["R1", "R2"].includes(t)) return fail("請選取 R1 或 R2");
    if (!s.runs.fresh) return fail("請先完成更換品管液後的重測");
    if (a === "remove-old") {
      if (!s.reagent.old[pair]) return done("", "舊試劑已取出");
      s.reagent.old[pair] = false;
      s.reagent.slots[pair] = null;
      invalidate(s);
    } else if (a === "pour") {
      if (!["R1a", "R2a"].includes(c.value || ""))
        return fail("請選取加入來源");
      if (s.reagent.slots[pair] === `new-${pair}`)
        return fail("請先取回新瓶再準備");
      if (s.reagent.mix[pair].source)
        return fail("來源已加入；重新準備本瓶後才能再加入");
      s.reagent.mix[pair] = { source: c.value!, mixed: false };
      invalidate(s);
      if (c.value !== pair + "a")
        return fail("來源與目標瓶配對不符，已保留實際加入紀錄");
    } else if (a === "mix") {
      if (s.reagent.mix[pair].mixed) return done("", `UIBC ${pair} 已混勻`);
      if (!s.reagent.mix[pair].source) return fail("請先加入來源液");
      s.reagent.mix[pair].mixed = true;
      invalidate(s);
    } else if (a === "install") {
      const bank = c.value as Pair;
      if (!["R1", "R2"].includes(bank)) return fail("請選取儲存槽");
      if (s.reagent.slots[bank])
        return fail("槽位仍被占用，請先取出舊瓶或目前瓶子");
      if (Object.values(s.reagent.slots).includes(`new-${pair}`))
        return fail("此新瓶已放入儲存槽");
      s.reagent.slots[bank] = `new-${pair}`;
      invalidate(s);
    } else if (a === "remove-new") {
      const bank = (["R1", "R2"] as const).find(
        (p) => s.reagent.slots[p] === `new-${pair}`,
      );
      if (bank) {
        s.reagent.slots[bank] = null;
        invalidate(s);
      }
    } else {
      if (Object.values(s.reagent.slots).includes(`new-${pair}`))
        return fail("請先取回新瓶");
      s.reagent.mix[pair] = { source: null, mixed: false };
      invalidate(s);
    }
    return done("", `${a} UIBC ${t}${c.value ? " ← " + c.value : ""}`);
  }
  if (a === "reagent-check") {
    if (
      !(["R1", "R2"] as const).every(
        (p) =>
          !s.reagent.old[p] &&
          s.reagent.mix[p].source === p + "a" &&
          s.reagent.mix[p].mixed &&
          s.reagent.slots[p] === `new-${p}`,
      )
    )
      return fail("Reagent Check 未通過；請核對取出、加入、混勻與儲存槽配置");
    s.reagent.checked = true;
    if (s.calibration !== "success") s.calibration = "required";
    return done("", "Reagent Check 成功；UIBC 需校正");
  }
  if (a === "rack-entry") {
    if (data.type !== undefined && data.type !== "Serum")
      return fail("本情境UIBC使用Serum申請；未改寫其他類別");
    const category = data.category,
      selection = data.selection as RackSelection;
    if (
      !["calibration", "qc", "sample"].includes(String(category)) ||
      !selection ||
      !["rb", "cal", "qc", "sample"].every(
        (k) =>
          Array.isArray(selection[k as keyof RackSelection]) &&
          selection[k as keyof RackSelection].every(
            (v) => typeof v === "string",
          ),
      )
    )
      return fail("申請格式無效");
    if (category === "calibration")
      s.rack.Serum = {
        ...s.rack.Serum,
        rb: [...selection.rb],
        cal: [...selection.cal],
      };
    else if (category === "qc") s.rack.Serum.qc = [...selection.qc];
    else s.rack.Serum.sample = [...selection.sample];
    return done("", `Rack ${category} Entry（尚未執行）`);
  }
  if (a === "run") {
    if (!Object.hasOwn(runNames, t)) return fail("無效執行項目");
    const kind = t as RunKind;
    if (s.runs[kind]) return done("", "此執行批次已完成，未新增結果");
    if (
      kind !== "calibration" &&
      s.calibration !== "baseline" &&
      s.calibration !== "success"
    )
      return fail("UIBC 試劑已更換，請先完成校正。");
    const loaded = (material: string, rack: "QC" | "CALI", fresh = false) =>
      s.preparation.cups.find(
        (c) =>
          c.materialId === material &&
          cupFilled(c, troubleCatalog) &&
          c.rack === rack &&
          s.preparation.racks[rack].location === "loaded" &&
          s.preparation.racks[rack].loadedToken === troubleGate.token &&
          (!fresh ||
            (c.id !== "cup-1" &&
              !s.used.includes(aliquotSignature(c)) &&
              s.aliquots[c.id]?.version === s.sourceVersion &&
              s.sourceVersion > 0)),
      );
    let cups: PreparationState["cups"] = [];
    if (kind === "original") {
      const c = s.preparation.cups[0];
      if (
        !troubleChecks(s)
          .slice(0, 2)
          .every((g) => g.done) ||
        !s.originalVerified ||
        loaded("uibc-primary", "QC")?.id !== c.id ||
        c.fillSerial !== 1
      )
        return fail("原杯重測條件或上機身分不符");
      cups = [c];
    } else if (kind === "fresh") {
      const cup = loaded("uibc-primary", "QC", true);
      if (!s.rule22 || !cup) return fail("需更換來源並重新分裝、裝架上機");
      cups = [cup];
    } else if (kind === "calibration") {
      const cup = loaded("lcc2", "CALI");
      if (!s.reagent.checked || !s.rack.Serum.cal.includes("27.UIBC") || !cup)
        return fail("UIBC 校正申請、試劑檢查或 LCC2 上機尚未完成");
      cups = [cup];
      s.calibration = "running";
    } else {
      const a = loaded("uibc-primary", "QC", true),
        b = loaded("uibc-second", "QC", true);
      if (
        s.calibration !== "success" ||
        !s.rack.Serum.qc.includes("27.UIBC") ||
        !a ||
        !b
      )
        return fail("兩個濃度須各自重新備料、申請及上機，且校正成功");
      cups = [a, b];
    }
    s.pending = {
      kind,
      due: now + (options.durationMs ?? 650),
      success:
        kind === "calibration" ? (options.calibrationOutcome ?? true) : true,
      signatures: cups.map(aliquotSignature),
    };
    return done("", `執行 ${runNames[kind]}`);
  }
  if (a === "trace-check") {
    if (!s.qcRecovered) return fail("QC 尚未恢復，不能開始本次回溯核對");
    const row = traceRows.find((r) => r.id === t);
    if (!row || !traceAcceptable(row.original, row.current))
      return fail("回溯資料或判定不符");
    s.trace = add(s.trace, t);
    return done("", `核對回溯 ${t}`);
  }
  if (a === "select-report") {
    if (t !== "UIBC_回溯報告.pdf") return fail("本情境使用具名模擬回溯報告");
    if (s.report.status !== "success")
      s.report = { file: t, status: "pending" };
    return done("", "選取模擬報告");
  }
  if (a === "upload") {
    if (s.report.status === "success")
      return done("", "報告已上傳，未重複新增附件");
    if (s.trace.length !== 2 || !s.report.file)
      return fail("請完成兩筆回溯核對並選取報告");
    s.report.status = "uploading";
    s.pending = {
      kind: "upload",
      due: now + (options.durationMs ?? 650),
      success: options.uploadOutcome ?? true,
      signatures: [],
    };
    return done("", "開始模擬上傳");
  }
  if (a === "save-phrases") {
    if (!Object.hasOwn(phraseLists, t)) return fail("無效表單欄位");
    const field = t as FormField,
      ids = data.ids,
      text = data.text;
    if (
      !Array.isArray(ids) ||
      !ids.every(
        (id) =>
          typeof id === "string" && phraseLists[field].some((p) => p[0] === id),
      ) ||
      typeof text !== "string" ||
      text.length > 2000
    )
      return fail("片語格式不符");
    s.form[field] = { ids: [...new Set(ids)], text };
    return done("", `儲存 ${field} 片語`);
  }
  if (a === "submit") {
    if (!readyToSend(s)) return fail("必要處置、回溯報告或表單尚未完成");
    s.submission = "sending";
    s.pending = {
      kind: "submit",
      due: now + (options.durationMs ?? 650),
      success: true,
      signatures: [],
    };
    return done("", "模擬呈送");
  }
  return fail("未知情境操作");
}
