import type {
  Attempt,
  ExamEvent,
  ExamCommand,
  EngineState,
  ExamKind,
  ActionOutcome,
} from "./exam";
import { attemptChecks } from "./exam.ts";
import { initialBottles } from "../src/detergents.ts";
export const analyticsVersion = "training-v1";
export type TrainingMode = "practice" | "exam";
export type ErrorCode =
  | "prerequisite"
  | "sequence"
  | "material"
  | "container"
  | "interpretation"
  | "invalid_input"
  | "other";
export const errorNames: Record<ErrorCode, string> = {
  prerequisite: "前置條件",
  sequence: "操作順序",
  material: "材料選擇",
  container: "容器／檢體架",
  interpretation: "結果判讀",
  invalid_input: "資料格式",
  other: "其他",
};
export interface Diagnostic {
  version: string;
  steps: string[];
  errorCode: ErrorCode | null;
  success: boolean;
}
export interface TrainingEvent extends ExamEvent {
  diagnostic?: Diagnostic | null;
}
export interface Timing {
  simulationWaitMs?: number | null;
  activeMs: number | null;
  quality: "complete" | "partial" | "unrecorded";
  observedSince: number | null;
}
export interface PracticeSession extends Omit<Attempt, "status" | "events"> {
  progress: NonNullable<Attempt["progress"]>;
  checks?: import("./exam").ScoreGroup[];
  mode: "practice";
  status: "active" | "completed" | "restarted";
  endedAt: number | null;
  timing: Timing;
  events?: TrainingEvent[];
}
export const practiceAttempt = (s: PracticeSession): Attempt => ({
  ...s,
  status:
    s.status === "active"
      ? "active"
      : s.status === "completed"
        ? "submitted"
        : "abandoned",
});

/** Server-owned assessment keys. Display text never determines classification. */
export function diagnoseEvent(
  kind: ExamKind,
  before: EngineState,
  c: ExamCommand,
  out: ActionOutcome,
  version: string,
): Diagnostic {
  const groups = attemptChecks(kind, out.state, [], version);
  const launched = new Set<string>();
  const steps = new Set<string>();
  const add = (group: string, id?: string) =>
    groups
      .filter((g) => g.id === group)
      .forEach((g) =>
        g.items
          .filter((i) => !id || i.id === id)
          .forEach((i) => steps.add(`${g.id}/${i.id}`)),
      );
  const s = before.sim,
    id = c.target || "",
    d = c.data || {};
  if (kind === "daily") {
    switch (c.type) {
      case "daily-mode":
        steps.add(`${c.value === "wipe" ? "wipe" : "inspect"}/action-start`);
        break;
      case "temperature":
        add("temp");
        break;
      case "index":
        add("index");
        break;
      case "daily-wipe":
        add("wipe", `wipe-${id}`);
        break;
      case "daily-drain":
        add("inspect", `drain-${id}`);
        break;
      case "daily-mix":
        add("inspect", `mix-${id}`);
        break;
      case "drain-result":
        if (id === "ISE") add("inspect", "drain-ISE");
        break;
      case "maintenance":
        if (id !== "ise" && c.value === false)
          add("inspect", "analyzer-maintenance-off");
        break;
      case "cleaning":
        add("clean");
        break;
      case "prime":
        if (s.prime < 3) add("prime", `prime-${s.prime + 1}`);
        break;
      case "drops":
        add("cal", `drop-${["S-H", "S-L", "U-H", "U-L"].indexOf(id)}`);
        break;
      case "calibrate":
        if (id !== "urine") add("cal", "serum");
        if (id !== "serum") add("cal", "urine");
        break;
      case "cal-review":
        add("cal", "calReview");
        break;
      case "cup":
        if (c.value === "discarded") add("cal", "cleanRemoved");
        break;
      case "reagent":
        add("reagent", `reagent-${s.reagents.findIndex((r) => r.id === id)}`);
        break;
      case "reagent-check":
        add("reagent", "all");
        break;
      case "bottle":
        add("supplies", `supply-${id}`);
        break;
      case "daily-syringe":
        add("syringes", `syringe-${id}-${d.finding}`);
        break;
      case "ise-reagent":
        add("ise-reagents", `ise-reagent-${id}`);
        break;
      case "rack":
        if (d.category === "calibration") add("rack", "calEntry");
        else if (d.category === "qc")
          add("rack", id === "Urine" ? "urineEntry" : "serumEntry");
        break;
      case "rack-qc-entry":
        add("rack", "serumEntry");
        add("rack", "urineEntry");
        break;
      case "preparation": {
        if (["select", "aspirate", "empty-pipette"].includes(String(d.action)))
          break;
        const old = attemptChecks(kind, before, [], version).find(
          (g) => g.id === "preparation",
        );
        const changed =
          groups
            .find((g) => g.id === "preparation")
            ?.items.filter(
              (i) =>
                i.completed &&
                !old?.items.find((x) => x.id === i.id)?.completed,
            ) || [];
        changed.forEach((i) => add("preparation", i.id));
        if (!changed.length && out.error) {
          const material = s.preparation?.cups.find(
            (x) => x.id === d.target,
          )?.materialId;
          if (material)
            groups
              .find((g) => g.id === "preparation")
              ?.items.filter((i) => i.id.includes(material))
              .forEach((i) => add("preparation", i.id));
          if (!steps.size) steps.add(`preparation/action-${String(d.action)}`);
        }
        break;
      }
    }
  } else if (kind === "troubleshooting") {
    const a = String(d.action),
      target = String(d.target || "");
    const mapped: Record<string, number[]> = {
      "confirm-rule": [
        s.troubleshooting?.selectedResult === "original" ? 4 : 1,
      ],
      factor: [2],
      run: [
        target === "original"
          ? 3
          : target === "calibration"
            ? 6
            : target === "final"
              ? 7
              : 3,
      ],
      "review-initial": [1],
      "review-original": [4],
      "confirm-qc": [7],
      "trace-check": [8],
      upload: [8],
      "save-phrases": [{ cause: 9, actions: 10, results: 11 }[target] || 9],
      submit: [12],
      "reagent-check": [5],
      "review-reagent-update": [5],
      pour: [5],
      mix: [5],
      install: [5],
      "remove-old": [5],
      "rack-entry": [6],
      preparation: [],
    };
    for (const n of mapped[a] || []) add(`uibc-${n}`);
    if (a === "confirm-qc") {
      steps.clear();
      add("uibc-7", "uibc-7-1");
    }
    if (a === "trace-check") {
      steps.clear();
      add("uibc-8", `uibc-8-${target === "P02" ? 1 : 0}`);
    }
    if (a === "upload") {
      steps.clear();
      add("uibc-8", "uibc-8-2");
    }
    if (a === "confirm-rule") {
      steps.clear();
      const group =
        s.troubleshooting?.selectedResult === "original" ? "uibc-4" : "uibc-1";
      add(group, `${group}-${group === "uibc-1" ? 1 : 0}`);
    }
    const reagentIndex =
      a === "remove-old"
        ? target === "R2"
          ? 1
          : 0
        : a === "pour"
          ? target === "R2"
            ? 5
            : 2
          : a === "mix"
            ? target === "R2"
              ? 6
              : 3
            : a === "install"
              ? target === "R2"
                ? 7
                : 4
              : a === "reagent-check"
                ? 8
                : a === "review-reagent-update"
                  ? 10
                  : null;
    if (reagentIndex !== null) {
      steps.clear();
      add("uibc-5", `uibc-5-${reagentIndex}`);
    }
    // Prefer the exact changed evidence within a mapped group when available.
    const old = attemptChecks(kind, before, [], version).flatMap((g) =>
      g.items.map((i) => [`${g.id}/${i.id}`, i.completed] as const),
    );
    const changed = groups.flatMap((g) =>
      g.items
        .filter(
          (i) =>
            i.completed && !old.find(([key]) => key === `${g.id}/${i.id}`)?.[1],
        )
        .map((i) => `${g.id}/${i.id}`),
    );
    if (!out.error && changed.length) {
      steps.clear();
      changed.forEach((key) => steps.add(key));
    }
  }
  // An accepted asynchronous launch is an actual assessed operation. Its
  // completion evidence remains separate and is checked after the timer ends.
  if (
    kind === "troubleshooting" &&
    out.accepted &&
    !out.error &&
    ["run", "batch-push", "upload", "submit"].includes(String(d.action))
  ) {
    const pending = out.state.sim.troubleshooting?.pending;
    const groupId =
      pending &&
      (
        {
          original: "uibc-3",
          fresh: "uibc-5",
          calibration: "uibc-6",
          final: "uibc-7",
          upload: "uibc-8",
          submit: "uibc-12",
        } as Record<string, string>
      )[pending.kind];
    const group = groups.find((g) => g.id === groupId);
    const item =
      pending?.kind === "final" ? group?.items[0] : group?.items.at(-1);
    if (group && item) {
      const key = `${group.id}/${item.id}`;
      steps.add(key);
      launched.add(key);
    }
  }
  let errorCode: ErrorCode | null = null;
  if (out.error) {
    if (!steps.size)
      steps.add(
        `${kind}/action-${kind === "troubleshooting" ? String(d.action || "unknown") : c.type}`,
      );
    errorCode = "other";
    if (["temperature", "index", "drops", "diag-config"].includes(c.type))
      errorCode = "invalid_input";
    if (
      ["daily-drain", "daily-mix", "drain-result", "cal-review"].includes(
        c.type,
      )
    )
      errorCode = out.accepted ? "interpretation" : "prerequisite";
    if (
      [
        "daily-mode",
        "prime",
        "cleaning",
        "calibrate",
        "rack",
        "rack-qc-entry",
      ].includes(c.type)
    )
      errorCode = out.accepted ? "sequence" : "prerequisite";
    if (["bottle", "ise-reagent", "reagent"].includes(c.type))
      errorCode =
        c.type === "bottle" &&
        c.value === "replace" &&
        d.fluid !== initialBottles()[id]?.fluid
          ? "material"
          : "prerequisite";
    if (c.type === "daily-wipe" || c.type === "daily-syringe")
      errorCode = out.accepted ? "interpretation" : "prerequisite";
    if (c.type === "preparation")
      errorCode = ["place", "stage", "push", "retrieve"].includes(
        String(d.action),
      )
        ? "container"
        : "material";
    if (c.type === "troubleshooting") {
      const a = String(d.action);
      errorCode = ["confirm-rule", "confirm-qc", "save-phrases"].includes(a)
        ? "interpretation"
        : ["pour", "mix", "install", "remove-old", "replace-qc"].includes(a)
          ? "material"
          : ["rack-entry", "preparation"].includes(a)
            ? "container"
            : "prerequisite";
    }
  }
  const completed = new Set(
    groups.flatMap((g) =>
      g.items.filter((i) => i.completed).map((i) => `${g.id}/${i.id}`),
    ),
  );
  return {
    version: analyticsVersion,
    steps: [...steps].filter(
      (key) =>
        !!out.error ||
        completed.has(key) ||
        launched.has(key) ||
        key.endsWith("/action-start"),
    ),
    errorCode,
    success: out.accepted && !out.error,
  };
}
