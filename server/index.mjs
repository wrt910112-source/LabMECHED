import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, extname, sep, isAbsolute } from "node:path";
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

import { migrateDatabase } from "./database.mjs";
import {
  createAccountService,
  verifyPassword,
  accountError,
} from "./accounts.mjs";
import { isTaskOpen, taskClosedMessage } from "../shared/availability.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const httpError = accountError;
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
  const migration = migrateDatabase(db, dbPath);
  db.exec("PRAGMA journal_mode=WAL;");
  const accounts = createAccountService(db);
  const publicUser = accounts.view;
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
    if (row.status === "active" && isTaskOpen(row.kind)) {
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
      readOnly: !isTaskOpen(row.kind),
      backgroundSnapshot: row.background_snapshot
        ? JSON.parse(row.background_snapshot)
        : null,
      backgroundVersion: row.background_version,
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
      `au5800_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.AU5800_COOKIE_SECURE === "true" ? "; Secure" : ""}`,
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
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers["sec-fetch-site"] === "cross-site")
          throw httpError(403, "不接受跨站操作。");
        if (req.headers.origin) {
          const origin = new URL(req.headers.origin);
          const local =
            origin.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
            [String(server.address()?.port), "5173"].includes(origin.port);
          if (!local && origin.origin !== process.env.AU5800_PUBLIC_ORIGIN)
            throw httpError(403, "不接受此網站的操作請求。");
        }
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
          needsSetup: false,
          requiresInitialization:
            db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0,
          user,
        });
        return;
      }
      if (path === "/api/auth/setup")
        throw httpError(
          404,
          "不提供公開註冊；首位管理員請由本機初始化程序建立。",
        );
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
          `au5800_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.AU5800_COOKIE_SECURE === "true" ? "; Secure" : ""}`,
        );
        send(200, { ok: true });
        return;
      }
      if (
        await accounts.handle({
          path,
          req,
          user,
          bodyOf,
          send,
          issueSession: (_, id) => issueSession(res, id),
        })
      )
        return;
      if (path.startsWith("/api/admin/")) {
        if (user.role !== "administrator")
          throw httpError(403, "此功能僅限管理員使用。");
        if (path === "/api/admin/export" && req.method === "GET") {
          const cell = (v) =>
            `"${String(v ?? "")
              .replace(/^(\s*)([=+@-])|^([\t\r\n])/, "'$&")
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
        const currentUser = sessionUser(req);
        if (typeof body.kind !== "string")
          throw httpError(400, "任務格式不正確。");
        if (!isTaskOpen(body.kind)) throw httpError(403, taskClosedMessage);
        if (currentUser.role === "learner" && !currentUser.profileComplete)
          throw httpError(403, "請先完成學員背景資料再開始訓練。");
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
        db.prepare(
          "INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,revision,state,result,rubric,background_snapshot,background_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
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
          accounts.profileFor(user.id).profile
            ? JSON.stringify({
                ...accounts.profileFor(user.id).profile,
                cohortId: currentUser.cohortId,
                cohortName: currentUser.cohortId
                  ? db
                      .prepare("SELECT name FROM cohorts WHERE id=?")
                      .get(currentUser.cohortId)?.name || null
                  : null,
              })
            : null,
          accounts.profileFor(user.id).profile
            ? accounts.profileFor(user.id).version
            : null,
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
        if (!isTaskOpen(row.kind) && operation !== "abandon")
          throw httpError(403, taskClosedMessage);
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
    migration,
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
  if (
    process.env.RENDER === "true" &&
    (!process.env.AU5800_DB || !isAbsolute(process.env.AU5800_DB))
  ) {
    throw new Error(
      "On Render, set AU5800_DB to an absolute path inside your persistent disk mount, for example /var/data/au5800.sqlite.",
    );
  }
  const app = createApplication(),
    port = Number(process.env.PORT || process.env.AU5800_PORT || 3001);
  console.log(`AU5800 database: ${resolve(process.env.AU5800_DB || resolve(root, "data/au5800.sqlite"))}`);
  app.server.listen(port, "0.0.0.0", () =>
    console.log(`AU5800 server listening on http://0.0.0.0:${port}`),
  );
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
