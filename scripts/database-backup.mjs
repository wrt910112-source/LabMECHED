import { DatabaseSync } from "node:sqlite";
import { databasePath } from "../server/config.mjs";
import { existsSync } from "node:fs";
import { consistentBackup } from "../server/database.mjs";
const path = databasePath();
if (!existsSync(path)) throw Error("資料庫不存在。");
const db = new DatabaseSync(path, { readOnly: true });
try {
  console.log(consistentBackup(db, path));
} finally {
  db.close();
}
