export const dailyProbes = [
  "R1-1",
  "R1-2",
  "R2-1",
  "R2-2",
  "Sample-1",
  "Sample-2",
];
export const detailedProbes = ["Sample-1", "Sample-2", "ISE"];
export const mixerIds = Array.from({ length: 18 }, (_, i) =>
  i < 12 ? `R1S-${i + 1}` : `R2-${i - 11}`,
);
export const mixerGroupIds = ["R1S", "R2"] as const;
export const wellIds = mixerIds.map((id) => `well-${id}`);
export const syringeIds = ["R2-2", "R2-1", "R1-1", "R1-2"];
export const w2Positions = [
  "r2-outer-3",
  "r2-inner-3",
  "r1-inner-3",
  "r1-outer-3",
  "sample-left-1",
  "sample-right-1",
  "ise-wash-1",
];
export const probeOperationNames = {
  unlock: "旋開鎖頭",
  drain: "等待液體滴完",
  remove: "提起取出",
  wipe: "擦拭 tip",
  wire: "鐵絲通探針孔",
  install: "裝回探針",
  lock: "鎖緊鎖頭",
} as const;
export type ProbeOperation = keyof typeof probeOperationNames;
export const initialReagents = () => [
  {
    name: "ALT",
    side: "R1",
    remaining: 0,
    need: 100,
    reason: "用完",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "ALT",
    side: "R2",
    remaining: 25,
    need: 100,
    reason: "量不足",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "AST",
    side: "R1",
    remaining: 180,
    need: 100,
    reason: "即將到期",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "AST",
    side: "R2",
    remaining: 180,
    need: 100,
    reason: "足夠",
    reviewed: false,
    replaced: false,
    note: "",
  },
  {
    name: "GLU",
    side: "R1",
    remaining: 220,
    need: 120,
    reason: "足夠",
    reviewed: false,
    replaced: false,
    note: "",
  },
];
