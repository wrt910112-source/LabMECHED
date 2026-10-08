import type { Vec3 } from "./data";

export type CareMode = "daily" | "weekly" | "biweekly";
export type Fluid = "cln1" | "diluent" | "w2" | "det1" | "det2";
export type SlotRole = "cln1" | "unused" | "w2" | "shared" | "det1" | "det2";
export interface WashBank {
  id: string;
  module: "r2" | "r1" | "sample" | "ise";
  name: string;
  position: Vec3;
  rotation: number;
  labels: string[];
}
// Left-to-right order is defined from the front of the analyzer.
export const washBanks: WashBank[] = [
  {
    id: "r2-outer",
    module: "r2",
    name: "R2 外側",
    position: [0.335, 0.922, 0.125],
    rotation: -0.28,
    labels: ["57.CLN-1", "58.CLN-2", "W2"],
  },
  {
    id: "r2-inner",
    module: "r2",
    name: "R2 內側",
    position: [0.686, 0.922, 0.125],
    rotation: 0.28,
    labels: ["55.CLN-1", "56.CLN-2", "W2"],
  },
  {
    id: "r1-inner",
    module: "r1",
    name: "R1 內側",
    position: [0.854, 0.922, 0.125],
    rotation: -0.28,
    labels: ["57.CLN-1", "58.CLN-2", "55.Diluent/W2"],
  },
  {
    id: "r1-outer",
    module: "r1",
    name: "R1 外側",
    position: [1.205, 0.922, 0.125],
    rotation: 0.28,
    labels: ["59.CLN-1", "60.CLN-2", "56.Diluent/W2"],
  },
];
washBanks.push(
  {
    id: "ise-wash",
    module: "ise",
    name: "ISE 洗滌瓶",
    position: [-0.105, 0.922, -0.43],
    rotation: Math.PI / 2,
    labels: ["DET-1/W2", "DET-2"],
  },
  {
    id: "sample-left",
    module: "sample",
    name: "Sample 左側（後方視角）",
    position: [1.065, 0.922, -0.565],
    rotation: Math.PI,
    labels: ["63.DET-1/W2", "64.DET-2"],
  },
  {
    id: "sample-right",
    module: "sample",
    name: "Sample 右側（後方視角）",
    position: [0.475, 0.922, -0.565],
    rotation: Math.PI,
    labels: ["61.DET-1/W2", "62.DET-2"],
  },
);
export interface WashSlot {
  id: string;
  bankId: string;
  module: "r2" | "r1" | "sample" | "ise";
  label: string;
  role: SlotRole;
  index: number;
}
export const washSlots: WashSlot[] = washBanks.flatMap((bank) =>
  bank.labels.map((label, index) => ({
    id: `${bank.id}-${index + 1}`,
    bankId: bank.id,
    module: bank.module,
    label,
    role:
      bank.module === "sample" || bank.module === "ise"
        ? index === 0
          ? "det1"
          : "det2"
        : index === 0
          ? "cln1"
          : index === 1
            ? "unused"
            : bank.module === "r1"
              ? "shared"
              : "w2",
    index,
  })),
);
export const slotById = Object.fromEntries(
  washSlots.map((s) => [s.id, s]),
) as Record<string, WashSlot>;
export const fluidNames: Record<Fluid, string> = {
  cln1: "CLN-1",
  diluent: "Diluent",
  w2: "W2",
  det1: "DET-1",
  det2: "DET-2",
};
export const modeNames: Record<CareMode, string> = {
  daily: "平日",
  weekly: "周保養",
  biweekly: "雙周保養",
};
export interface BottleState {
  chemistry?: "hcl" | "bleach";
  fluid: Fluid | null;
  level: number;
  revision: number;
}
export type BottleStates = Record<string, BottleState>;
export function initialBottles(): BottleStates {
  return Object.fromEntries(
    washSlots.map((s) => [
      s.id,
      {
        fluid:
          s.role === "det1" || s.role === "det2"
            ? s.role
            : s.role === "cln1"
              ? "cln1"
              : s.role === "shared"
                ? "diluent"
                : null,
        level: ["cln1", "shared", "det1", "det2"].includes(s.role) ? 0.65 : 0,
        revision: 0,
      },
    ]),
  );
}
export function allowedFluids(slot: WashSlot, mode: CareMode): Fluid[] {
  if (slot.role === "det1") return mode === "daily" ? ["det1"] : ["det1", "w2"];
  if (slot.role === "det2") return ["det2"];
  if (slot.role === "unused") return [];
  if (slot.role === "cln1") return ["cln1"];
  if (slot.role === "w2") return mode === "daily" ? [] : ["w2"];
  return mode === "daily" ? ["diluent"] : ["diluent", "w2"];
}
export type BottleAction =
  { kind: "replace"; fluid: Fluid } | { kind: "refill" } | { kind: "remove" };
export function operateBottle(
  states: BottleStates,
  id: string,
  mode: CareMode,
  action: BottleAction,
): BottleStates {
  const slot = slotById[id],
    old = states[id];
  if (!slot || !old) throw new Error("找不到槽位");
  if (slot.role === "unused") throw new Error("CLN-2 目前未使用，請保持空槽");
  if (action.kind === "remove") {
    if (!old.fluid) throw new Error("槽位已是空槽");
    return {
      ...states,
      [id]: { fluid: null, level: 0, revision: old.revision + 1 },
    };
  }
  const fluid = action.kind === "replace" ? action.fluid : old.fluid;
  if (!fluid) throw new Error("請先放入瓶子，再進行補充");
  if (
    slot.module === "sample" &&
    fluid === "w2" &&
    states[`${slot.bankId}-2`].fluid
  )
    throw new Error("請先取出同側 DET-2，保持 62／64 空槽，再放入 W2。");
  if (slot.role === "det2" && states[`${slot.bankId}-1`].fluid === "w2")
    throw new Error(
      "同側正在使用 W2，DET-2 槽必須留空；請先將 W2 更換為 DET-1。",
    );
  if (!allowedFluids(slot, mode).includes(fluid))
    throw new Error("此槽位或目前配置不允許使用這種瓶子");
  return {
    ...states,
    [id]: {
      fluid,
      level: 1,
      revision: old.revision + (action.kind === "replace" ? 1 : 0),
    },
  };
}
export function slotPosition(id: string): Vec3 {
  const slot = slotById[id],
    bank = washBanks.find((b) => b.id === slot.bankId)!;
  const x = (slot.index - (bank.labels.length - 1) / 2) * 0.033;
  return [
    bank.position[0] + Math.cos(bank.rotation) * x,
    bank.position[1],
    bank.position[2] - Math.sin(bank.rotation) * x,
  ];
}
