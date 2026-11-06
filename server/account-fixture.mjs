// Test fixtures only. Never imported by the running application.
import { randomUUID } from "node:crypto";
import { hashPassword } from "./accounts.mjs";
import { newLearnerCode } from "./database.mjs";
import { backgroundVersion } from "../shared/accounts.ts";
export const testProfile = {
  nickname: "測試學員",
  department: "生化",
  identity: "醫檢師",
  clinicalMonths: 18,
  experience: "曾實際操作",
  usageFrequency: "每月1–3次",
  maintenanceKinds: ["日保養"],
  maintenanceFrequency: "少於每月一次",
};
export async function seedAccount(
  db,
  username = "teacher",
  role = "administrator",
  password = "Testing123!",
  complete = true,
) {
  const old = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (old) return old.id;
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users(id,username,name,role,enabled,password,created_at,learner_code,must_change_password) VALUES(?,?,?,?,1,?,?,?,0)",
  ).run(
    id,
    username,
    username,
    role,
    await hashPassword(password),
    Date.now(),
    newLearnerCode(),
  );
  if (complete)
    db.prepare("INSERT INTO learner_profiles VALUES(?,?,?,?)").run(
      id,
      backgroundVersion,
      JSON.stringify({ ...testProfile, nickname: username }),
      Date.now(),
    );
  return id;
}
