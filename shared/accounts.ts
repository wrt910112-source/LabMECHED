export const backgroundVersion = "LabMECHED-background-2026-11-02-v1";
export const departments = [
  "生化",
  "血液",
  "血庫",
  "鏡檢",
  "細菌",
  "血清分生",
  "未分發／輪訓",
  "其他",
] as const;
export const identities = [
  "醫檢師",
  "檢驗新進人員／PGY學員",
  "檢驗實習生",
] as const;
export const experiences = ["從未", "僅觀摩", "曾實際操作"] as const;
export const frequencies = [
  "從未",
  "少於每月一次",
  "每月1–3次",
  "每週1–4天",
  "幾乎每日",
] as const;
export const maintenanceKinds = ["日保養", "周保養", "雙周保養"] as const;
export const tenureDefinition =
  "正式臨床檢驗工作累計，不含在學實習；已正式任職的 PGY 計入。尚未正式任職可填 0。";
export interface LearnerProfile {
  nickname: string;
  department: string;
  identity: string;
  clinicalMonths: number;
  experience: string;
  usageFrequency: string;
  maintenanceKinds: string[];
  maintenanceFrequency: string;
}
export interface Cohort {
  id: string;
  name: string;
}
export interface LearnerBackgroundSnapshot extends LearnerProfile {
  cohortId: string | null;
  cohortName: string | null;
}
export function validateProfile(value: unknown): LearnerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("背景資料格式不正確。");
  const p = value as Record<string, unknown>;
  const keys = [
    "nickname",
    "department",
    "identity",
    "clinicalMonths",
    "experience",
    "usageFrequency",
    "maintenanceKinds",
    "maintenanceFrequency",
  ];
  if (Object.keys(p).some((k) => !keys.includes(k)))
    throw Error("背景資料包含不允許修改的欄位。");
  const nickname = typeof p.nickname === "string" ? p.nickname.trim() : "";
  if (!nickname || nickname.length > 80)
    throw Error("請填寫暱稱（最多 80 字）。");
  for (const [key, options] of [
    ["department", departments],
    ["identity", identities],
    ["experience", experiences],
    ["usageFrequency", frequencies],
    ["maintenanceFrequency", frequencies],
  ] as const)
    if (!(options as readonly unknown[]).includes(p[key]))
      throw Error("請完整選擇組別、身分與 AU5800 經驗／頻率。");
  if (
    !Number.isInteger(p.clinicalMonths) ||
    (p.clinicalMonths as number) < 0 ||
    (p.clinicalMonths as number) > 1200
  )
    throw Error("臨床年資需為 0–100 年內的完整月數。");
  if (
    !Array.isArray(p.maintenanceKinds) ||
    p.maintenanceKinds.some(
      (k) => !(maintenanceKinds as readonly unknown[]).includes(k),
    ) ||
    new Set(p.maintenanceKinds).size !== p.maintenanceKinds.length
  )
    throw Error("請選擇曾親自執行的保養，或明確選擇無經驗。");
  if (p.maintenanceKinds.length && p.experience !== "曾實際操作")
    throw Error("曾親自執行保養時，AU5800 使用經驗應為曾實際操作。");
  if (p.experience === "從未" && p.usageFrequency !== "從未")
    throw Error("從未使用 AU5800 時，最近一年使用頻率應為從未。");
  if (!p.maintenanceKinds.length && p.maintenanceFrequency !== "從未")
    throw Error("沒有親自保養經驗時，最近一年保養頻率應為從未。");
  return {
    nickname,
    department: p.department as string,
    identity: p.identity as string,
    clinicalMonths: p.clinicalMonths as number,
    experience: p.experience as string,
    usageFrequency: p.usageFrequency as string,
    maintenanceKinds: [...p.maintenanceKinds] as string[],
    maintenanceFrequency: p.maintenanceFrequency as string,
  };
}
export interface ImportAccount {
  username: string;
  name: string;
  cohort: string;
}
// A real CSV parser: quoted delimiters, escaped quotes and leading zeroes are preserved.
export function parseAccountCsv(text: string): ImportAccount[] {
  if (text.length > 1024 * 1024) throw Error("CSV 上限為 1 MB。");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  for (let i = 0; i <= source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === undefined) throw Error("CSV 引號未關閉。");
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw Error("CSV 引號格式不正確。");
      quoted = true;
    } else if (c === "," || c === "\n" || c === undefined) {
      row.push(cell.trim());
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else {
      if (closed && c.trim()) throw Error("CSV 引號後有不正確內容。");
      if (!closed) cell += c;
    }
  }
  const header = rows.shift();
  if (!header || header.join(",") !== "username,name,cohort")
    throw Error("CSV 欄位須依序為 username,name,cohort；不可匯入密碼或權限。");
  if (!rows.length || rows.length > 200) throw Error("每批需為 1–200 筆學員。");
  return rows.map((r, i) => {
    if (r.length !== 3) throw Error(`CSV 第 ${i + 2} 列欄位數不正確。`);
    return { username: r[0], name: r[1], cohort: r[2] };
  });
}
