import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg)
  throw Error(
    "使用方式：npm run db:restore -- 備份檔 新資料庫路徑（不可覆寫現有檔案）",
  );
const source = resolve(sourceArg),
  target = resolve(targetArg);
if (!existsSync(source) || existsSync(target))
  throw Error("來源必須存在，目的檔必須尚未存在；請先停止應用，再依文件切換。");
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
    throw Error("來源完整性檢查失敗。");
  if (db.prepare("PRAGMA user_version").get().user_version > 2)
    throw Error("備份版本高於本程式，請先使用相符程式。");
  await backup(db, target);
} finally {
  db.close();
}
const restored = new DatabaseSync(target, { readOnly: true });
try {
  if (restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
    throw Error("還原完整性檢查失敗。");
} finally {
  restored.close();
}
console.log(`已還原至新檔：${target}；尚未切換應用資料庫。`);
