import { accountError } from "./accounts.mjs";
import { scoreAttempt, attemptChecks } from "../shared/exam.ts";
import { analyticsVersion } from "../shared/training.ts";

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length
    ? (v[Math.floor((v.length - 1) / 2)] + v[Math.ceil((v.length - 1) / 2)]) / 2
    : null;
};
const cell = (value) =>
  `"${String(value ?? "")
    .replace(/^(\s*)([=+@-])|^([\t\r\n])/, "'$&")
    .replaceAll('"', '""')}"`;
export function createAnalyticsService(db, training) {
  function report(user, params, details = false) {
    if (
      user.role !== "administrator" &&
      params.get("user") &&
      params.get("user") !== user.id
    )
      throw accountError(403, "只能查看自己的學習紀錄。");
    const from = params.get("from"),
      to = params.get("to");
    const date = (value, end) => {
      if (!value) return end ? Infinity : -Infinity;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw accountError(400, "日期格式不正確。");
      const ms = Date.parse(
        `${value}T${end ? "23:59:59.999" : "00:00:00"}+08:00`,
      );
      if (
        !Number.isFinite(ms) ||
        new Date(ms + 8 * 3600000).toISOString().slice(0, 10) !== value
      )
        throw accountError(400, "日期格式不正確。");
      return ms;
    };
    const start = date(from, false),
      end = date(to, true);
    if (start > end) throw accountError(400, "開始日期不得晚於結束日期。");
    const cohort = params.get("cohort"),
      kind = params.get("kind"),
      version = params.get("version"),
      selectedUser = params.get("user");
    // Fetch only matching metadata first. Large simulator states are read one at a
    // time below, so an administrator report never loads the entire database.
    const users = db
      .prepare(
        `SELECT id,learner_code,name,cohort_id,enabled FROM users u
      WHERE role='learner' OR EXISTS(SELECT 1 FROM practice_sessions p WHERE p.user_id=u.id AND p.participant=1)
      OR EXISTS(SELECT 1 FROM attempts a WHERE a.user_id=u.id AND a.analytics_participant=1)`,
      )
      .all()
      .filter(
        (u) =>
          (user.role === "administrator" || u.id === user.id) &&
          (!selectedUser || selectedUser === u.id),
      );
    const ids = new Set(users.map((u) => u.id));
    function metadata(mode, filterVersion = true) {
      const practice = mode === "practice",
        values = [];
      const clauses = [
        practice
          ? "a.participant=1"
          : "COALESCE(a.analytics_participant,CASE WHEN u.role='learner' THEN 1 ELSE 0 END)=1",
      ];
      const where = (sql, value) => {
        clauses.push(sql);
        values.push(value);
      };
      if (user.role !== "administrator") where("a.user_id=?", user.id);
      if (selectedUser) where("a.user_id=?", selectedUser);
      if (Number.isFinite(start)) where("a.started_at>=?", start);
      if (Number.isFinite(end)) where("a.started_at<=?", end);
      if (kind) where("a.kind=?", kind);
      if (filterVersion && version) where("a.version=?", version);
      if (cohort)
        where("json_extract(a.background_snapshot,'$.cohortId')=?", cohort);
      const projection = filterVersion
        ? `a.id,a.user_id,a.kind,a.version,a.status,a.started_at,a.${practice ? "ended_at" : "submitted_at"} AS ended_at,a.background_snapshot${practice ? "" : ",a.analytics_participant"}`
        : "DISTINCT a.version";
      return db
        .prepare(
          `SELECT ${projection} FROM ${practice ? "practice_sessions" : "attempts"} a JOIN users u ON u.id=a.user_id WHERE ${clauses.join(" AND ")} ${filterVersion ? "ORDER BY a.started_at LIMIT 5001" : ""}`,
        )
        .all(...values);
    }
    const chosen = [
      ...metadata("practice").map((r) => ({ ...r, mode: "practice" })),
      ...metadata("exam").map((r) => ({ ...r, mode: "exam" })),
    ].filter((r) => ids.has(r.user_id));
    if (chosen.length > 5000)
      throw accountError(
        413,
        "符合條件的紀錄超過 5,000 輪，請縮小日期、班別或學員範圍後再查詢或匯出。",
      );
    if (details && chosen.length > 1000)
      throw accountError(
        413,
        "步驟明細超過 1,000 輪，請縮小日期、班別或學員範圍後再匯出，避免大量明細耗盡記憶體。",
      );
    const options = {
      versions: [
        ...new Set(
          [...metadata("practice", false), ...metadata("exam", false)].map(
            (r) => r.version,
          ),
        ),
      ].sort(),
      cohorts: db
        .prepare("SELECT id,name FROM cohorts ORDER BY name")
        .all()
        .filter(
          (c) =>
            user.role === "administrator" ||
            users.some((u) => u.cohort_id === c.id),
        ),
    };
    const roster = users.filter(
      (u) =>
        !cohort ||
        u.cohort_id === cohort ||
        chosen.some((r) => r.user_id === u.id),
    );
    const learners = roster.map((u) => ({
      id: u.id,
      code: u.learner_code,
      name: u.name,
      enabled: !!u.enabled,
      practiceMs: null,
      examMs: null,
      practiceCount: 0,
      completedPractice: 0,
      activePractice: 0,
      examCount: 0,
      submitted: 0,
      abandoned: 0,
      activeExam: 0,
      unrecorded: 0,
      partial: 0,
    }));
    const steps = new Map(),
      heatmap = new Map(),
      categories = {},
      sessions = [],
      gradeGroups = new Map();
    const stepDetails = [];
    let unknownErrors = 0;
    for (const row of chosen) {
      const learner = learners.find((u) => u.id === row.user_id);
      if (!learner) continue;
      const saved = db
        .prepare(
          `SELECT state,result FROM ${row.mode === "practice" ? "practice_sessions" : "attempts"} WHERE id=?`,
        )
        .get(row.id);
      const timing = training.timing(row.mode, row.id);
      const result = saved.result
        ? JSON.parse(saved.result)
        : row.mode === "practice"
          ? scoreAttempt(
              row.kind,
              JSON.parse(saved.state),
              training.events(row.id),
              row.started_at,
              row.ended_at || Date.now(),
              row.version,
            )
          : row.status === "abandoned"
            ? {
                groups: attemptChecks(
                  row.kind,
                  JSON.parse(saved.state),
                  [],
                  row.version,
                ),
              }
            : null;
      const visible = row.mode === "practice" || row.status !== "active";
      const events = visible
        ? row.mode === "practice"
          ? training.events(row.id)
          : db
              .prepare("SELECT * FROM events WHERE attempt_id=? ORDER BY seq")
              .all(row.id)
              .map((r) => ({
                ...r,
                accepted: !!r.accepted,
                command: JSON.parse(r.command),
                diagnostic: r.diagnostic ? JSON.parse(r.diagnostic) : null,
              }))
        : [];
      const eventErrors = events.filter((e) => e.error).length;
      const errorCount = !visible
        ? null
        : Array.isArray(result?.errors)
          ? result.errors.length
          : events.length ||
              row.mode === "practice" ||
              row.analytics_participant !== null
            ? eventErrors
            : null;
      // Frozen outcomes may predate detailed event retention. Keep their known
      // raw count while leaving step classification explicitly unrecorded.
      if (errorCount !== null)
        unknownErrors += Math.max(0, errorCount - eventErrors);
      const completed =
        result?.groups.filter((g) => g.items.every((i) => i.completed))
          .length ?? null;
      const summary = {
        id: row.id,
        mode: row.mode,
        userId: row.user_id,
        code: learner.code,
        kind: row.kind,
        version: row.version,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        cohortName: row.background_snapshot
          ? JSON.parse(row.background_snapshot).cohortName || null
          : null,
        timing,
        score:
          row.mode === "exam" && row.status === "submitted"
            ? (result?.score ?? null)
            : null,
        criticalRatio:
          row.mode === "exam" && row.status === "submitted"
            ? (result?.criticalRatio ?? null)
            : null,
        elapsedMs: Math.max(0, (row.ended_at || Date.now()) - row.started_at),
        waitingMs:
          row.kind === "troubleshooting"
            ? (timing.simulationWaitMs ?? null)
            : (result?.waitingMs ?? null),
        skippedMs: result?.skippedMs ?? null,
        errors: errorCount,
        corrections: null,
        completedGroups: completed,
        totalGroups: result?.groups.length ?? null,
        analysisQuality: events.some((e) => e.diagnostic)
          ? events.some((e) => !e.diagnostic)
            ? "partial"
            : "complete"
          : (row.mode === "practice" || row.analytics_participant !== null) &&
              !events.length
            ? "complete"
            : "unrecorded",
      };
      sessions.push(summary);
      if (timing.quality === "unrecorded") learner.unrecorded++;
      if (timing.quality === "partial") learner.partial++;
      if (row.mode === "practice") {
        if (timing.activeMs !== null)
          learner.practiceMs = (learner.practiceMs ?? 0) + timing.activeMs;
        learner.practiceCount++;
        learner.completedPractice += Number(row.status === "completed");
        learner.activePractice += Number(row.status === "active");
      } else {
        if (timing.activeMs !== null)
          learner.examMs = (learner.examMs ?? 0) + timing.activeMs;
        learner.examCount++;
        learner.submitted += Number(row.status === "submitted");
        learner.abandoned += Number(row.status === "abandoned");
        learner.activeExam += Number(row.status === "active");
      }
      if (summary.score !== null) {
        const key = `${row.kind}:${row.version}`;
        const g = gradeGroups.get(key) || {
          kind: row.kind,
          version: row.version,
          scores: [],
          learners: new Set(),
        };
        g.scores.push(summary.score);
        g.learners.add(row.user_id);
        gradeGroups.set(key, g);
      }
      const local = new Map();
      const unresolved = [];
      let correctionCount = 0;
      for (const group of result?.groups || [])
        for (const item of group.items) {
          local.set(`${group.id}/${item.id}`, {
            label: item.label,
            completed: item.completed,
            attempts: 0,
            firstSuccess: null,
            errors: 0,
            pending: 0,
            corrections: 0,
          });
        }
      for (const event of events) {
        if (!event.diagnostic) {
          if (event.error) unknownErrors++;
          continue;
        }
        const diag = event.diagnostic;
        let correctedStep = null;
        if (diag.success) {
          const index = unresolved.findIndex((e) =>
            e.steps.some((key) => diag.steps.includes(key)),
          );
          if (index >= 0) {
            const [prior] = unresolved.splice(index, 1);
            correctedStep = diag.steps.find((key) => prior.steps.includes(key));
            correctionCount++;
          }
        }
        if (event.error) unresolved.push({ steps: diag.steps });
        if (diag.errorCode)
          categories[diag.errorCode] = (categories[diag.errorCode] || 0) + 1;
        for (const key of diag.steps) {
          const item = local.get(key) || {
            label: key.endsWith("/action-start")
              ? key.startsWith("wipe/")
                ? "啟動 Cleaning Probe"
                : "啟動 Inspect Probe & Mixing Bar"
              : `其他操作 · ${event.command.type}`,
            completed: false,
            attempts: 0,
            firstSuccess: null,
            errors: 0,
            pending: 0,
            corrections: 0,
          };
          if (!item.attempts) item.firstSuccess = diag.success;
          item.attempts++;
          if (key.includes("/action-")) item.completed = diag.success;
          if (event.error) {
            item.errors++;
            item.pending++;
          } else if (key === correctedStep) {
            item.corrections++;
          }
          local.set(key, item);
        }
      }
      summary.corrections =
        summary.analysisQuality === "unrecorded" ? null : correctionCount;
      if (!visible) continue;
      for (const [step, item] of local) {
        if (details)
          stepDetails.push({
            sessionId: row.id,
            code: learner.code,
            mode: row.mode,
            kind: row.kind,
            version: row.version,
            startedAt: row.started_at,
            step,
            label: item.label,
            attempts: item.attempts,
            firstSuccess: item.firstSuccess,
            errors:
              summary.analysisQuality === "unrecorded" ? null : item.errors,
            corrections:
              summary.analysisQuality === "unrecorded"
                ? null
                : item.corrections,
            completed: item.completed,
            quality: summary.analysisQuality,
          });
        const key = `${row.mode}:${row.kind}:${row.version}:${step}`,
          agg = steps.get(key) || {
            key,
            mode: row.mode,
            kind: row.kind,
            version: row.version,
            step,
            label: item.label,
            attemptedRounds: 0,
            unattemptedRounds: 0,
            unrecordedRounds: 0,
            recordedRounds: 0,
            partialRounds: 0,
            firstSuccesses: 0,
            errors: 0,
            corrections: 0,
            unfinished: 0,
            attemptedLearners: new Set(),
            errorLearners: new Set(),
          };
        if (summary.analysisQuality === "unrecorded") agg.unrecordedRounds++;
        else {
          agg.recordedRounds++;
          agg.unattemptedRounds += Number(!item.attempts);
          agg.partialRounds += Number(summary.analysisQuality === "partial");
        }
        if (item.attempts) {
          agg.attemptedRounds++;
          agg.firstSuccesses += Number(item.firstSuccess);
          agg.attemptedLearners.add(row.user_id);
        }
        if (item.errors) agg.errorLearners.add(row.user_id);
        agg.errors += item.errors;
        agg.corrections += item.corrections;
        agg.unfinished += Number(!item.completed);
        steps.set(key, agg);
        const hkey = `${row.user_id}:${key}`,
          h = heatmap.get(hkey) || {
            learnerId: row.user_id,
            code: learner.code,
            stepKey: key,
            errors: 0,
            attempts: 0,
            unfinished: 0,
          };
        h.errors += item.errors;
        h.attempts += item.attempts;
        h.unfinished += Number(!item.completed);
        heatmap.set(hkey, h);
      }
    }
    const comparisons = [];
    for (const learner of learners) {
      const groups = new Map();
      sessions
        .filter((s) => s.userId === learner.id && s.score !== null)
        .sort((a, b) => a.startedAt - b.startedAt)
        .forEach((s) => {
          const key = `${s.kind}:${s.version}`;
          groups.set(key, [...(groups.get(key) || []), s]);
        });
      for (const entries of groups.values())
        comparisons.push({
          userId: learner.id,
          code: learner.code,
          kind: entries[0].kind,
          version: entries[0].version,
          first: entries[0].score,
          latest: entries.at(-1).score,
          difference:
            entries.length > 1
              ? Math.round((entries.at(-1).score - entries[0].score) * 10) / 10
              : null,
          points: entries.map((s) => ({
            id: s.id,
            at: s.startedAt,
            score: s.score,
          })),
        });
    }
    return {
      version: analyticsVersion,
      generatedAt: Date.now(),
      options,
      summary: {
        learners: learners.length,
        participants: learners.filter((u) => u.practiceCount + u.examCount > 0)
          .length,
        practiceMs: learners.some((u) => u.practiceMs !== null)
          ? learners.reduce((n, u) => n + (u.practiceMs ?? 0), 0)
          : null,
        examMs: learners.some((u) => u.examMs !== null)
          ? learners.reduce((n, u) => n + (u.examMs ?? 0), 0)
          : null,
        practiceCount: sessions.filter((s) => s.mode === "practice").length,
        completedPractice: sessions.filter(
          (s) => s.mode === "practice" && s.status === "completed",
        ).length,
        submitted: sessions.filter(
          (s) => s.mode === "exam" && s.status === "submitted",
        ).length,
        abandoned: sessions.filter(
          (s) => s.mode === "exam" && s.status === "abandoned",
        ).length,
        unknownErrors,
      },
      learners,
      sessions: sessions.sort((a, b) => b.startedAt - a.startedAt),
      comparisons,
      gradeGroups: [...gradeGroups.values()].map((g) => ({
        kind: g.kind,
        version: g.version,
        count: g.scores.length,
        learnerCount: g.learners.size,
        mean: g.scores.reduce((a, b) => a + b, 0) / g.scores.length,
        median: median(g.scores),
      })),
      steps: [...steps.values()].map((s) => ({
        ...s,
        errors: s.recordedRounds ? s.errors : null,
        corrections: s.recordedRounds ? s.corrections : null,
        attemptedLearners: s.attemptedLearners.size,
        errorLearners: s.errorLearners.size,
        firstSuccessRate: s.attemptedRounds
          ? s.firstSuccesses / s.attemptedRounds
          : null,
        errorLearnerRate: s.attemptedLearners.size
          ? s.errorLearners.size / s.attemptedLearners.size
          : null,
      })),
      heatmap: [...heatmap.values()],
      categories,
      ...(details ? { stepDetails } : {}),
    };
  }
  async function handle({ path, req, user, url, send, res }) {
    if (
      ![
        "/api/analytics/me",
        "/api/admin/analytics",
        "/api/admin/analytics/export",
      ].includes(path)
    )
      return false;
    if (req.method !== "GET") throw accountError(405, "不支援此方法。");
    if (path.startsWith("/api/admin/") && user.role !== "administrator")
      throw accountError(403, "此功能僅限管理員使用。");
    const reportUser =
      path === "/api/analytics/me" ? { ...user, role: "learner" } : user;
    const data = report(
      reportUser,
      url.searchParams,
      path.endsWith("/export") && url.searchParams.get("table") === "steps",
    );
    if (!path.endsWith("/export")) {
      send(200, data);
      return true;
    }
    const table = url.searchParams.get("table") || "learners";
    let headers, rows;
    if (table === "learners") {
      headers = [
        "學員代碼",
        "有效練習秒數",
        "有效考試秒數",
        "練習輪次",
        "完成輪次",
        "未完成練習",
        "考試次數",
        "交卷次數",
        "放棄次數",
        "未記錄時間輪次",
        "部分時間輪次",
      ];
      rows = data.learners.map((u) => [
        u.code,
        u.practiceMs === null ? "" : u.practiceMs / 1000,
        u.examMs === null ? "" : u.examMs / 1000,
        u.practiceCount,
        u.completedPractice,
        u.activePractice,
        u.examCount,
        u.submitted,
        u.abandoned,
        u.unrecorded,
        u.partial,
      ]);
    } else if (table === "sessions") {
      headers = [
        "紀錄代碼",
        "學員代碼",
        "模式",
        "任務",
        "評分版本",
        "狀態",
        "開始時間",
        "結束時間",
        "有效秒數",
        "時間完整性",
        "完成分",
        "關鍵步驟比例",
        "總經過秒數",
        "模擬等待秒數",
        "快轉秒數",
        "錯誤數",
        "補正數",
        "分析完整性",
      ];
      rows = data.sessions.map((s) => [
        s.id,
        s.code,
        s.mode,
        s.kind,
        s.version,
        s.status,
        new Date(s.startedAt).toISOString(),
        s.endedAt ? new Date(s.endedAt).toISOString() : "",
        s.timing.activeMs === null ? "" : s.timing.activeMs / 1000,
        s.timing.quality,
        s.score,
        s.criticalRatio,
        s.elapsedMs / 1000,
        s.waitingMs === null ? "" : s.waitingMs / 1000,
        s.skippedMs === null ? "" : s.skippedMs / 1000,
        s.errors,
        s.corrections,
        s.analysisQuality,
      ]);
    } else if (table === "steps") {
      headers = [
        "紀錄代碼",
        "學員代碼",
        "模式",
        "任務",
        "評分版本",
        "開始時間",
        "步驟代碼",
        "步驟",
        "嘗試次數",
        "首次操作成功",
        "錯誤次數",
        "補正次數",
        "已完成",
        "分析完整性",
        "分析版本",
      ];
      rows = data.stepDetails.map((s) => [
        s.sessionId,
        s.code,
        s.mode,
        s.kind,
        s.version,
        new Date(s.startedAt).toISOString(),
        s.step,
        s.label,
        s.attempts,
        s.firstSuccess === null ? "" : Number(s.firstSuccess),
        s.errors,
        s.corrections,
        Number(s.completed),
        s.quality,
        analyticsVersion,
      ]);
    } else throw accountError(400, "無效匯出類型。");
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-${table}.csv"`,
      "Cache-Control": "no-store",
    });
    res.end(
      "\uFEFF" +
        [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n"),
    );
    return true;
  }
  return { handle, report };
}
