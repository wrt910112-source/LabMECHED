export type Vec3 = [number, number, number];
export type PartId =
  | "rear-syringes"
  | "ise-internal"
  | "ise-reference"
  | "clean-solution"
  | "sample-track"
  | "overview"
  | "loader"
  | "console"
  | "ise"
  | "ise-reagents"
  | "analyzer"
  | "r2"
  | "r1"
  | "sample"
  | "reaction"
  | "mixing"
  | "syringes"
  | "ise-cups"
  | "ise-mixing-cup"
  | "ise-t-tube"
  | "ise-motor"
  | "ise-plug-a"
  | "ise-plug-b"
  | "washing";
export interface Part {
  id: PartId;
  parent?: PartId;
  name: string;
  en: string;
  number: string;
  description: string;
  photo: string;
  extraPhotos?: string[];
  pages: string;
  target: Vec3;
  eye: Vec3;
  internal?: boolean;
  tags: string[];
}
export const parts: Part[] = [
  {
    id: "overview",
    name: "AU5800 生化分析儀",
    en: "System overview",
    number: "00",
    description:
      "從整機開始，認識樣品架進架區、ISE 電解質模組與分析單元。點選模型上的部件，或從左側選擇探索區域。",
    photo: "exterior.jpg",
    pages: "3、7–8",
    target: [0, 0.72, 0],
    eye: [3.05, 2.55, 4.1],
    tags: ["單分析單元", "含 ISE 模組"],
  },
  {
    id: "loader",
    parent: "overview",
    name: "樣品架進架區",
    en: "Sample rack loader",
    number: "01",
    description:
      "位於整機左側，包含樣品架放置、回收與傳送區。模型保留軌道及樣品架，供辨識檢體進入儀器的區域。",
    photo: "exterior.jpg",
    pages: "5–8",
    target: [-0.755, 0.75, 0],
    eye: [-2, 1.85, 2.3],
    tags: ["SMP", "樣品架"],
  },
  {
    id: "console",
    parent: "loader",
    name: "操作工作站",
    en: "Operation console",
    number: "02",
    description:
      "螢幕、鍵盤與滑鼠位於樣品架區上方。本版呈現操作工作站的位置，儀器軟體流程將於後續情境加入。",
    photo: "exterior.jpg",
    pages: "4–5、7",
    target: [-0.72, 1.28, -0.28],
    eye: [-0.65, 1.7, 1.7],
    tags: ["螢幕", "鍵盤"],
  },
  {
    id: "ise",
    parent: "overview",
    name: "ISE 電解質模組",
    en: "Ion-selective electrode unit",
    number: "03",
    description:
      "位於樣品架區與分析單元之間。外觀分為上層黑色探針罩、中層 Mid Standard／Buffer 黑色罩、下層 Reference 白色櫃門，三層可分別開啟。探針區內另有向左開啟的維護蓋，可觀察混合杯、T 型管與馬達。",
    photo: "ise.jpg",
    pages: "2–3、7、27–29、32",
    target: [0.015, 0.65, 0.2],
    eye: [0.68, 1.24, 2.15],
    internal: true,
    tags: ["ISE", "樣品探針"],
  },
  {
    id: "ise-reagents",
    parent: "ise",
    name: "ISE 試劑區",
    en: "ISE reagent compartment",
    number: "04",
    description:
      "中層黑色罩內左側為 ISE Mid Standard、右側為 ISE Buffer；ISE Reference 移至下層獨立櫃門內。可分別開關各層外蓋，瓶身與管線仍為位置示意。",
    photo: "ise-reagents.jpg",
    extraPhotos: ["ise-reference.jpg"],
    pages: "27、29",
    target: [0.015, 0.66, 0.78],
    eye: [-0.35, 1.05, 1.75],
    internal: true,
    tags: ["MID · 黃", "BUFFER · 紅", "REF · 藍"],
  },
  {
    id: "analyzer",
    parent: "overview",
    name: "分析單元",
    en: "Analyzer unit · Unit 1",
    number: "05",
    description:
      "整機右側的分析單元，包含 R1／R2 試劑槽、反應槽、樣品與試劑探針、攪拌及清洗區。",
    photo: "analyzer.jpg",
    pages: "3–4、7–8、28",
    target: [0.77, 0.95, 0],
    eye: [2.15, 2.1, 2.35],
    internal: true,
    tags: ["ANL", "Unit 1"],
  },
  {
    id: "r2",
    parent: "analyzer",
    name: "R2 試劑槽與探針",
    en: "R2 reagent compartment",
    number: "06",
    description:
      "從儀器前方看位於分析單元左側。外、內側各有三孔洗滌劑槽，平日常駐兩瓶 CLN-1；CLN-2 停用，兩個 W2 孔於周／雙周保養使用。",
    photo: "r2.jpg",
    pages: "4、28、35",
    target: [0.5, 1.01, 0.3],
    eye: [0.08, 1.95, 1.48],
    internal: true,
    tags: ["前方左側", "R2"],
  },
  {
    id: "r1",
    parent: "analyzer",
    name: "R1 試劑槽與探針",
    en: "R1 reagent compartment",
    number: "07",
    description:
      "從儀器前方看位於分析單元右側。內、外側各有三孔洗滌劑槽，常駐兩瓶 CLN-1 與兩瓶 Diluent；55、56 為 Diluent/W2 共用位置，CLN-2 目前未使用。",
    photo: "r1.jpg",
    pages: "4、28、31、35",
    target: [1.02, 1.01, 0.3],
    eye: [1.75, 1.95, 1.48],
    internal: true,
    tags: ["前方右側", "R1"],
  },
  {
    id: "sample",
    parent: "analyzer",
    name: "樣品探針區",
    en: "Sample probes",
    number: "08",
    description:
      "位於分析單元後側，可見成對的樣品探針、探針清洗位置與 DET-1/W2、DET-2 洗滌劑瓶位。",
    photo: "rear.jpg",
    extraPhotos: ["sample.jpg"],
    pages: "28、31、33–34",
    target: [0.79, 1.04, -0.56],
    eye: [1.45, 1.85, -1.65],
    internal: true,
    tags: ["儀器後方", "DET-1 / DET-2"],
  },
  {
    id: "reaction",
    parent: "analyzer",
    name: "反應槽",
    en: "Reaction compartment",
    number: "09",
    description:
      "位於分析單元中央的圓形區域。首版呈現槽蓋與周圍部件的位置關係，未展開比色杯及內部光學結構。",
    photo: "analyzer.jpg",
    pages: "4、35–37",
    target: [0.77, 0.97, -0.12],
    eye: [1.25, 2.15, 1],
    internal: true,
    tags: ["中央區域", "槽蓋"],
  },
  {
    id: "mixing",
    parent: "analyzer",
    name: "攪拌單元",
    en: "Mixing units",
    number: "10",
    description:
      "由儀器後方看，右側藍色組為 4 根 × 3 組，共 12 根攪拌棒及 12 孔；左側黃色組為 2 根 × 3 組，共 6 根及 6 孔，與清洗噴嘴同側。依補充照片建模。",
    photo: "rear.jpg",
    pages: "8、28、34–35",
    target: [0.77, 1.05, -0.29],
    eye: [0.77, 1.85, -1.6],
    internal: true,
    tags: ["R1 / S", "R2"],
  },
  {
    id: "washing",
    parent: "analyzer",
    name: "清洗噴嘴單元",
    en: "Wash nozzle unit",
    number: "11",
    description:
      "由儀器後方看位於左側，與黃色 6 根攪拌棒單元同側。依補充照片調整成排噴嘴與管線位置；不模擬流體及拆卸動作。",
    photo: "rear.jpg",
    pages: "8、38",
    target: [1.115, 1.03, -0.4],
    eye: [1.4, 1.7, -1.25],
    internal: true,
    tags: ["噴嘴", "管線"],
  },
];
parts.push({
  id: "syringes",
  parent: "analyzer",
  name: "試劑注射器檢查",
  en: "Reagent syringes",
  number: "12",
  description:
    "位於 R1／R2 下方櫃體的左側門內。由左至右為 R2-2、R2-1、R1-1、R1-2，共四支固定式注射器。每次保養均須檢查是否有水氣；本模型不提供拆卸。",
  photo: "exterior.jpg",
  pages: "待核對（依使用者補充照片與指示）",
  target: [0.505, 0.46, 0.71],
  eye: [0.56, 0.7, 1.95],
  internal: true,
  tags: ["每次保養檢查", "固定不可拆卸"],
});
const iseDetails: Array<{
  id: PartId;
  name: string;
  en: string;
  description: string;
  target: Vec3;
}> = [
  {
    id: "ise-cups",
    name: "ISE 保養試劑杯",
    en: "ISE maintenance cups",
    description:
      "由左至右：S-H（SEL-Na、CRS-H）、S-L（SEL-K、CRS-M）、U-H（CRS-L）、U-L（CLEAN）。位於 ISE 右側固定面板，名稱依提供照片。",
    target: [0.171, 0.936, -0.19],
  },
  {
    id: "ise-mixing-cup",
    name: "ISE 混合杯",
    en: "ISE mixing cup",
    description:
      "位於內部後側、馬達組件下方。依圈選照片建立透明杯體、金屬杯緣與支座；杯體可獨立拆下及裝回。",
    target: [-0.071, 0.86, -0.235],
  },
  {
    id: "ise-t-tube",
    name: "ISE T 型橡膠管",
    en: "ISE T-shaped rubber tube",
    description:
      "沿混合杯及電極區側邊配置的 T 型管，保留分支及彎曲外形，可獨立拆下及裝回。管線外形依照片估算，不代表已核對的完整液路。",
    target: [-0.1, 0.83, -0.05],
  },
  {
    id: "ise-motor",
    name: "ISE 馬達主體",
    en: "ISE motor assembly",
    description:
      "混合杯上方的黑色馬達、支架與攪拌軸。馬達主體與兩個插頭分成獨立物件，可分別選取與示意拆裝。",
    target: [-0.015, 0.86, -0.235],
  },
  {
    id: "ise-plug-a",
    name: "ISE 馬達插頭 A",
    en: "ISE motor plug A",
    description:
      "照片左側的馬達插頭與線纜，可獨立選取、拔出及接回。A 為模型識別名稱，非實機接頭編號。",
    target: [-0.162, 0.9, -0.28],
  },
  {
    id: "ise-plug-b",
    name: "ISE 馬達插頭 B",
    en: "ISE motor plug B",
    description:
      "照片右側的馬達插頭與線纜，可獨立選取、拔出及接回。B 為模型識別名稱，非實機接頭編號。",
    target: [0.083, 0.9, -0.28],
  },
];
iseDetails.forEach((p, i) =>
  parts.push({
    ...p,
    parent: "ise",
    number: String(13 + i),
    photo: "ise.jpg",
    pages: "待核對（依 2026-09-18 補充照片）",
    eye: p.id === "ise-cups" ? [-0.1, 1.19, 0.21] : [0.21, 1.31, 0.53],
    internal: true,
    tags: ["ISE", p.id === "ise-cups" ? "4 個杯位" : "可拆裝部件"],
  }),
);
parts.push(
  {
    id: "ise-reference",
    parent: "ise",
    name: "ISE Reference 下層櫃",
    en: "ISE reference compartment",
    number: "19",
    description:
      "ISE 最下方白色櫃門內放置 ISE Reference。可獨立開關櫃門查看瓶子。",
    photo: "ise-reference.jpg",
    pages: "依補充照片；頁碼待核對",
    target: [-0.068, 0.34, 0.38],
    eye: [0.36, 0.66, 1.45],
    internal: true,
    tags: ["Reference", "下層櫃門"],
  },
  {
    id: "clean-solution",
    parent: "loader",
    name: "Clean Solution 櫃",
    en: "Clean solution cabinet",
    number: "20",
    description:
      "樣品架進架區下方較窄的櫃體，右側鉸鏈門內放置 Clean Solution 桶。可開門查看桶身、提把、雙蓋、管線與承接托盤。",
    photo: "exterior.jpg",
    pages: "依補充照片；頁碼待核對",
    target: [-0.682, 0.43, 0.43],
    eye: [-0.89, 0.9, 1.95],
    tags: ["Clean Solution", "可開門"],
  },
  {
    id: "sample-track",
    parent: "overview",
    name: "後方檢體運送軌道",
    en: "Rear sample transport track",
    number: "21",
    description:
      "位於儀器後方、Sample probe 同側，沿進架區、ISE 與分析單元延伸。以連續分段的黑色罩板及兩側白色邊框呈現；本版不模擬檢體運送。",
    photo: "rear.jpg",
    pages: "依補充照片；頁碼待核對",
    target: [0, 0.92, -0.72],
    eye: [-1.8, 1.9, -2.7],
    internal: true,
    tags: ["Sample transport", "後方"],
  },
);
parts.push(
  {
    id: "rear-syringes",
    parent: "analyzer",
    name: "後方 syringe 組",
    en: "Rear syringe group",
    number: "22",
    description:
      "分析單元後方、Sample probe 下方櫃體有兩支 syringe，依使用者確認呈現。整組記錄水氣與漏水；細部尺寸及管路仍為示意。",
    photo: "rear.jpg",
    pages: "依使用者指定位置",
    target: [1.0, 0.43, -0.7],
    eye: [1.0, 0.76, -1.85],
    tags: ["2 支 syringe", "水氣／漏水", "整組檢查"],
  },
  {
    id: "ise-internal",
    parent: "ise",
    name: "ISE 模組內部",
    en: "ISE internal components",
    number: "23",
    description:
      "從前側斜上方退開觀察馬達、混合杯及管線；選取視角不會自動開蓋。",
    photo: "ise.jpg",
    pages: "依補充照片示意",
    target: [-0.015, 0.86, -0.235],
    eye: [0.21, 1.31, 0.53],
    tags: ["馬達", "管線"],
  },
);
export const partById = Object.fromEntries(
  parts.map((p) => [p.id, p]),
) as Record<PartId, Part>;
export const views = [
  { id: "front", label: "整機", eye: [3.05, 2.55, 4.1], target: [0, 0.72, 0] },
  { id: "top", label: "俯視", eye: [0, 4.5, 0.05], target: [0, 0.7, 0] },
  {
    id: "sample-probe-rear",
    label: "Sample probe 後方",
    eye: [0.77, 1.55, -1.48],
    target: [0.77, 1.01, -0.49],
  },
  {
    id: "ise-probe-rear",
    label: "ISE probe 後方",
    eye: [-0.105, 1.4, -1.18],
    target: [-0.105, 0.96, -0.43],
  },
  { id: "rear", label: "後方", eye: [-2.6, 2.4, -3.5], target: [0, 0.8, 0] },
] satisfies { id: string; label: string; eye: Vec3; target: Vec3 }[];
export const asset = (name: string) =>
  `${import.meta.env.BASE_URL}references/${name}`;
