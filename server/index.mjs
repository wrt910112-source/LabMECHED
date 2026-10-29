import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initialEngine,
  advanceEngine,
  applyCommand,
  scoreAttempt,
  attemptProgress,
  versionForKind,
  supportsVersion,
  examPreparationGate,
} from "../shared/exam.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deriveKey = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  role: row.role,
  enabled: !!row.enabled,
});
const httpError = (status, message) =>
  Object.assign(new Error(message), { status });
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await deriveKey(password, salt, 64)).toString("hex")}`;
}
async function verifyPassword(password, saved) {
  const [salt, key] = saved.split(":");
  const supplied = await deriveKey(password, salt, 64);
  return timingSafeEqual(supplied, Buffer.from(key, "hex"));
}
function accountInput(body) {
  const username = String(body.username || "")
      .trim()
      .toLowerCase(),
    name = String(body.name || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))
    throw httpError(400, "帳號需為 3–40 個英文字母、數字、點、底線或連字號。");
  if (!name || name.length > 80)
    throw httpError(400, "請填寫姓名（最多 80 字）。");
  passwordInput(body.password);
  return { username, name, password: body.password };
}
function passwordInput(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw httpError(400, "密碼需為 8–128 字。");
}
async function bodyOf(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw httpError(415, "請使用 JSON 格式。");
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 131072) throw httpError(413, "資料過大。");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") throw 0;
    return value;
  } catch {
    throw httpError(400, "資料格式不正確。");
  }
}

export function createApplication({
  dbPath = process.env.AU5800_DB || resolve(root, "data/au5800.sqlite"),
  staticRoot = resolve(root, "dist"),
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, password TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, submitted_at INTEGER, revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, result TEXT, rubric TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_attempt ON attempts(user_id) WHERE status='active';
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), seq INTEGER NOT NULL, at INTEGER NOT NULL, source TEXT NOT NULL, command TEXT NOT NULL, accepted INTEGER NOT NULL, label TEXT NOT NULL, error TEXT NOT NULL, UNIQUE(attempt_id,seq));
    CREATE INDEX IF NOT EXISTS learner_history ON attempts(user_id,started_at);
    PRAGMA user_version=1;`);
  const loginFailures = new Map();
  const eventsFor = (id) =>
    db
      .prepare("SELECT * FROM events WHERE attempt_id=? ORDER BY seq")
      .all(id)
      .map((row) => ({
        id: row.id,
        at: row.at,
        source: row.source,
        command: JSON.parse(row.command),
        accepted: !!row.accepted,
        label: row.label,
        error: row.error,
      }));
  function loaded(row, now = Date.now()) {
    if (!row) throw httpError(404, "找不到考試紀錄。");
    let state = JSON.parse(row.state);
    if (row.status === "active") {
      if (!supportsVersion(row.kind, row.version))
        throw httpError(409, "這次考試的版本無法繼續，請放棄後重新開始。");
      state = advanceEngine(state, now);
      db.prepare(
        "UPDATE attempts SET state=? WHERE id=? AND status='active'",
      ).run(JSON.stringify(state), row.id);
    }
    return state;
  }
  function attemptView(row, detailed = false) {
    const state = loaded(row);
    const attempt = {
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      version: row.version,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      revision: row.revision,
      sim: state.sim,
      ...(state.sim.preparation
        ? { preparationAccess: examPreparationGate(state, row.version) }
        : {}),
      progress: attemptProgress(
        row.kind,
        state,
        eventsFor(row.id),
        row.version,
      ),
      result: row.result ? JSON.parse(row.result) : null,
    };
    if (detailed && row.status !== "active") attempt.events = eventsFor(row.id);
    return attempt;
  }
  function findAttempt(id, user) {
    const row = db.prepare("SELECT * FROM attempts WHERE id=?").get(id);
    if (!row || (user.role !== "administrator" && row.user_id !== user.id))
      throw httpError(404, "找不到考試紀錄。");
    return row;
  }
  function assertOwn(row, user) {
    if (row.user_id !== user.id) throw httpError(403, "只能操作自己的考試。");
  }
  function sessionUser(req) {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("au5800_session="))
      ?.slice(15);
    if (!token) throw httpError(401, "請先登入。");
    const row = db
      .prepare(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.enabled=1",
      )
      .get(digest(token), Date.now());
    if (!row) throw httpError(401, "登入已失效，請重新登入。");
    return publicUser(row);
  }
  async function issueSession(res, userId) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      userId,
      Date.now() + 7 * 86400000,
    );
    res.setHeader(
      "Set-Cookie",
      `au5800_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
    );
  }
  function selectedHistory(url, user) {
    const rows = db
      .prepare(
        "SELECT a.*, u.username,u.name,u.role,u.enabled FROM attempts a JOIN users u ON u.id=a.user_id ORDER BY a.started_at DESC,a.rowid DESC",
      )
      .all();
    const from = url.searchParams.get("from"),
      to = url.searchParams.get("to");
    const fromMs = from
      ? new Date(`${from}T00:00:00+08:00`).getTime()
      : -Infinity;
    const toMs = to ? new Date(`${to}T23:59:59.999+08:00`).getTime() : Infinity;
    if (Number.isNaN(fromMs) || Number.isNaN(toMs))
      throw httpError(400, "日期格式不正確。");
    return rows.filter(
      (r) =>
        (user.role === "administrator" || r.user_id === user.id) &&
        (!url.searchParams.get("user") ||
          r.user_id === url.searchParams.get("user")) &&
        (!url.searchParams.get("kind") ||
          r.kind === url.searchParams.get("kind")) &&
        r.started_at >= fromMs &&
        r.started_at <= toMs,
    );
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname;
      if (!path.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD")
          throw httpError(405, "不支援此方法。");
        const file = resolve(
          staticRoot,
          `.${decodeURIComponent(path === "/" ? "/index.html" : path)}`,
        );
        if (
          file !== resolve(staticRoot) &&
          !file.startsWith(resolve(staticRoot) + sep)
        )
          throw httpError(404, "找不到檔案。");
        if (!existsSync(file) || !statSync(file).isFile())
          throw httpError(404, "網頁尚未建置，請先執行 npm run build。");
        const mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
        };
        res.writeHead(200, {
          "Content-Type": `${mime[extname(file)] || "application/octet-stream"}${[".html", ".js", ".css", ".json"].includes(extname(file)) ? "; charset=utf-8" : ""}`,
        });
        res.end(req.method === "HEAD" ? undefined : readFileSync(file));
        return;
      }
      if (!["GET", "HEAD"].includes(req.method) && req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (
          origin.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
          ![String(server.address()?.port), "5173"].includes(origin.port)
        )
          throw httpError(403, "不接受此網站的操作請求。");
      }
      if (path === "/api/health") {
        send(200, { ok: true });
        return;
      }
      if (path === "/api/auth/status" && req.method === "GET") {
        let user = null;
        try {
          user = sessionUser(req);
        } catch {}
        send(200, {
          needsSetup:
            db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0,
          user,
        });
        return;
      }
      if (path === "/api/auth/setup" && req.method === "POST") {
        if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n)
          throw httpError(409, "教師帳號已建立，請登入。");
        const body = accountInput(await bodyOf(req)),
          hash = await hashPassword(body.password),
          id = randomUUID();
        // Recheck after password hashing to avoid concurrent first-run setup.
        if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n)
          throw httpError(409, "教師帳號已建立，請登入。");
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
          id,
          body.username,
          body.name,
          "administrator",
          1,
          hash,
          Date.now(),
        );
        await issueSession(res, id);
        send(201, {
          user: publicUser(
            db.prepare("SELECT * FROM users WHERE id=?").get(id),
          ),
        });
        return;
      }
      if (path === "/api/auth/login" && req.method === "POST") {
        const body = await bodyOf(req),
          name = String(body.username || "")
            .toLowerCase()
            .trim(),
          key = `${req.socket.remoteAddress}:${name}`;
        const previous = loginFailures.get(key);
        if (previous?.count >= 10 && Date.now() - previous.at < 60000)
          throw httpError(429, "登入嘗試過於頻繁，請稍後再試。");
        if (typeof body.password !== "string" || body.password.length > 128)
          throw httpError(400, "帳號或密碼不正確。");
        const row = db
          .prepare("SELECT * FROM users WHERE username=?")
          .get(name);
        if (
          !row ||
          !row.enabled ||
          !(await verifyPassword(body.password, row.password))
        ) {
          loginFailures.set(key, {
            count:
              previous && Date.now() - previous.at < 60000
                ? previous.count + 1
                : 1,
            at: Date.now(),
          });
          throw httpError(401, "帳號或密碼不正確，或帳號已停用。");
        }
        loginFailures.delete(key);
        await issueSession(res, row.id);
        send(200, { user: publicUser(row) });
        return;
      }
      const user = sessionUser(req);
      if (path === "/api/auth/logout" && req.method === "POST") {
        const token = req.headers.cookie
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("au5800_session="))
          .slice(15);
        db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
        res.setHeader(
          "Set-Cookie",
          "au5800_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        send(200, { ok: true });
        return;
      }
      if (path.startsWith("/api/admin/")) {
        if (user.role !== "administrator")
          throw httpError(403, "此功能僅限教師使用。");
        if (path === "/api/admin/users" && req.method === "GET") {
          send(200, {
            users: db
              .prepare("SELECT * FROM users ORDER BY created_at")
              .all()
              .map(publicUser),
          });
          return;
        }
        if (path === "/api/admin/users" && req.method === "POST") {
          const body = accountInput(await bodyOf(req));
          if (
            db
              .prepare("SELECT id FROM users WHERE username=?")
              .get(body.username)
          )
            throw httpError(409, "帳號已存在。");
          const hash = await hashPassword(body.password),
            id = randomUUID();
          try {
            db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
              id,
              body.username,
              body.name,
              "learner",
              1,
              hash,
              Date.now(),
            );
          } catch {
            throw httpError(409, "帳號已存在。");
          }
          send(201, {
            user: publicUser(
              db.prepare("SELECT * FROM users WHERE id=?").get(id),
            ),
          });
          return;
        }
        const match = path.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (match && req.method === "PATCH") {
          const row = db
            .prepare("SELECT * FROM users WHERE id=?")
            .get(match[1]);
          if (!row || row.role !== "learner")
            throw httpError(404, "找不到學員帳號。");
          const body = await bodyOf(req);
          if (body.password !== undefined) {
            passwordInput(body.password);
            db.prepare("UPDATE users SET password=? WHERE id=?").run(
              await hashPassword(body.password),
              row.id,
            );
          }
          if (body.enabled !== undefined) {
            if (typeof body.enabled !== "boolean")
              throw httpError(400, "帳號狀態格式不正確。");
            db.prepare("UPDATE users SET enabled=? WHERE id=?").run(
              Number(body.enabled),
              row.id,
            );
          }
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.id);
          send(200, {
            user: publicUser(
              db.prepare("SELECT * FROM users WHERE id=?").get(row.id),
            ),
          });
          return;
        }
        if (path === "/api/admin/export" && req.method === "GET") {
          const cell = (v) =>
            `"${String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""')}"`;
          const csv = [
            [
              "帳號",
              "姓名",
              "種類",
              "版本",
              "開始時間",
              "交卷時間",
              "完成分",
              "關鍵步驟比例",
              "總秒數",
              "操作秒數",
              "等待秒數",
              "快轉跳過秒數",
              "錯誤數",
              "補正數",
              "重複操作數",
            ],
            ...selectedHistory(url, user)
              .filter((r) => r.status === "submitted" && r.role === "learner")
              .map((r) => {
                const x = JSON.parse(r.result);
                return [
                  r.username,
                  r.name,
                  r.kind,
                  r.version,
                  new Date(r.started_at).toISOString(),
                  new Date(r.submitted_at).toISOString(),
                  x.score,
                  x.criticalRatio,
                  x.totalMs / 1000,
                  x.operationMs / 1000,
                  x.waitingMs / 1000,
                  x.skippedMs / 1000,
                  x.errors.length,
                  x.corrections,
                  x.repeatedActions,
                ];
              }),
          ]
            .map((row) => row.map(cell).join(","))
            .join("\r\n");
          res.writeHead(200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="au5800-results.csv"',
            "Cache-Control": "no-store",
          });
          res.end("\uFEFF" + csv);
          return;
        }
      }
      if (path === "/api/attempts/active" && req.method === "GET") {
        const row = db
          .prepare("SELECT * FROM attempts WHERE user_id=? AND status='active'")
          .get(user.id);
        send(200, { attempt: row ? attemptView(row) : null });
        return;
      }
      if (path === "/api/attempts" && req.method === "GET") {
        send(200, {
          attempts: selectedHistory(url, user).map((r) => ({
            ...attemptView(r),
            user: {
              id: r.user_id,
              username: r.username,
              name: r.name,
              role: r.role,
              enabled: !!r.enabled,
            },
          })),
        });
        return;
      }
      if (path === "/api/attempts" && req.method === "POST") {
        const body = await bodyOf(req);
        if (!["daily", "weekly", "troubleshooting"].includes(body.kind))
          throw httpError(400, "此測驗尚未開放。");
        if (
          db
            .prepare(
              "SELECT id FROM attempts WHERE user_id=? AND status='active'",
            )
            .get(user.id)
        )
          throw httpError(409, "請先交卷或放棄目前考試。");
        const id = randomUUID(),
          now = Date.now(),
          state = initialEngine(versionForKind(body.kind));
        const rubric = scoreAttempt(body.kind, state, [], now, now).groups.map(
          (g) => ({
            id: g.id,
            label: g.label,
            items: g.items.map(({ completed, ...item }) => item),
          }),
        );
        db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
          id,
          user.id,
          body.kind,
          versionForKind(body.kind),
          "active",
          now,
          null,
          0,
          JSON.stringify(state),
          null,
          JSON.stringify(rubric),
        );
        send(201, {
          attempt: attemptView(
            db.prepare("SELECT * FROM attempts WHERE id=?").get(id),
          ),
        });
        return;
      }
      const match = path.match(
        /^\/api\/attempts\/([^/]+)(?:\/(events|submit|abandon))?$/,
      );
      if (match) {
        let row = findAttempt(match[1], user);
        const operation = match[2];
        if (!operation && req.method === "GET") {
          send(200, { attempt: attemptView(row, true) });
          return;
        }
        if (req.method !== "POST") throw httpError(405, "不支援此方法。");
        assertOwn(row, user);
        const body = await bodyOf(req),
          now = Date.now();
        sessionUser(req);
        row = findAttempt(match[1], user);
        if (operation === "events") {
          if (
            typeof body.id !== "string" ||
            !/^[a-z0-9-]{16,80}$/i.test(body.id) ||
            !["model", "workstation"].includes(body.source) ||
            !body.command ||
            typeof body.command.type !== "string" ||
            (body.command.target !== undefined &&
              typeof body.command.target !== "string") ||
            (body.command.data !== undefined &&
              (!body.command.data ||
                Array.isArray(body.command.data) ||
                typeof body.command.data !== "object"))
          )
            throw httpError(400, "操作事件格式不正確。");
          const previous = db
            .prepare("SELECT * FROM events WHERE id=?")
            .get(body.id);
          if (previous) {
            if (
              previous.attempt_id !== row.id ||
              previous.command !== JSON.stringify(body.command) ||
              previous.source !== body.source
            )
              throw httpError(409, "操作識別碼已被使用。");
            send(200, {
              attempt: attemptView(row),
              applied: !!previous.accepted && !previous.error,
              message: previous.accepted ? "操作已保存。" : "操作未執行。",
            });
            return;
          }
          if (row.status !== "active")
            throw httpError(409, "考試已結束，不能再修改。");
          if (body.revision !== row.revision)
            throw httpError(409, "考試已在其他畫面更新，請重新載入目前紀錄。");
          const outcome = applyCommand(
            loaded(row, now),
            row.kind,
            body.command,
            now,
            row.version,
          );
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)").run(
              body.id,
              row.id,
              row.revision + 1,
              now,
              body.source,
              JSON.stringify(body.command),
              Number(outcome.accepted),
              outcome.label,
              outcome.error,
            );
            db.prepare(
              "UPDATE attempts SET state=?,revision=revision+1 WHERE id=?",
            ).run(JSON.stringify(outcome.state), row.id);
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          send(200, {
            attempt: attemptView(
              db.prepare("SELECT * FROM attempts WHERE id=?").get(row.id),
            ),
            applied: outcome.accepted && !outcome.error,
            message:
              outcome.message ||
              (outcome.accepted ? "操作已保存。" : "操作未執行。"),
          });
          return;
        }
        if (operation === "submit") {
          if (row.status === "submitted") {
            send(200, { attempt: attemptView(row, true) });
            return;
          }
          if (row.status !== "active") throw httpError(409, "此考試已放棄。");
          if (body.revision !== row.revision)
            throw httpError(409, "考試已更新，請重新載入再交卷。");
          const state = loaded(row, now),
            result = scoreAttempt(
              row.kind,
              state,
              eventsFor(row.id),
              row.started_at,
              now,
              row.version,
            );
          const previous = db
            .prepare(
              "SELECT kind,version,result FROM attempts WHERE user_id=? AND status='submitted' ORDER BY submitted_at DESC,rowid DESC",
            )
            .all(user.id);
          if (!previous.length) result.badges.unshift("首次完成測驗");
          const last = previous.find(
            (x) => x.kind === row.kind && x.version === row.version,
          );
          if (
            !result.errors.length &&
            result.score === 100 &&
            last &&
            JSON.parse(last.result).errors.length === 0 &&
            JSON.parse(last.result).score === 100
          )
            result.badges.push("同類測驗連續兩次完整且無操作錯誤");
          db.prepare(
            "UPDATE attempts SET state=?,result=?,status='submitted',submitted_at=? WHERE id=?",
          ).run(JSON.stringify(state), JSON.stringify(result), now, row.id);
          send(200, {
            attempt: attemptView(
              db.prepare("SELECT * FROM attempts WHERE id=?").get(row.id),
              true,
            ),
          });
          return;
        }
        if (operation === "abandon") {
          if (row.status === "submitted")
            throw httpError(409, "已交卷紀錄不能放棄。");
          db.prepare(
            "UPDATE attempts SET status='abandoned',submitted_at=? WHERE id=? AND status='active'",
          ).run(now, row.id);
          send(200, { ok: true });
          return;
        }
      }
      throw httpError(404, "找不到此功能。");
    } catch (error) {
      if (!error.status) console.error("API error:", error);
      send(
        error.status || 500,
        error.status
          ? { message: error.message }
          : { message: "資料尚未保存，伺服器發生錯誤。" },
      );
    }
  });
  return {
    server,
    db,
    async close() {
      await new Promise((resolveClose) => server.close(resolveClose));
      db.close();
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApplication(),
    port = Number(process.env.AU5800_PORT || 3001);
  app.server.listen(port, "127.0.0.1", () =>
    console.log(`AU5800 本地服務：http://127.0.0.1:${port}`),
  );
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
