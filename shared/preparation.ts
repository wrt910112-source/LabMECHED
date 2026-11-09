import {
  materialById,
  preparationRequirements,
  preparationScenario,
  rackKinds,
  type Material,
  type MaterialKind,
} from "./materialCatalog.ts";
export interface PreparationCup {
  id: string;
  materialId: string | null;
  concentration: string | null;
  additions: number;
  fillSerial?: number;
  rack: MaterialKind | null;
  slot: number | null;
}
export interface PreparationState {
  scenario: string;
  selection: string | null;
  selectedCup?: string;
  source: string | null;
  pipette: { materialId: string; remaining: number } | null;
  cups: PreparationCup[];
  results: { calibration: "not-run"; qc: "not-run" };
  racks: Record<
    MaterialKind,
    { location: "bench" | "entry" | "loaded"; loadedToken: string | null }
  >;
}
export interface PreparationGate {
  ready: boolean;
  token: string;
}
export interface PreparationAction {
  action:
    | "select"
    | "aspirate"
    | "discard-pipette"
    | "dispense"
    | "empty"
    | "place"
    | "unrack"
    | "stage"
    | "push"
    | "retrieve"
    | "reset";
  target?: string;
  rack?: MaterialKind;
  slot?: number;
}
export function initialPreparation(): PreparationState {
  return {
    scenario: preparationScenario.id,
    selection: null,
    selectedCup: "cup-1",
    source: null,
    pipette: null,
    results: { calibration: "not-run", qc: "not-run" },
    cups: Array.from({ length: 16 }, (_, i) => ({
      id: `cup-${i + 1}`,
      materialId: null,
      concentration: null,
      additions: 0,
      rack: null,
      slot: null,
    })),
    racks: Object.fromEntries(
      rackKinds.map((k) => [k, { location: "bench", loadedToken: null }]),
    ) as PreparationState["racks"],
  };
}
export function preparationGate(
  ready: boolean,
  rack: Record<string, unknown>,
  index: string,
): PreparationGate {
  const ordered = JSON.stringify(rack, (_, value) =>
    Array.isArray(value) ? [...value].sort() : value,
  );
  return {
    ready,
    token: JSON.stringify([preparationScenario.id, index, ordered]),
  };
}
export function syncPreparation(
  state: PreparationState,
  gate: PreparationGate,
) {
  for (const r of Object.values(state.racks))
    if (!gate.ready || r.loadedToken !== gate.token) r.loadedToken = null;
  return state;
}
export function cupFilled(c: PreparationCup, catalog = materialById) {
  return (
    !!c.materialId && c.additions === (catalog[c.materialId]?.dose?.amount || 1)
  );
}
export function preparationProgress(
  state: PreparationState,
  gate: PreparationGate,
) {
  const items = preparationRequirements.map((req) => {
    const matches = state.cups.filter(
      (c) => c.materialId === req.materialId && cupFilled(c),
    );
    const dispensed = matches.length > 0;
    const racked = matches.some((c) => c.rack === req.rack && c.slot !== null);
    const loaded =
      gate.ready &&
      matches.some(
        (c) =>
          c.rack === req.rack &&
          c.slot !== null &&
          state.racks[c.rack].location === "loaded" &&
          state.racks[c.rack].loadedToken === gate.token,
      );
    return {
      ...req,
      dispensed,
      racked,
      loaded,
      identity: materialById[req.materialId].identity,
      bottleExpiry: "pending" as const,
      formalPosition: "pending" as const,
      volume: "pending" as const,
    };
  });
  return {
    items,
    dispensed: items.filter((x) => x.dispensed).length,
    racked: items.filter((x) => x.racked).length,
    loaded: items.filter((x) => x.loaded).length,
    completed: items.reduce(
      (n, x) => n + Number(x.dispensed) + Number(x.racked) + Number(x.loaded),
      0,
    ),
    total: 48,
    done: gate.ready && items.every((x) => x.loaded),
  };
}
/** Commands only express user intent. Clients cannot submit completion or identity flags. */
export function applyPreparation(
  input: PreparationState,
  command: PreparationAction,
  gate: PreparationGate,
  options: {
    freeSimulation?: boolean;
    catalog?: Record<string, Material>;
  } = {},
): { state: PreparationState; error: string } {
  const state = syncPreparation(structuredClone(input), gate);
  const catalog = options.catalog || materialById;
  const fail = (error: string) => ({ state, error });
  const a = command.action,
    id = command.target || "";
  if (typeof a !== "string" || typeof id !== "string")
    return fail("無效的備料操作。");
  if (a === "select") {
    const [kind, ...rest] = id.split(":"),
      key = rest.join(":");
    if (!(
      (kind === "source" && Object.hasOwn(catalog, key)) ||
      (kind === "cup" && state.cups.some((c) => c.id === key)) ||
      (kind === "rack" && rackKinds.includes(key as MaterialKind)) ||
      (kind === "slot" && /^((RB)|(CALI)|(QC)):(10|[1-9])$/.test(key))
    ))
      return fail("無效的備料物件。");
    state.selection = id;
    if (kind === "source") state.source = key;
    if (kind === "cup") state.selectedCup = key;
    return { state, error: "" };
  }
  if (a === "reset") return { state: initialPreparation(), error: "" };
  if (a === "retrieve") {
    if (!command.rack || !rackKinds.includes(command.rack))
      return fail("請選取檢體架。");
    state.racks[command.rack] = { location: "bench", loadedToken: null };
    return { state, error: "" };
  }
  if (!gate.ready) return fail("請先完成有效的前十二組保養及 Rack 登記。");
  if (a === "discard-pipette") {
    state.pipette = null;
    return { state, error: "" };
  }
  if (a === "aspirate") {
    if (state.pipette) return fail("移液器已有來源液，請先加入容器或清空。");
    if (!state.source || !Object.hasOwn(catalog, state.source))
      return fail("請先選取來源液。");
    state.pipette = {
      materialId: state.source,
      remaining: catalog[state.source].dose?.amount || 1,
    };
    return { state, error: "" };
  }
  const cup = state.cups.find((c) => c.id === id);
  if (["dispense", "empty", "place", "unrack"].includes(a)) {
    if (!cup) return fail("請選取容器。");
    if (cup.rack && state.racks[cup.rack].location !== "bench")
      return fail("請先取回檢體架再操作容器。");
    if (a === "empty") {
      if (cup.rack) return fail("請先將容器取回工作台再清空。");
      cup.materialId = null;
      cup.concentration = null;
      cup.additions = 0;
    } else if (a === "dispense") {
      if (cup.rack) return fail("請在工作台分裝，再放入架位。");
      if (!state.pipette) return fail("移液器目前沒有來源液。");
      if (cup.materialId && cup.materialId !== state.pipette.materialId)
        return fail("容器已有其他來源液，請清空後重新準備。");
      if (cupFilled(cup, catalog)) return fail("此容器已完成分裝操作。");
      if (!cup.materialId) cup.fillSerial = (cup.fillSerial || 0) + 1;
      cup.materialId = state.pipette.materialId;
      cup.concentration = catalog[state.pipette.materialId].concentration;
      cup.additions++;
      if (--state.pipette.remaining === 0) state.pipette = null;
    } else if (a === "unrack") {
      cup.rack = null;
      cup.slot = null;
    } else {
      const rack = command.rack,
        slot = command.slot;
      if (
        !rack ||
        !rackKinds.includes(rack) ||
        !Number.isInteger(slot) ||
        slot! < 1 ||
        slot! > 10
      )
        return fail("請選取教學架的有效空位。");
      if (options.freeSimulation ? !cup.materialId : !cupFilled(cup, catalog))
        return fail(
          options.freeSimulation
            ? "請先加入來源液再裝架。"
            : "請先完成容器分裝操作。",
        );
      if (state.racks[rack].location !== "bench")
        return fail("請先取回目標檢體架。");
      if (
        state.cups.some(
          (c) => c.id !== cup.id && c.rack === rack && c.slot === slot,
        )
      )
        return fail("此孔位已被占用。");
      cup.rack = rack;
      cup.slot = slot!;
    }
    return { state, error: "" };
  }
  const rack = command.rack;
  if (!rack || !rackKinds.includes(rack)) return fail("請選取檢體架。");
  const r = state.racks[rack];
  if (a === "stage") {
    if (r.location !== "bench") return fail("檢體架已離開工作台。");
    if (!state.cups.some((c) => c.rack === rack))
      return fail("空架無法放至進樣區。");
    r.location = "entry";
    r.loadedToken = null;
  } else if (a === "push") {
    if (r.location !== "entry") return fail("請先將檢體架放至進樣區。");
    r.location = "loaded";
    r.loadedToken = gate.token;
  } else return fail("未知備料操作。");
  return { state, error: "" };
}
