import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { consistentBackup } from "../server/database.mjs";
const path = resolve(process.env.AU5800_DB || "data/au5800.sqlite");
if (!existsSync(path)) throw Error("資料庫不存在。");
const db = new DatabaseSync(path, { readOnly: true });
try {
  console.log(consistentBackup(db, path));
} finally {
  db.close();
}
