export type MaterialKind = "RB" | "CALI" | "QC";
export type Confirmation = "confirmed" | "pending";
export interface StorageRule {
  temperature: string | null;
  duration: number | null;
  unit: "day" | "month" | "hour" | null;
  startsAt:
    "preparation" | "opening" | "label-expiry" | "unknown" | "before-use";
  tests?: string[];
}
export interface Material {
  id: string;
  name: string;
  product: string;
  kind: MaterialKind;
  series: string;
  concentration: string | null;
  aliases: { name: string; status: Confirmation }[];
  identity: Confirmation;
  notes: string[];
  tests: string[];
  packaging: string | null;
  preparation: string;
  readyToUse: boolean;
  reconstitutionMl: number | null;
  storageText: string;
  storage: StorageRule[];
  dose: { amount: number; unit: "drop" } | null;
  source: {
    kind: "user-transcription";
    verifiedAgainstIFU: false;
    originalImage: null;
  };
  photo: { file: string; caption: string } | null;
}
export interface PreparationCondition {
  operation:
    | "warm"
    | "reconstitute"
    | "rest"
    | "mix"
    | "thaw"
    | "refrigerate"
    | "use-immediately";
  temperature: string | null;
  minutes: number | null;
  minimum: boolean;
  solvent: "Diluent" | "DI 水" | null;
  volumeMl: number | null;
  confirmation: "transcribed-unverified";
}
const source = {
  kind: "user-transcription",
  verifiedAgainstIFU: false,
  originalImage: null,
} as const;
const rule = (
  temperature: string | null,
  duration: number | null,
  unit: StorageRule["unit"],
  startsAt: StorageRule["startsAt"] = "unknown",
  tests?: string[],
): StorageRule => ({
  temperature,
  duration,
  unit,
  startsAt,
  ...(tests ? { tests } : {}),
});
const cal = (
  id: string,
  name: string,
  product: string,
  packaging: string,
  preparation: string,
  reconstitutionMl: number | null,
  storageText: string,
  storage: StorageRule[],
  tests: string[],
  aliases: string[] = [],
): Material => ({
  id,
  name,
  product,
  kind: "CALI",
  series: id,
  concentration: null,
  aliases: aliases.map((name) => ({ name, status: "confirmed" })),
  identity: "confirmed",
  notes: [],
  tests,
  packaging,
  preparation,
  readyToUse: reconstitutionMl === null,
  reconstitutionMl,
  storageText,
  storage,
  dose: null,
  source,
  photo: null,
});
const lccPrep =
  "Diluent 與粉末置於室溫回溫 5 分鐘，取 5 cc Diluent 將粉末回溶，靜置 30 分鐘後使用。";
const hdlPrep =
  "粉末室溫回溫 5 分鐘，加入 1 cc DI 水回溶，均勻混勻 30 分鐘後使用。";
export const calMaterials: Material[] = [
  cal(
    "lcc1",
    "LCC1",
    "Lyophilized Chemistry Calibrator",
    "12 × 5 mL 粉狀校正品；12 × 6 mL 稀釋液",
    lccPrep,
    5,
    "配製後 2–8°C，7 天；TBIL、DBIL 為 4 天。",
    [
      rule("2–8°C", 7, "day", "preparation"),
      rule("2–8°C", 4, "day", "preparation", ["TBIL", "DBIL"]),
    ],
    ["DBIL", "TBIL", "Ca", "Cre", "Iron"],
    ["LCC-1"],
  ),
  cal(
    "lcc2",
    "LCC2",
    "Lyophilized Chemistry Calibrator",
    "12 × 5 mL 粉狀校正品；12 × 6 mL 稀釋液",
    lccPrep,
    5,
    "配製後 2–8°C，7 天。",
    [rule("2–8°C", 7, "day", "preparation")],
    [
      "Alb",
      "CA",
      "CHOL",
      "Cre",
      "Glu",
      "Phos",
      "LACT",
      "MG",
      "TP",
      "BUN",
      "TG",
      "UIBC",
      "UA",
    ],
    ["LCC-2"],
  ),
  cal(
    "system",
    "SYSTEM CALIBRATOR",
    "SYSTEM CALIBRATOR",
    "粉狀校正品；包裝容量未提供",
    "校正品置於室溫回溫 5 分鐘，加入 5 cc DI 水回溶，均勻混勻 30 分鐘後使用。",
    5,
    "泡製後馬上使用，2–8°C 最多穩定 8 小時。",
    [rule("2–8°C", 8, "hour", "preparation")],
    ["ALT", "AST", "AMY", "ALP", "CK", "GGT", "LDH"],
  ),
  cal(
    "hdl",
    "HDL",
    "HDL-Cholesterol Calibrator",
    "3 × 1 mL",
    hdlPrep,
    1,
    "2–8°C，14 天；或 −70°C，30 天。",
    [rule("2–8°C", 14, "day"), rule("−70°C", 30, "day")],
    ["HDL"],
  ),
  cal(
    "ldl",
    "LDL",
    "LDL-Cholesterol Calibrator",
    "3 × 1 mL",
    hdlPrep,
    1,
    "2–8°C，14 天；或 −70°C，30 天。",
    [rule("2–8°C", 14, "day"), rule("−70°C", 30, "day")],
    ["LDL"],
  ),
  cal(
    "lip",
    "LIP",
    "Lipase Calibrator",
    "2 × Calibrator；容量未提供",
    "粉末室溫回溫 5 分鐘，加入 3 cc DI 水回溶，均勻混勻 30 分鐘後使用。",
    3,
    "配製後 2–8°C，90 天。",
    [rule("2–8°C", 90, "day", "preparation")],
    ["LIP"],
  ),
  cal(
    "urine",
    "URINE",
    "Urine Calibrator",
    "6 × 5 mL",
    "Ready to Use",
    null,
    "2–8°C，30 天。",
    [rule("2–8°C", 30, "day")],
    ["Urine Ca", "Urine BUN"],
  ),
  cal(
    "ucre",
    "UCRE",
    "Creatinine Calibrator",
    "1 × 120 mL",
    "Ready to Use",
    null,
    "2–8°C，8 個月。",
    [rule("2–8°C", 8, "month")],
    ["Urine CRE"],
    ["U-CRE"],
  ),
  cal(
    "utp",
    "UTP",
    "UCSP",
    "1 × 3 mL",
    "Ready to Use",
    null,
    "2–8°C，至標示效期。",
    [rule("2–8°C", null, null, "label-expiry")],
    ["MTP"],
  ),
  cal(
    "ammc",
    "AMMC",
    "Ammonia Cal",
    "1 × 3 mL",
    "Ready to Use",
    null,
    "2–8°C，至標示效期。",
    [rule("2–8°C", null, null, "label-expiry")],
    ["AMM"],
  ),
  cal(
    "co2-1",
    "CO2-1",
    "CO2 Calibrator 1",
    "3 × 25 mL",
    "Ready to Use",
    null,
    "15–25°C，30 天。",
    [rule("15–25°C", 30, "day")],
    ["CO2"],
  ),
  cal(
    "co2-2",
    "CO2-2",
    "CO2 Calibrator 2",
    "3 × 25 mL",
    "Ready to Use",
    null,
    "15–25°C，30 天。",
    [rule("15–25°C", 30, "day")],
    ["CO2"],
  ),
  cal(
    "etoh1",
    "ETOH1",
    "Emit Ethyl Alcohol Negative Calibrator",
    "1 × 3 mL",
    "Ready to Use",
    null,
    "2–8°C，30 天。",
    [rule("2–8°C", 30, "day")],
    ["Alcohol"],
    ["ETOH-1"],
  ),
  cal(
    "etoh2",
    "ETOH2",
    "Emit Ethyl Alcohol 100 mg/dL Calibrator",
    "1 × 3 mL",
    "Ready to Use",
    null,
    "2–8°C，30 天。",
    [rule("2–8°C", 30, "day")],
    ["Alcohol"],
    ["ETOH-2"],
  ),
];
const masTests =
  "ALT|Albumin|ALP|Amylase|AST|Direct Bilirubin|Total Bilirubin|Calcium|Carbon dioxide|Chloride|Potassium|Sodium|Total Cholesterol|CK|Creatinine|GGT|Glucose|Uric acid|HDL|Lactate|LDH|LDL|Lipase|Magnesium|Inorganic phosphorus|Serum Iron|UIBC|Total Protein|Triglyceride|BUN|ACTM|CARB|PHNO|PTN|THEO|VALP|VANC|Lithium Carbonate".split(
    "|",
  );
const urineTests =
  "Urine Amylase|Calcium|Creatinine|Glucose|Inorganic phosphorus|UCFP|Potassium ISE|Sodium ISE|Chloride ISE|Urea Nitrogen|Uric Acid|Microalbumin|Osmolality".split(
    "|",
  );
const qc = (
  id: string,
  name: string,
  product: string,
  concentration: string | null,
  preparation: string,
  storageText: string,
  storage: StorageRule[],
  tests: string[],
  notes: string[] = [],
  identity: Confirmation = "confirmed",
): Material => ({
  id,
  name,
  product,
  kind: "QC",
  series: id.replace(/-[^-]+$/, ""),
  concentration,
  preparation,
  storageText,
  storage,
  tests,
  notes,
  identity,
  readyToUse: true,
  reconstitutionMl: null,
  packaging: null,
  aliases: [],
  dose: id.startsWith("ae-") ? { amount: 2, unit: "drop" } : null,
  source,
  photo: null,
});
export const qcMaterials: Material[] = [
  ...[1, 3].map((n) =>
    qc(
      `mas-${n}`,
      `CHA-${n}`,
      "MAS chemTRAK",
      `L${n}`,
      "無需泡製。使用前置於室溫，完全回復液態後，立即冷藏放置 18 小時以上才可使用。",
      "未使用前 −20°C 保存；圖片未提供使用後完整穩定期限。",
      [rule("−20°C", null, null, "before-use")],
      masTests,
      [
        "用於一般生化及藥物項目。",
        "本院 QC.jpg 標籤有『7天』；與轉錄保存條件的適用範圍待確認，不自動計算效期。",
      ],
    ),
  ),
  ...[1, 2].map((n) =>
    qc(
      `ae-${n}`,
      `AE-${n}`,
      "Ethanol/Ammonia Control",
      null,
      "無需泡製，直接使用。每次上品管液時滴兩滴，上機前需混合均勻。",
      "開封後於 4°C 冰箱保存 20 天。",
      [rule("4°C", 20, "day", "opening")],
      ["Ethanol", "Ammonia"],
      ["產品濃度代碼未提供。"],
    ),
  ),
  qc(
    "crp-a",
    "CRPH-1",
    "CRP (Latex) Control Serum",
    null,
    "無需配置，上機前需混合均勻。",
    "未使用前冷藏保存；開封後期限未提供。",
    [rule("冷藏", null, null, "before-use")],
    ["hsCRP"],
    ["已確認任務代碼；產品濃度代碼未提供，正式濃度身份待確認。"],
    "pending",
  ),
  qc(
    "crp-b",
    "CRPH-2",
    "CRP (Latex) Control Serum",
    null,
    "無需配置，上機前需混合均勻。",
    "未使用前冷藏保存；開封後期限未提供。",
    [rule("冷藏", null, null, "before-use")],
    ["hsCRP"],
    [
      "CRPG-2 已被使用者更正，不再作為正式可選名稱。",
      "第二濃度名稱由使用者確認為 CRPH-2。",
    ],
    "confirmed",
  ),
  qc(
    "ita-1",
    "ITA-1",
    "ITA Serum",
    "QC1",
    "無需配置，使用前依說明書方式回溫。",
    "未使用前冷藏保存；開封有效期限 30 天。",
    [rule("冷藏", 30, "day", "opening")],
    ["ASLO", "C3", "C4", "IgA", "IgG", "IgM", "PALB", "RF", "TRF", "CRPN"],
    ["使用於 Special。"],
  ),
  qc(
    "ita-3",
    "ITA-3",
    "ITA Serum",
    "QC3",
    "無需配置，使用前依說明書方式回溫。",
    "未使用前冷藏保存；開封有效期限 30 天。",
    [rule("冷藏", 30, "day", "opening")],
    ["ASLO", "C3", "C4", "IgA", "IgG", "IgM", "PALB", "RF", "TRF", "CRPN"],
    [
      "使用於 Special。",
      "本院 QC.jpg 標籤及使用者確認名稱為 ITA-3，濃度為 QC3。",
    ],
    "confirmed",
  ),
  ...[1, 2].map((n) =>
    qc(
      `urine-qc-${n}`,
      `Q-U${n}`,
      "Liquichek Urine Chemistry",
      `QC${n}`,
      "無需泡製，直接使用；上機前需混合均勻。",
      "開封後可保存 1 個月，開封後於 4°C 保存。",
      [rule("4°C", 1, "month", "opening")],
      urineTests,
    ),
  ),
];
const water: Material = {
  ...qc(
    "water",
    "ddH2O",
    "ddH2O",
    null,
    "教學用 RB 來源液；配製與保存資料未提供。",
    "未提供。",
    [],
    [],
  ),
  kind: "RB",
  series: "water",
};
// Only clearly labelled bottles get the hospital group photo; no inferred identities.
for (const m of [...calMaterials, ...qcMaterials]) {
  if (m.id === "etoh1") m.concentration = "Negative";
  if (m.id === "etoh2") m.concentration = "100 mg/dL";
  if (["lcc1", "lcc2", "etoh1", "hdl", "ldl", "utp"].includes(m.id))
    m.photo = {
      file: "real-photos/CALI.jpg",
      caption: "本院 CALI 儲存架實機照片（合照，非個別瓶身特寫）",
    };
  if (m.kind === "QC" && m.id !== "crp-b")
    m.photo = {
      file: "real-photos/QC.jpg",
      caption: "本院 QC 儲存架實機照片（合照；ITA 標籤為 ITA-3）",
    };
  if (m.storage.some((r) => r.startsAt === "unknown"))
    m.notes.push("保存期限起算點待確認。個別瓶身到期日未設定。");
}
for (const m of qcMaterials)
  if (m.id === "ita-3")
    m.aliases = [
      { name: "ITA-2", status: "pending" },
      { name: "ITA-3", status: "confirmed" },
    ];
export const materials: Material[] = [...calMaterials, ...qcMaterials, water];
// These transcribed conditions describe the reference data, never timed gameplay gates.
export const materialPreparationConditions: Record<
  string,
  PreparationCondition[]
> = Object.fromEntries(
  materials.map((m) => {
    const condition = (
      operation: PreparationCondition["operation"],
      temperature: string | null = null,
      minutes: number | null = null,
      minimum = false,
      solvent: PreparationCondition["solvent"] = null,
      volumeMl: number | null = null,
    ): PreparationCondition => ({
      operation,
      temperature,
      minutes,
      minimum,
      solvent,
      volumeMl,
      confirmation: "transcribed-unverified",
    });
    const steps: PreparationCondition[] =
      m.reconstitutionMl === null
        ? []
        : [
            condition("warm", "室溫", 5),
            condition(
              "reconstitute",
              null,
              null,
              false,
              m.id.startsWith("lcc") ? "Diluent" : "DI 水",
              m.reconstitutionMl,
            ),
            condition(m.id.startsWith("lcc") ? "rest" : "mix", null, 30),
          ];
    if (m.id === "system") steps.push(condition("use-immediately"));
    if (m.id.startsWith("mas-"))
      steps.push(
        condition("thaw", "室溫"),
        condition("refrigerate", "冷藏", 18 * 60, true),
      );
    return [m.id, steps];
  }),
);
export interface MaterialBottle {
  materialId: string;
  lot: string | null;
  expiresOn: string | null;
  openedOn: string | null;
  preparedOn: string | null;
  storageLocation: string | null;
  individualPhoto: string | null;
  expiryVerification: "pending";
}
export const materialBottles: Record<string, MaterialBottle> =
  Object.fromEntries(
    materials.map((m) => [
      m.id,
      {
        materialId: m.id,
        lot: null,
        expiresOn: null,
        openedOn: null,
        preparedOn: null,
        storageLocation: null,
        individualPhoto: null,
        expiryVerification: "pending",
      },
    ]),
  );
export const materialById = Object.fromEntries(
  materials.map((m) => [m.id, m]),
) as Record<string, Material>;
export function resolveMaterialName(name: string) {
  return materials.find(
    (m) =>
      m.id === name ||
      (m.name === name && m.identity === "confirmed") ||
      m.aliases.some((a) => a.name === name && a.status === "confirmed"),
  );
}
export function legacyMaterialLabel(raw: string) {
  return raw === "CRPG-2"
    ? {
        raw,
        display: "CRPG-2（歷史原值，名稱已更正；濃度對應待確認）",
        status: "pending" as const,
        materialId: null,
      }
    : { raw, display: raw, status: "pending" as const, materialId: null };
}
export const rackKinds = ["RB", "CALI", "QC"] as const;
export const rackNames: Record<MaterialKind, string> = {
  RB: "藍色 RB 架",
  CALI: "黃色 CALI 架",
  QC: "綠色 QC 架",
};
export const preparationRequirements = [
  ["water", "ddH2O", "RB"],
  ["lcc1", "LCC1", "CALI"],
  ["lcc2", "LCC2", "CALI"],
  ["co2-1", "CO2-1", "CALI"],
  ["co2-2", "CO2-2", "CALI"],
  ["ucre", "U-CRE", "CALI"],
  ["mas-1", "CHA-1", "QC"],
  ["mas-3", "CHA-3", "QC"],
  ["ae-1", "AE-1", "QC"],
  ["ae-2", "AE-2", "QC"],
  ["ita-1", "ITA-1", "QC"],
  ["ita-3", "ITA-3", "QC"],
  ["crp-a", "CRPH-1", "QC"],
  ["crp-b", "CRPH-2", "QC"],
  ["urine-qc-1", "Q-U1", "QC"],
  ["urine-qc-2", "Q-U2", "QC"],
].map(([materialId, label, rack]) => ({
  id: `portion-${materialId}`,
  materialId,
  label,
  rack: rack as MaterialKind,
}));
export const preparationScenario = {
  id: "fixed-sixteen-v1",
  title: "校正與品管上機",
  teachingSlots: 10,
  formalSlots: null,
  containerModel: null,
  aliquotVolumeMl: null,
  disclaimer:
    "固定 16 份獨立備料情境；與目前 HDL／LDL／CRE 校正申請非一對一材料對照。",
  availability: {
    prepared: true,
    thawed: true,
    conditioningComplete: true,
    source: "教學情境設定",
    verifiedBottleExpiry: false,
  },
} as const;
