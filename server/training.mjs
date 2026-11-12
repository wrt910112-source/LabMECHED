import {
  startSimulationTiming,
  observeSimulationTiming,
  simulationWaiting,
} from "./simulation-time.mjs";
import { randomUUID, randomBytes } from "node:crypto";
import {
  initialEngine,
  advanceEngine,
  applyCommand,
  scoreAttempt,
  attemptProgress,
  versionForKind,
  examPreparationGate,
} from "../shared/exam.ts";
import { diagnoseEvent } from "../shared/training.ts";
import { isTaskOpen } from "../shared/availability.ts";
import { accountError } from "./accounts.mjs";

const allowed = (body, keys) => {
  if (Object.keys(body).some((k) => !keys.includes(k)))
    throw accountError(400, "包含不允許的欄位。");
};
export function createTrainingService(db, accounts, clock = Date.now) {
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      db.exec("COMMIT");
      return value;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const events = (id) =>
    db
      .prepare("SELECT * FROM practice_events WHERE session_id=? ORDER BY seq")
      .all(id)
      .map((r) => ({
        id: r.id,
        at: r.at,
        source: r.source,
        command: JSON.parse(r.command),
        accepted: !!r.accepted,
        label: r.label,
        error: r.error,
        diagnostic: r.diagnostic ? JSON.parse(r.diagnostic) : null,
      }));
  function target(mode, id, user, own = true) {
    if (!["practice", "exam"].includes(mode) || typeof id !== "string")
      throw accountError(400, "無效訓練紀錄。");
    const row = db
      .prepare(
        `SELECT * FROM ${mode === "practice" ? "practice_sessions" : "attempts"} WHERE id=?`,
      )
      .get(id);
    if (
      !row ||
      (row.user_id !== user.id && (own || user.role !== "administrator"))
    )
      throw accountError(404, "找不到訓練紀錄。");
    return row;
  }
  function timing(mode, id) {
    const row = db
      .prepare("SELECT * FROM training_activity WHERE mode=? AND session_id=?")
      .get(mode, id);
    const stored = db
      .prepare(
        `SELECT json_extract(state,'$.trainingWait') AS waiting FROM ${mode === "practice" ? "practice_sessions" : "attempts"} WHERE id=?`,
      )
      .get(id);
    const metadata = stored?.waiting ? JSON.parse(stored.waiting) : null;
    return {
      activeMs: row?.active_ms ?? null,
      quality: row
        ? metadata?.partial
          ? "partial"
          : row.quality
        : "unrecorded",
      observedSince: row?.observed_since ?? null,
      simulationWaitMs: simulationWaiting({ trainingWait: metadata }, clock()),
    };
  }
  function accrue(lease, now) {
    if (!lease) return;
    const gap = now - lease.last_at;
    const end = Math.min(now, lease.active_until, lease.expires_at);
    const delta =
      lease.visible && gap >= 0 && gap <= 30000
        ? Math.max(0, end - lease.last_at)
        : 0;
    db.prepare(
      "UPDATE training_activity SET active_ms=active_ms+? WHERE mode=? AND session_id=?",
    ).run(delta, lease.mode, lease.session_id);
  }
  function pauseUser(userId) {
    transaction(() => {
      const l = db
        .prepare("SELECT * FROM training_leases WHERE user_id=?")
        .get(userId);
      accrue(l, clock());
      db.prepare("DELETE FROM training_leases WHERE user_id=?").run(userId);
    });
  }
  function assertLease(req, user, mode, id, required = false) {
    const l = db
      .prepare("SELECT * FROM training_leases WHERE user_id=?")
      .get(user.id);
    if (
      !l &&
      !required &&
      !req.headers["x-training-lease"] &&
      !db
        .prepare(
          "SELECT 1 FROM training_activity WHERE mode=? AND session_id=?",
        )
        .get(mode, id)
    )
      return; // Legacy clients are compatible until this round is tracked.
    if (!l || l.expires_at <= clock())
      throw Object.assign(accountError(423, "操作連線已過期，請重新連線。"), {
        reason: "lease_expired",
      });
    if (
      l.mode !== mode ||
      l.session_id !== id ||
      req.headers["x-training-lease"] !== l.token
    )
      throw Object.assign(
        accountError(423, "此帳號已由另一個視窗接手，請接手操作或返回探索。"),
        { reason: "lease_conflict" },
      );
  }
  function finishIfComplete(row, state) {
    if (row.status !== "active") return row;
    const log = events(row.id),
      progress = attemptProgress(row.kind, state, log, row.version);
    if (
      progress.completedGroups === progress.totalGroups &&
      progress.totalGroups > 0
    ) {
      const now = clock();
      observeSimulationTiming(state, now, true);
      const result = scoreAttempt(
        row.kind,
        state,
        log,
        row.started_at,
        now,
        row.version,
      );
      db.prepare(
        "UPDATE practice_sessions SET status='completed',ended_at=?,result=?,state=? WHERE id=? AND status='active'",
      ).run(now, JSON.stringify(result), JSON.stringify(state), row.id);
      const l = db
        .prepare(
          "SELECT * FROM training_leases WHERE user_id=? AND mode=? AND session_id=?",
        )
        .get(row.user_id, "practice", row.id);
      accrue(l, now);
      if (l)
        db.prepare("DELETE FROM training_leases WHERE user_id=?").run(
          row.user_id,
        );
      return db
        .prepare("SELECT * FROM practice_sessions WHERE id=?")
        .get(row.id);
    }
    return row;
  }
  function advance(row) {
    if (row.status !== "active") return row;
    return transaction(() => {
      const old = db
        .prepare("SELECT * FROM practice_sessions WHERE id=?")
        .get(row.id);
      const state = observeSimulationTiming(
        advanceEngine(JSON.parse(old.state), clock()),
        clock(),
      );
      if (JSON.stringify(state) !== old.state)
        db.prepare("UPDATE practice_sessions SET state=? WHERE id=?").run(
          JSON.stringify(state),
          row.id,
        );
      return finishIfComplete(
        db.prepare("SELECT * FROM practice_sessions WHERE id=?").get(row.id),
        state,
      );
    });
  }
  function view(row, detailed = false) {
    const state = JSON.parse(row.state),
      log = events(row.id);
    return {
      id: row.id,
      userId: row.user_id,
      mode: "practice",
      kind: row.kind,
      version: row.version,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      submittedAt: row.ended_at,
      revision: row.revision,
      sim: state.sim,
      backgroundSnapshot: row.background_snapshot
        ? JSON.parse(row.background_snapshot)
        : null,
      backgroundVersion: row.background_version,
      ...(state.sim.preparation
        ? { preparationAccess: examPreparationGate(state, row.version) }
        : {}),
      progress: attemptProgress(row.kind, state, log, row.version),
      result: row.result ? JSON.parse(row.result) : null,
      timing: timing("practice", row.id),
      ...(detailed
        ? {
            events: log,
            checks: scoreAttempt(
              row.kind,
              state,
              log,
              row.started_at,
              row.ended_at || clock(),
              row.version,
            ).groups,
          }
        : {}),
    };
  }
  function create(user, kind, fresh = false) {
    if (!["daily", "troubleshooting"].includes(kind) || !isTaskOpen(kind))
      throw accountError(403, "此練習尚未開放。");
    if (user.role === "learner" && !user.profileComplete)
      throw accountError(403, "請先完成背景資料。");
    const old = db
      .prepare(
        "SELECT * FROM practice_sessions WHERE user_id=? AND kind=? AND status='active'",
      )
      .get(user.id, kind);
    if (old) return old;
    if (!fresh) {
      const completed = db
        .prepare(
          "SELECT * FROM practice_sessions WHERE user_id=? AND kind=? AND status='completed' ORDER BY started_at DESC LIMIT 1",
        )
        .get(user.id, kind);
      if (completed) return completed;
    }
    const now = clock(),
      id = randomUUID(),
      profile = accounts.profileFor(user.id),
      cohort = user.cohortId
        ? db.prepare("SELECT name FROM cohorts WHERE id=?").get(user.cohortId)
        : null;
    const snapshot = {
      ...(profile.profile || {}),
      cohortId: user.cohortId || null,
      cohortName: cohort?.name || null,
    };
    db.prepare(
      "INSERT INTO practice_sessions(id,user_id,kind,version,started_at,state,background_snapshot,background_version,cohort_id,participant) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      user.id,
      kind,
      versionForKind(kind),
      now,
      JSON.stringify(
        startSimulationTiming(
          initialEngine(versionForKind(kind), "practice"),
          now,
        ),
      ),
      JSON.stringify(snapshot),
      profile.version || null,
      user.cohortId || null,
      Number(user.role === "learner"),
    );
    db.prepare(
      "INSERT INTO training_activity(mode,session_id,user_id,observed_since,quality) VALUES('practice',?,?,?,'complete')",
    ).run(id, user.id, now);
    return db.prepare("SELECT * FROM practice_sessions WHERE id=?").get(id);
  }
  function practiceMessage(c, out) {
    if (out.error) {
      if (c.type === "daily-mode" && c.value === "inspect")
        return "請先完成 6 支探針擦拭。";
      if (c.type === "calibrate")
        return "請關閉 ISE Maintenance，完成 Cleaning 與三次 Prime、丟棄 CLEAN 杯，並放置四杯各至少 10 滴的校正液。";
      return out.error;
    }
    if (c.type === "prime")
      return `Total Prime 教學循環完成 ${out.state.sim.prime}／3 次。`;
    if (c.type === "daily-mode")
      return c.value === "wipe"
        ? "已進入 Cleaning Probe，請逐支擦拭 6 支探針。"
        : "請逐支確認 6 支探針排水，並檢查左右攪拌單元。";
    if (c.type === "reagent-check") return "All positions 已完成。";
    return out.message || "操作已保存。";
  }
  async function handle({ path, req, user, bodyOf, send }) {
    if (path === "/api/training/lease" && req.method === "POST") {
      const b = await bodyOf(req);
      allowed(b, ["mode", "sessionId", "viewId", "takeover"]);
      if (
        typeof b.viewId !== "string" ||
        b.viewId.length > 80 ||
        b.viewId.length < 8 ||
        (b.takeover !== undefined && typeof b.takeover !== "boolean")
      )
        throw accountError(400, "無效操作視窗。");
      const row = target(b.mode, b.sessionId, user);
      if (row.status !== "active") throw accountError(409, "本次操作已結束。");
      const result = transaction(() => {
        const now = clock(),
          old = db
            .prepare("SELECT * FROM training_leases WHERE user_id=?")
            .get(user.id);
        if (
          old &&
          old.expires_at > now &&
          old.view_id !== b.viewId &&
          !b.takeover
        )
          throw Object.assign(
            accountError(423, "此帳號正在另一個視窗操作，可接手並停止原視窗。"),
            { reason: "lease_conflict" },
          );
        accrue(old, now);
        const state = JSON.parse(row.state);
        if (row.kind === "troubleshooting" && !state.trainingWait) {
          startSimulationTiming(state, now, true);
          db.prepare(
            `UPDATE ${b.mode === "practice" ? "practice_sessions" : "attempts"} SET state=? WHERE id=?`,
          ).run(JSON.stringify(state), row.id);
        }
        // Rotate on reacquisition: late pulses from a previous lease cannot
        // reset the new lease sequence or release its write permission.
        const token = randomBytes(24).toString("hex");
        db.prepare(
          "INSERT INTO training_leases VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET view_id=excluded.view_id,token=excluded.token,mode=excluded.mode,session_id=excluded.session_id,expires_at=excluded.expires_at,last_at=excluded.last_at,sequence=0,visible=0,active_until=excluded.active_until",
        ).run(
          user.id,
          b.viewId,
          token,
          b.mode,
          b.sessionId,
          now + 45000,
          now,
          0,
          0,
          now,
        );
        db.prepare(
          "INSERT OR IGNORE INTO training_activity(mode,session_id,user_id,observed_since,quality) VALUES(?,?,?,?,?)",
        ).run(
          b.mode,
          b.sessionId,
          user.id,
          now,
          b.mode === "practice" ||
            (row.analytics_participant !== null && row.revision === 0)
            ? "complete"
            : "partial",
        );
        return {
          token,
          expiresAt: now + 45000,
          timing: timing(b.mode, b.sessionId),
        };
      });
      send(200, result);
      return true;
    }
    if (path === "/api/training/activity" && req.method === "POST") {
      const b = await bodyOf(req);
      allowed(b, [
        "mode",
        "sessionId",
        "sequence",
        "visible",
        "lastActivityAgeMs",
        "release",
      ]);
      if (
        !Number.isSafeInteger(b.sequence) ||
        b.sequence < 1 ||
        typeof b.visible !== "boolean" ||
        !Number.isFinite(b.lastActivityAgeMs) ||
        b.lastActivityAgeMs < 0 ||
        b.lastActivityAgeMs > 86400000 ||
        (b.release !== undefined && typeof b.release !== "boolean")
      )
        throw accountError(400, "活動回報格式不正確。");
      const row = target(b.mode, b.sessionId, user);
      if (row.status !== "active") {
        send(200, { timing: timing(b.mode, b.sessionId) });
        return true;
      }
      assertLease(req, user, b.mode, b.sessionId, true);
      const result = transaction(() => {
        const now = clock(),
          l = db
            .prepare("SELECT * FROM training_leases WHERE user_id=?")
            .get(user.id);
        if (b.sequence <= l.sequence) return timing(b.mode, b.sessionId);
        accrue(l, now);
        if (b.release)
          db.prepare("DELETE FROM training_leases WHERE user_id=?").run(
            user.id,
          );
        else
          db.prepare(
            "UPDATE training_leases SET last_at=?,sequence=?,visible=?,active_until=?,expires_at=? WHERE user_id=?",
          ).run(
            now,
            b.sequence,
            Number(b.visible),
            now + Math.max(0, 120000 - b.lastActivityAgeMs),
            now + 45000,
            user.id,
          );
        return timing(b.mode, b.sessionId);
      });
      const current = b.mode === "practice" ? advance(row) : null;
      send(200, {
        timing: result,
        ...(current ? { session: view(current) } : {}),
      });
      return true;
    }
    if (path === "/api/practice-sessions" && req.method === "POST") {
      const b = await bodyOf(req);
      allowed(b, ["kind"]);
      const row = transaction(() => create(user, b.kind));
      send(200, { session: view(advance(row)) });
      return true;
    }
    if (path === "/api/practice-sessions/active" && req.method === "GET") {
      const rows = db
        .prepare(
          "SELECT * FROM practice_sessions WHERE user_id=? AND status='active' ORDER BY started_at DESC",
        )
        .all(user.id);
      send(200, { sessions: rows.map((r) => view(advance(r))) });
      return true;
    }
    const match = path.match(
      /^\/api\/practice-sessions\/([^/]+)(?:\/(events|restart|poll))?$/,
    );
    if (!match) return false;
    let row = target(
      "practice",
      match[1],
      user,
      !(!match[2] && req.method === "GET"),
    );
    if (!match[2] && req.method === "GET") {
      send(200, { session: view(row, true) });
      return true;
    }
    if (req.method !== "POST") throw accountError(405, "不支援此方法。");
    const b = await bodyOf(req);
    if (match[2] === "restart") {
      allowed(b, []);
      if (row.status === "active")
        assertLease(req, user, "practice", row.id, true);
      const next = transaction(() => {
        row = target("practice", row.id, user);
        const l = db
          .prepare("SELECT * FROM training_leases WHERE user_id=?")
          .get(user.id);
        if (l?.mode === "practice" && l.session_id === row.id) {
          accrue(l, clock());
          db.prepare("DELETE FROM training_leases WHERE user_id=?").run(
            user.id,
          );
        }
        if (row.status === "active") {
          const now = clock(),
            state = observeSimulationTiming(JSON.parse(row.state), now, true);
          db.prepare(
            "UPDATE practice_sessions SET status='restarted',ended_at=?,result=?,state=? WHERE id=?",
          ).run(
            now,
            JSON.stringify(
              scoreAttempt(
                row.kind,
                state,
                events(row.id),
                row.started_at,
                now,
                row.version,
              ),
            ),
            JSON.stringify(state),
            row.id,
          );
        }
        return create(user, row.kind, true);
      });
      send(200, { session: view(next) });
      return true;
    }
    if (match[2] === "poll") {
      allowed(b, []);
      assertLease(req, user, "practice", row.id, true);
      send(200, { session: view(advance(row)) });
      return true;
    }
    if (match[2] !== "events") throw accountError(404, "找不到此功能。");
    allowed(b, ["id", "revision", "source", "command"]);
    if (
      typeof b.id !== "string" ||
      b.id.length > 80 ||
      !b.id ||
      !Number.isSafeInteger(b.revision) ||
      !["model", "workstation"].includes(b.source) ||
      !b.command ||
      Array.isArray(b.command) ||
      typeof b.command.type !== "string" ||
      (b.command.target !== undefined &&
        typeof b.command.target !== "string") ||
      (b.command.data !== undefined &&
        (!b.command.data ||
          Array.isArray(b.command.data) ||
          typeof b.command.data !== "object"))
    )
      throw accountError(400, "操作事件格式不正確。");
    const previous = db
      .prepare("SELECT * FROM practice_events WHERE id=?")
      .get(b.id);
    if (previous) {
      if (
        previous.session_id !== row.id ||
        previous.command !== JSON.stringify(b.command) ||
        previous.source !== b.source
      )
        throw accountError(409, "事件代碼已使用。");
      send(200, {
        session: view(row),
        applied: !!previous.accepted && !previous.error,
        message: previous.error || "操作已保存。",
      });
      return true;
    }
    assertLease(req, user, "practice", row.id, true);
    if (row.status !== "active" || b.revision !== row.revision)
      throw accountError(409, "練習進度已更新，請重新載入。");
    const response = transaction(() => {
      row = target("practice", row.id, user);
      if (row.status !== "active" || b.revision !== row.revision)
        throw accountError(409, "練習進度已更新，請重新載入。");
      const before = JSON.parse(row.state),
        out = applyCommand(before, row.kind, b.command, clock(), row.version);
      const diagnostic = diagnoseEvent(
        row.kind,
        before,
        b.command,
        out,
        row.version,
      );
      // Practice retains the failed attempt, while keeping the last valid setup.
      // Exams keep their original reducer behavior and scoring contract.
      const recordedAbnormal =
        out.accepted &&
        b.command.value === "異常" &&
        ["daily-drain", "daily-mix", "drain-result", "daily-syringe"].includes(
          b.command.type,
        );
      if (out.error && !recordedAbnormal) {
        out.state = before;
        out.accepted = false;
      }
      db.prepare("INSERT INTO practice_events VALUES(?,?,?,?,?,?,?,?,?,?)").run(
        b.id,
        row.id,
        row.revision + 1,
        clock(),
        b.source,
        JSON.stringify(b.command),
        Number(out.accepted),
        out.label,
        out.error,
        JSON.stringify(diagnostic),
      );
      observeSimulationTiming(out.state, clock());
      db.prepare(
        "UPDATE practice_sessions SET state=?,revision=revision+1 WHERE id=?",
      ).run(JSON.stringify(out.state), row.id);
      row = finishIfComplete(
        db.prepare("SELECT * FROM practice_sessions WHERE id=?").get(row.id),
        out.state,
      );
      return {
        session: view(row),
        applied: out.accepted && !out.error,
        message: practiceMessage(b.command, out),
      };
    });
    send(200, response);
    return true;
  }
  return { handle, timing, assertLease, pauseUser, target, view, events };
}
