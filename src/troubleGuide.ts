import {
  batchCups,
  manualTroubleCheck,
  requiresQcConfirmation,
  reagentReady,
  expectedPhrases,
  phraseText,
  troubleChecks,
  type TroubleState,
} from "../shared/troubleshooting";
import type { MaterialKind } from "../shared/materialCatalog";
export interface TroubleHint {
  target: string;
  text: string;
  model?: string;
}
export interface GuideUi {
  workspace: string;
  rule: string;
  followup: string;
  cup: string;
  rack: MaterialKind;
  slot: number;
  selection: string | null;
  view: string;
  install: boolean;
  bank: string;
  batches: string[];
  factor: string;
  rr: TroubleHint | null;
  phrase: TroubleHint | null;
  browse: boolean;
  management?: TroubleHint | null;
}
export function nextTroubleHint(
  s: TroubleState,
  u: GuideUi,
): TroubleHint | null {
  if (s.pending) return null;
  const i = troubleChecks(s).findIndex((c) => !c.done);
  if (i < 0) return null;
  const at = (workspace: string, hint: TroubleHint): TroubleHint =>
    u.workspace === workspace
      ? hint
      : {
          target: `nav-${workspace}`,
          text: `前往${
            (
              {
                chart: "L-J 圖",
                factors: "相關因素",
                bench: "備料工作台",
                reagent: "UIBC 試劑",
                calibration: "Rack Requisition",
                management: "Reagent Management",
                trace: "檢體回溯填報",
                form: "品管異常處理表",
              } as Record<string, string>
            )[workspace]
          }`,
        };
  const h = (target: string, text: string): TroubleHint => ({ target, text });
  const object = (id: string, action: string, text: string) => {
    const view = Object.values(s.reagent.slots).includes(id)
      ? "reagent"
      : "bench";
    if (u.view !== view)
      return h(
        "reagent-view",
        `切換至${view === "bench" ? "配製工作台" : "儲存槽"}`,
      );
    if (u.selection !== `bottle:${id}`)
      return {
        target: `object-${id}`,
        text: `選取 ${id.replace("old-", "舊 UIBC ").replace("new-", "新 UIBC ")}`,
        model: `bottle:${id}`,
      };
    return h(action, text);
  };
  const place = (id: string, rack: MaterialKind): TroubleHint => {
    const c = s.preparation.cups.find((c) => c.id === id)!;
    if (u.cup !== id) return h("cup", `選取杯${id.split("-")[1]}`);
    if (c.rack) {
      if (c.rack === rack) return h("batch-stage", "放至進樣區");
      if (u.rack !== c.rack) return h("rack", `先選擇杯子所在的 ${c.rack} 架`);
      if (s.preparation.racks[c.rack].location !== "bench")
        return h("retrieve", "先取回杯子所在檢體架");
      return h("unrack", "取回放錯架的容器");
    }
    if (u.rack !== rack)
      return h(
        "rack",
        `選擇${{ RB: "藍色 RB", CALI: "黃色 CALI", QC: "綠色 QC" }[rack]}架`,
      );
    if (s.preparation.racks[rack].location !== "bench")
      return h("retrieve", `取回${rack}架再裝入新杯`);
    if (s.preparation.cups.some((c) => c.rack === rack && c.slot === u.slot))
      return h("slot", "選擇一個未占用的教學空位");
    return h("place", "放入架位");
  };
  if (i === 0 || i === 3) {
    const id = i === 0 ? "initial" : "original",
      rule = i === 0 ? "1.3S" : "2.2S",
      action = i === 0 ? "original" : "troubleshoot";
    if (u.workspace === "approval" && !s.reviewed.includes(id))
      return h(`review-${id}`, `選取UIBC ${i === 0 ? 183 : 179}異常結果`);
    if (s.selectedResult !== id)
      return at(
        "chart",
        h(`point-${id}`, `點選 ${i === 0 ? 183 : 179} 異常點`),
      );
    if (u.rule !== rule) return at("chart", h("rule", `選擇 ${rule}`));
    if (u.followup !== action)
      return at(
        "chart",
        h("followup", `選擇「${i === 0 ? "原杯品管液上機" : "進行異常處理"}」`),
      );
    return at("chart", h("confirm-rule", "按確認判讀"));
  }
  if (i === 1) {
    const id = ["qc", "reagent", "calibration"].find(
      (id) => !s.factors.includes(id),
    )!;
    const name = { qc: "品管液", reagent: "UIBC 試劑", calibration: "校正" }[
      id
    ];
    return at(
      "factors",
      u.factor === id
        ? h(`inspect-${id}`, `按已查看${name}資料`)
        : h(`factor-${id}`, `展開${name}資料`),
    );
  }
  if (i === 2) {
    if (!s.originalVerified)
      return at("chart", h("open-original", "按原杯品管液上機"));
    const c = s.preparation.cups[0],
      r = s.preparation.racks.QC;
    if (c.materialId !== "uibc-primary" || c.fillSerial !== 1)
      return at("bench", h("restart", "原杯身分已改變，請重新開始本情境"));
    if (c.rack !== "QC") return at("bench", place(c.id, "QC"));
    if (u.batches.length !== 1 || u.batches[0] !== "QC")
      return at("bench", h("batch-QC", "本次只選綠色 QC 架"));
    return at(
      "bench",
      h(
        r.location === "bench" ? "batch-stage" : "batch-push",
        r.location === "bench" ? "放至進樣區" : "推入儀器，自動執行原杯重測",
      ),
    );
  }
  if (i === 4) {
    if (manualTroubleCheck(s) && reagentReady(s)) {
      for (const key of ["R1", "R2", "main"] as const)
        if (s.covers?.[key])
          return at(
            "reagent",
            h(`cover-${key}`, `蓋回${key === "main" ? "儀器" : key}上蓋`),
          );
      return at(
        "management",
        u.management || h("rm-details", "前往Reagent Management執行檢查"),
      );
    }
    for (const key of ["main", "R1", "R2"] as const)
      if (!s.covers?.[key])
        return at(
          "reagent",
          h(`cover-${key}`, `打開${key === "main" ? "儀器" : key}上蓋`),
        );
    for (const key of ["R1", "R2"] as const)
      if (s.reagent.old[key])
        return at(
          "reagent",
          object(`old-${key}`, "remove-old", `取出舊 UIBC ${key}`),
        );
    for (const key of ["R1", "R2"] as const) {
      const m = s.reagent.mix[key],
        installed = Object.entries(s.reagent.slots).find(
          ([, id]) => id === `new-${key}`,
        );
      if (m.source && m.source !== key + "a") {
        return at(
          "reagent",
          object(
            `new-${key}`,
            installed ? "remove-new" : "reset-reagent",
            installed
              ? "先取回來源配對不符的新瓶"
              : "重新準備來源配對不符的新瓶",
          ),
        );
      }
      if (!m.source)
        return at("reagent", object(key + "a", `pour-${key}`, `加入 ${key}`));
      if (!m.mixed)
        return at("reagent", object(`new-${key}`, "mix", "混和均勻"));
      if (installed && installed[0] !== key)
        return at(
          "reagent",
          object(`new-${key}`, "remove-new", "取回放錯槽的新瓶"),
        );
      if (!installed) {
        if (u.selection !== `bottle:new-${key}` || u.view !== "bench")
          return at(
            "reagent",
            object(`new-${key}`, "install-open", "放入儀器"),
          );
        if (!u.install) return at("reagent", h("install-open", "放入儀器"));
        if (u.bank !== key)
          return at("reagent", h("bank", `選擇 ${key} 儲存槽`));
        return at("reagent", h("install-confirm", "確認放入儀器"));
      }
    }
  }
  if (i === 5 || i === 6) {
    if (requiresQcConfirmation(s) && s.runs.final && !s.qcRecovered)
      return at(
        "chart",
        h(
          "confirm-qc",
          "核對兩個 level 的 QC 均落在允收範圍內，按確認判讀後進入檢體回溯填報",
        ),
      );
    if (
      !["rb", "cal", "qc"].every((k) =>
        s.rack.Serum[k as "rb" | "cal" | "qc"].includes("27.UIBC"),
      )
    )
      return at("calibration", u.rr || h("rr-start", "按 Start Entry"));
    const needs = [
      ["water", "RB", "RB／ddH2O"],
      ["lcc1", "CALI", "LCC-1"],
      ["uibc-primary", "QC", "MAS-1"],
      ["uibc-second", "QC", "MAS-3"],
    ] as const;
    for (const [id, rack, name] of needs) {
      const filled = s.preparation.cups.find(
        (c) =>
          c.materialId === id &&
          (rack !== "QC" ||
            (c.id !== "cup-1" &&
              !s.used.includes(
                `${c.id}:${c.fillSerial || 0}:${c.materialId}`,
              ))),
      );
      if (filled) {
        if (filled.rack !== rack) return at("bench", place(filled.id, rack));
        continue;
      }
      const cup = s.preparation.cups.find((c) => c.id === u.cup)!;
      if (cup.id === "cup-1" || cup.materialId || cup.rack)
        return at("bench", h("cup", `選擇空杯分裝 ${name}`));
      if (s.preparation.pipette && s.preparation.pipette.materialId !== id)
        return at("bench", h("discard-pipette", "先清空移液器中的其他來源"));
      if (s.preparation.source !== id)
        return at("bench", {
          target: `source-${id}`,
          text: `選取 ${name}`,
          model: `source:${id}`,
        });
      return at(
        "bench",
        s.preparation.pipette
          ? h("dispense", `加入容器：${name}`)
          : h("aspirate", `吸取 ${name}`),
      );
    }
    if (batchCups(s)) {
      const missing = ["RB", "CALI", "QC"].find((k) => !u.batches.includes(k));
      if (missing)
        return at("bench", h(`batch-${missing}`, `勾選本次上機 ${missing} 架`));
      if (
        Object.values(s.preparation.racks).some((r) => r.location === "loaded")
      )
        return at("bench", h("batch-retrieve", "取回三架，重新進樣"));
      const staged = Object.values(s.preparation.racks).every(
        (r) => r.location === "entry",
      );
      return at(
        "bench",
        h(
          staged ? "batch-push" : "batch-stage",
          staged ? "推入藍、黃、綠三架，依序模擬校正與QC" : "三架放至進樣區",
        ),
      );
    }
  }
  if (i === 7) {
    const row = ["P01", "P02"].find((id) => !s.trace.includes(id));
    return at(
      "trace",
      row
        ? h(`trace-${row}`, `核對 ${row}`)
        : !s.report.file
          ? h(
              u.browse ? "report-file" : "report-browse",
              u.browse ? "選取 UIBC_回溯報告.pdf" : "按瀏覽選取回溯報告",
            )
          : h("report-upload", "上傳回溯報告（本機模擬）"),
    );
  }
  if (i >= 8 && i <= 10) {
    const field = (["cause", "actions", "results"] as const)[i - 8];
    return at(
      "form",
      u.phrase ||
        h(
          `form-${field}`,
          `開啟${{ cause: "原因探討", actions: "矯正措施", results: "矯正結果" }[field]}片語`,
        ),
    );
  }
  if (i === 11)
    return at("form", h("form-submit", "按呈送；成功後仍待主管審核／允收"));
  return null;
}
