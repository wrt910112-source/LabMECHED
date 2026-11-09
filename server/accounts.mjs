import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { backgroundVersion, validateProfile } from "../shared/accounts.ts";
import { newLearnerCode } from "./database.mjs";
import { createInvitationService } from "./invitations.mjs";
const deriveKey = promisify(scrypt);
export const accountError = (status, message) =>
  Object.assign(new Error(message), { status });
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await deriveKey(password, salt, 64)).toString("hex")}`;
}
export async function verifyPassword(password, saved) {
  const [salt, key] = saved.split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(key || "")) return false;
  return timingSafeEqual(
    await deriveKey(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
export function passwordInput(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw accountError(400, "密碼需為 8–128 字。");
}
export function usernameInput(value) {
  if (typeof value !== "string") throw accountError(400, "請填寫登入帳號。");
  const name = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(name))
    throw accountError(
      400,
      "帳號需為 3–40 個英文字母、數字、點、底線或連字號。",
    );
  return name;
}
export async function bootstrapAdministrator(
  db,
  { username, name = "管理員", password },
) {
  username = usernameInput(username);
  passwordInput(password);
  const hash = await hashPassword(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT id FROM users WHERE role='administrator'").get())
      throw accountError(409, "管理員已存在；初始化不會覆寫既有帳密。");
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users(id,username,name,role,enabled,password,created_at,learner_code,must_change_password) VALUES(?,?,?,'administrator',1,?,?,?,1)",
    ).run(id, username, name, hash, Date.now(), newLearnerCode());
    db.prepare("INSERT INTO account_audit VALUES(?,?,?, ?,?,?)").run(
      randomUUID(),
      id,
      id,
      "bootstrap",
      Date.now(),
      "{}",
    );
    db.exec("COMMIT");
    return id;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function createAccountService(db, { registrationHash = hashPassword } = {}) {
  const rowFor = (id) => db.prepare("SELECT * FROM users WHERE id=?").get(id);
  const profileFor = (id) => {
    const p = db
      .prepare("SELECT * FROM learner_profiles WHERE user_id=?")
      .get(id);
    return p
      ? {
          profile: JSON.parse(p.data),
          version: p.version,
          updatedAt: p.updated_at,
        }
      : { profile: null, version: backgroundVersion, updatedAt: null };
  };
  const view = (row) => {
    const p = profileFor(row.id);
    return {
      id: row.id,
      username: row.username,
      name: p.profile?.nickname || row.name,
      role: row.role,
      enabled: !!row.enabled,
      learnerCode: row.learner_code,
      mustChangePassword: !!row.must_change_password,
      profileComplete: !!p.profile,
      cohortId: row.cohort_id,
      invitationId: row.invitation_id || null,
      profile: p.profile,
      profileVersion: p.version,
      profileUpdatedAt: p.updatedAt,
    };
  };
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function audit(actor, target, action, metadata = {}) {
    db.prepare("INSERT INTO account_audit VALUES(?,?,?,?,?,?)").run(
      randomUUID(),
      actor,
      target,
      action,
      Date.now(),
      JSON.stringify(metadata),
    );
  }
  function allowed(body, keys) {
    if (Object.keys(body).some((k) => !keys.includes(k)))
      throw accountError(400, "請求包含不允許修改的欄位。");
  }
  function cohortInput(id) {
    if (id == null || id === "") return null;
    if (
      typeof id !== "string" ||
      !db.prepare("SELECT id FROM cohorts WHERE id=?").get(id)
    )
      throw accountError(400, "班別不存在，請先建立班別。");
    return id;
  }
  function normalize(body, importing = false) {
    if (body.name != null && typeof body.name !== "string")
      throw accountError(400, "顯示名稱格式不正確。");
    if (
      importing &&
      body.cohort !== undefined &&
      typeof body.cohort !== "string"
    )
      throw accountError(400, "班別格式不正確。");
    allowed(
      body,
      importing
        ? ["username", "name", "cohort"]
        : ["username", "name", "cohortId", "role"],
    );
    const username = usernameInput(body.username),
      name = body.name == null ? "" : String(body.name).trim();
    if (name.length > 80) throw accountError(400, "顯示名稱最多 80 字。");
    if (db.prepare("SELECT id FROM users WHERE username=?").get(username))
      throw accountError(409, `帳號 ${username} 已存在，不會覆寫。`);
    const role = importing ? "learner" : (body.role ?? "learner");
    if (!["learner", "administrator"].includes(role))
      throw accountError(400, "無效系統權限。");
    let cohortId = null;
    if (importing && body.cohort) {
      if (typeof body.cohort !== "string")
        throw accountError(400, "班別格式不正確。");
      const cohort = db
        .prepare("SELECT id FROM cohorts WHERE name=?")
        .get(body.cohort.trim());
      if (!cohort)
        throw accountError(400, `班別 ${body.cohort} 不存在，請先建立。`);
      cohortId = cohort.id;
    } else if (!importing) cohortId = cohortInput(body.cohortId);
    return { username, name: name || username, role, cohortId };
  }
  function insert(account, hash, mustChangePassword = true, invitationId = null) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users(id,username,name,role,enabled,password,created_at,learner_code,must_change_password,cohort_id,invitation_id) VALUES(?,?,?,?,1,?,?,?,?,?,?)",
    ).run(
      id,
      account.username,
      account.name,
      account.role,
      hash,
      Date.now(),
      newLearnerCode(),
      mustChangePassword ? 1 : 0,
      account.cohortId,
      invitationId,
    );
    return id;
  }
  function saveProfile(actor, id, body) {
    if (!rowFor(id)) throw accountError(404, "找不到帳號。");
    let profile;
    try {
      profile = validateProfile(body);
    } catch (e) {
      throw accountError(400, e.message);
    }
    transaction(() => {
      const current = rowFor(actor);
      if (!current?.enabled || current.must_change_password)
        throw accountError(403, "登入或密碼狀態已變更，請重新登入。");
      if (actor !== id && current.role !== "administrator")
        throw accountError(403, "只能修改自己的背景資料。");
      const previous = profileFor(id).profile;
      db.prepare(
        "INSERT INTO learner_profiles VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=excluded.updated_at",
      ).run(id, backgroundVersion, JSON.stringify(profile), Date.now());
      audit(actor, id, "profile-update", {
        fields: Object.keys(profile).filter(
          (k) => JSON.stringify(previous?.[k]) !== JSON.stringify(profile[k]),
        ),
      });
    });
    return profileFor(id);
  }
  const invitations = createInvitationService(db, {
    error: accountError, hashPassword: registrationHash, usernameInput, passwordInput,
    insert, transaction, audit, view, rowFor,
  });
  async function handle({ path, req, user, bodyOf, send, issueSession }) {
    if (path === "/api/auth/change-password" && req.method === "POST") {
      const b = await bodyOf(req);
      allowed(b, ["currentPassword", "newPassword"]);
      passwordInput(b.newPassword);
      const old = rowFor(user.id);
      if (
        typeof b.currentPassword !== "string" ||
        b.currentPassword.length > 128 ||
        !(await verifyPassword(b.currentPassword, old.password))
      )
        throw accountError(400, "目前密碼不正確。");
      if (b.currentPassword === b.newPassword)
        throw accountError(400, "新密碼不可與目前密碼相同。");
      const hash = await hashPassword(b.newPassword);
      transaction(() => {
        if (!rowFor(user.id)?.enabled) throw accountError(401, "帳號已停用。");
        if (rowFor(user.id).password !== old.password)
          throw accountError(409, "密碼已在其他畫面修改，請重新登入。");
        db.prepare(
          "UPDATE users SET password=?,must_change_password=0 WHERE id=?",
        ).run(hash, user.id);
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
        audit(user.id, user.id, "password-change");
      });
      await issueSession(undefined, user.id);
      send(200, { user: view(rowFor(user.id)) });
      return true;
    }
    if (user.mustChangePassword)
      throw accountError(403, "請先更換初始或臨時密碼。");
    if (path === "/api/me/profile") {
      if (req.method === "GET") send(200, profileFor(user.id));
      else if (req.method === "PUT")
        send(200, {
          ...saveProfile(user.id, user.id, await bodyOf(req)),
          user: view(rowFor(user.id)),
        });
      else throw accountError(405, "不支援此方法。");
      return true;
    }
    if (!path.startsWith("/api/admin/")) return false;
    if (user.role !== "administrator")
      throw accountError(403, "此功能僅限管理員使用。");
    const adminWrite = (fn) =>
      transaction(() => {
        const current = rowFor(user.id);
        if (
          !current?.enabled ||
          current.must_change_password ||
          current.role !== "administrator"
        )
          throw accountError(403, "管理權限已變更，請重新登入。");
        return fn();
      });
    if (await invitations.admin({ path, req, user, bodyOf, send, adminWrite })) return true;
    if (path === "/api/admin/users" && req.method === "GET") {
      send(200, {
        users: db
          .prepare("SELECT * FROM users ORDER BY created_at,id")
          .all()
          .map(view),
      });
      return true;
    }
    if (path === "/api/admin/cohorts") {
      if (req.method === "GET")
        send(200, {
          cohorts: db
            .prepare("SELECT id,name FROM cohorts ORDER BY created_at,id")
            .all(),
        });
      else if (req.method === "POST") {
        const b = await bodyOf(req);
        allowed(b, ["name"]);
        const name = typeof b.name === "string" ? b.name.trim() : "";
        if (!name || name.length > 80)
          throw accountError(400, "班別名稱需為 1–80 字。");
        const id = randomUUID();
        adminWrite(() => {
          if (db.prepare("SELECT id FROM cohorts WHERE name=?").get(name))
            throw accountError(409, "班別已存在。");
          db.prepare("INSERT INTO cohorts VALUES(?,?,?)").run(
            id,
            name,
            Date.now(),
          );
          audit(user.id, id, "cohort-create");
        });
        send(201, { cohort: { id, name } });
      } else throw accountError(405, "不支援此方法。");
      return true;
    }
    if (path === "/api/admin/users" && req.method === "POST") {
      const body = await bodyOf(req),
        account = normalize(body),
        temporaryPassword = randomBytes(12).toString("base64url"),
        hash = await hashPassword(temporaryPassword);
      const id = adminWrite(() => {
        normalize(body);
        const id = insert(account, hash);
        audit(user.id, id, "account-create", { role: account.role });
        return id;
      });
      send(201, { user: view(rowFor(id)), temporaryPassword });
      return true;
    }
    if (path === "/api/admin/users/import" && req.method === "POST") {
      const b = await bodyOf(req);
      allowed(b, ["rows", "dryRun"]);
      if (
        !Array.isArray(b.rows) ||
        !b.rows.length ||
        b.rows.length > 200 ||
        typeof b.dryRun !== "boolean"
      )
        throw accountError(400, "每批需為 1–200 筆，並指定預覽或建立。");
      const validateRows = () => {
        const seen = new Set();
        return b.rows.map((row, i) => {
          if (!row || typeof row !== "object" || Array.isArray(row))
            throw accountError(400, `第 ${i + 1} 筆格式不正確。`);
          const account = normalize(row, true);
          if (seen.has(account.username))
            throw accountError(400, `帳號 ${account.username} 在 CSV 中重複。`);
          seen.add(account.username);
          return account;
        });
      };
      const accounts = validateRows();
      if (b.dryRun) {
        send(200, { accounts });
        return true;
      }
      // Hash sequentially to bound CPU/memory use; no account is inserted until all are ready.
      const secrets = [];
      for (const account of accounts) {
        const password = randomBytes(12).toString("base64url");
        secrets.push({ account, password, hash: await hashPassword(password) });
      }
      const credentials = adminWrite(() => {
        validateRows();
        return secrets.map(({ account, password, hash }) => {
          const id = insert(account, hash);
          audit(user.id, id, "account-import");
          return { user: view(rowFor(id)), temporaryPassword: password };
        });
      });
      send(201, { credentials });
      return true;
    }
    const match = path.match(
      /^\/api\/admin\/users\/([^/]+)(?:\/(profile|reset-password))?$/,
    );
    if (match) {
      const id = match[1],
        operation = match[2];
      if (!rowFor(id)) throw accountError(404, "找不到帳號。");
      if (operation === "profile" && req.method === "PUT") {
        send(200, {
          ...saveProfile(user.id, id, await bodyOf(req)),
          user: view(rowFor(id)),
        });
        return true;
      }
      if (operation === "reset-password" && req.method === "POST") {
        if (id === user.id)
          throw accountError(400, "請使用變更密碼功能修改自己的密碼。");
        allowed(await bodyOf(req), []);
        const temporaryPassword = randomBytes(12).toString("base64url"),
          hash = await hashPassword(temporaryPassword);
        adminWrite(() => {
          db.prepare(
            "UPDATE users SET password=?,must_change_password=1 WHERE id=?",
          ).run(hash, id);
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
          audit(user.id, id, "password-reset");
        });
        send(200, { user: view(rowFor(id)), temporaryPassword });
        return true;
      }
      if (!operation && req.method === "PATCH") {
        const b = await bodyOf(req);
        allowed(b, ["enabled", "role", "cohortId"]);
        const cohortId =
          b.cohortId === undefined ? undefined : cohortInput(b.cohortId);
        if (b.enabled !== undefined && typeof b.enabled !== "boolean")
          throw accountError(400, "帳號狀態格式不正確。");
        if (
          b.role !== undefined &&
          !["learner", "administrator"].includes(b.role)
        )
          throw accountError(400, "無效系統權限。");
        adminWrite(() => {
          const old = rowFor(id),
            role = b.role ?? old.role,
            enabled = b.enabled === undefined ? old.enabled : Number(b.enabled);
          if (
            old.role === "administrator" &&
            old.enabled &&
            (role !== "administrator" || !enabled) &&
            db
              .prepare(
                "SELECT COUNT(*) AS n FROM users WHERE role='administrator' AND enabled=1",
              )
              .get().n <= 1
          )
            throw accountError(409, "不得停用或降權最後一位啟用中的管理員。");
          db.prepare(
            "UPDATE users SET role=?,enabled=?,cohort_id=? WHERE id=?",
          ).run(
            role,
            enabled,
            cohortId === undefined ? old.cohort_id : cohortId,
            id,
          );
          if (old.role !== role || old.enabled !== enabled)
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
          audit(user.id, id, "account-update", { fields: Object.keys(b) });
        });
        send(200, { user: view(rowFor(id)) });
        return true;
      }
    }
    if (path === "/api/admin/audit" && req.method === "GET") {
      send(200, {
        entries: db
          .prepare(
            "SELECT a.id,a.action,a.at,a.metadata,u.learner_code AS actor FROM account_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.at DESC,a.rowid DESC LIMIT 100",
          )
          .all()
          .map((r) => ({ ...r, metadata: JSON.parse(r.metadata) })),
      });
      return true;
    }
    return false;
  }
  return { view, profileFor, handle, register: invitations.register };
}
