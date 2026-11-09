import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { databasePath } from "../server/config.mjs";
import { mkdirSync } from "node:fs";
import { migrateDatabase } from "../server/database.mjs";
import { bootstrapAdministrator } from "../server/accounts.mjs";

function secret(prompt) {
  if (!process.stdin.isTTY)
    throw Error(
      "非互動執行請以 AU5800_BOOTSTRAP_PASSWORD 環境變數提供密碼，不可放入指令參數。",
    );
  process.stdout.write(prompt);
  return new Promise((resolveSecret, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const clean = () => {
      process.stdin.off("data", read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const read = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\u0003") {
          clean();
          reject(Error("已取消。"));
          return;
        }
        if (c === "\r" || c === "\n") {
          clean();
          resolveSecret(value);
          return;
        }
        if (c === "\u007f" || c === "\b") {
          value = value.slice(0, -1);
        } else if (c >= " ") value += c;
      }
    };
    process.stdin.on("data", read);
  });
}
let db;
try {
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  const migration = migrateDatabase(db, path);
  if (migration.backup) console.log(`遷移前一致性備份：${migration.backup}`);
  if (db.prepare("SELECT id FROM users WHERE role='administrator'").get())
    throw Error("已有管理員，初始化不會覆寫既有帳密。");
  const username = process.env.AU5800_BOOTSTRAP_USERNAME || "000029220";
  let password = process.env.AU5800_BOOTSTRAP_PASSWORD;
  if (!password) {
    password = await secret("請輸入管理員初始密碼（不顯示）：");
    if (password !== (await secret("再次輸入：")))
      throw Error("兩次密碼不一致。");
  }
  await bootstrapAdministrator(db, { username, password });
  console.log(`管理員 ${username} 已建立，首次登入須更換密碼。`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
