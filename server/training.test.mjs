import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApplication } from "./index.mjs";
import { seedAccount } from "./account-fixture.mjs";
import { complete } from "./daily-fixture.mjs";
import { currentDailyVersion } from "../shared/dailyScenario.ts";
import { applyCommand } from "../shared/exam.ts";
import { preparationRequirements } from "../shared/materialCatalog.ts";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { consistentBackup } from "./database.mjs";
import { spawnSync } from "node:child_process";

async function fixture(disk = false) {
  let now = Date.now();
  const app = createApplication({
    dbPath: disk
      ? join(mkdtempSync(join(tmpdir(), "training-load-")), "test.sqlite")
      : ":memory:",
    trainingClock: () => now,
  });
  const adminId = await seedAccount(app.db, "metrics-admin"),
    id = await seedAccount(app.db, "metrics-student", "learner"),
    otherId = await seedAccount(app.db, "metrics-other", "learner");
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const client = () => {
    let cookie = "";
    return async (path, method = "GET", body, token) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          cookie,
          ...(token ? { "X-Training-Lease": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      const text = await r.text();
      return {
        status: r.status,
        body: r.headers.get("content-type")?.includes("json")
          ? JSON.parse(text)
          : text,
      };
    };
  };
  const admin = client(),
    student = client(),
    other = client();
  for (const [c, username] of [
    [admin, "metrics-admin"],
    [student, "metrics-student"],
    [other, "metrics-other"],
  ])
    assert.equal(
      (await c("/auth/login", "POST", { username, password: "Testing123!" }))
        .status,
      200,
    );
  const create = async (kind = "daily") => {
    const r = await student("/practice-sessions", "POST", { kind });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.session;
  };
  const lease = async (s, viewId = "test-view-one", takeover = false) => {
    const r = await student("/training/lease", "POST", {
      mode: "practice",
      sessionId: s.id,
      viewId,
      takeover,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.token;
  };
  return {
    app,
    client,
    admin,
    student,
    other,
    id,
    otherId,
    adminId,
    create,
    lease,
    now: () => now,
    tick: (ms) => (now += ms),
  };
}
test("v3 migration backs up and restores credentials, invitations and frozen outcomes without recomputing", async () => {
  const folder = mkdtempSync(join(tmpdir(), "training-migration-")),
    path = join(folder, "source.sqlite");
  let app = createApplication({ dbPath: path });
  const id = await seedAccount(app.db, "retained-learner", "learner");
  app.db
    .prepare("INSERT INTO cohorts VALUES(?,?,?)")
    .run("course-old", "Existing course", 1);
  app.db
    .prepare("INSERT INTO invitations VALUES(?,?,?,?,?,?,?,0,?,?)")
    .run(
      "invite-old",
      "course-old",
      "hash-only",
      "ABCD",
      9999999999999,
      30,
      7,
      id,
      1,
    );
  app.db
    .prepare("UPDATE users SET cohort_id=?,invitation_id=? WHERE id=?")
    .run("course-old", "invite-old", id);
  app.db.exec(
    "DROP TABLE practice_events; DROP TABLE practice_sessions; DROP TABLE training_activity; DROP TABLE training_leases; ALTER TABLE events DROP COLUMN diagnostic; ALTER TABLE attempts DROP COLUMN analytics_participant; PRAGMA user_version=3;",
  );
  const state = JSON.stringify(complete("model", currentDailyVersion).state),
    result = JSON.stringify({
      score: 87,
      criticalRatio: 70,
      groups: [],
      errors: [],
    }),
    snapshot = JSON.stringify({
      cohortId: "course-old",
      cohortName: "Existing course",
      nickname: "Frozen",
    });
  app.db
    .prepare(
      "INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,state,result,rubric,background_snapshot,background_version) VALUES(?,?,'daily',?,'submitted',1,2,?,?,'[]',?,'profile-v1')",
    )
    .run("frozen-attempt", id, currentDailyVersion, state, result, snapshot);
  const before = {
    ...app.db.prepare("SELECT * FROM users WHERE id=?").get(id),
  };
  await app.close();
  app = createApplication({ dbPath: path });
  assert.equal(app.migration.from, 3);
  assert.equal(app.migration.to, 4);
  assert.ok(existsSync(app.migration.backup));
  assert.deepEqual(
    { ...app.db.prepare("SELECT * FROM users WHERE id=?").get(id) },
    before,
  );
  assert.equal(
    app.db.prepare("SELECT used_count FROM invitations").get().used_count,
    7,
  );
  const record = app.db.prepare("SELECT * FROM attempts").get();
  assert.equal(record.state, state);
  assert.equal(record.result, result);
  assert.equal(record.background_snapshot, snapshot);
  assert.equal(record.analytics_participant, null);
  const backup = app.migration.backup;
  await app.close();
  const restored = join(folder, "restored.sqlite"),
    cli = spawnSync(
      process.execPath,
      ["scripts/database-restore.mjs", backup, restored],
      { encoding: "utf8", windowsHide: true },
    );
  assert.equal(cli.status, 0, cli.stderr);
  const db = new DatabaseSync(restored, { readOnly: true });
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 3);
  db.close();
  app = createApplication({ dbPath: restored });
  assert.equal(
    app.db.prepare("SELECT result FROM attempts").get().result,
    result,
  );
  await app.close();
});
test("same-revision practice races reject stale writes instead of returning a SQLite error", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s);
    const results = await Promise.all(
      [0, 1].map(() =>
        f.student(
          `/practice-sessions/${s.id}/events`,
          "POST",
          {
            id: randomUUID(),
            revision: 0,
            source: "workstation",
            command: { type: "index-edit" },
          },
          token,
        ),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM practice_events").get().n,
      1,
    );
  } finally {
    await f.app.close();
  }
});
test("practice APIs preserve authoritative state, idempotent errors, ownership and archived rounds", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.student("/practice-sessions", "POST", {
          kind: "daily",
          role: "administrator",
        })
      ).status,
      400,
    );
    const s = await f.create(),
      token = await f.lease(s);
    assert.equal((await f.create()).id, s.id);
    for (const command of [
      { type: "cover", target: {} },
      { type: "preparation", data: [] },
      { type: "preparation", data: null },
    ]) {
      assert.equal(
        (
          await f.student(
            `/practice-sessions/${s.id}/events`,
            "POST",
            { id: randomUUID(), revision: 0, source: "model", command },
            token,
          )
        ).status,
        400,
      );
    }
    const event = {
      id: randomUUID(),
      revision: 0,
      source: "model",
      command: { type: "daily-wipe", target: "R1-1" },
    };
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}/events`, "POST", event))
        .status,
      423,
    );
    const bad = await f.student(
      `/practice-sessions/${s.id}/events`,
      "POST",
      event,
      token,
    );
    assert.equal(bad.status, 200);
    assert.equal(bad.body.applied, false);
    assert.equal(
      (
        await f.student(
          `/practice-sessions/${s.id}/events`,
          "POST",
          event,
          token,
        )
      ).body.session.revision,
      1,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM practice_events").get().n,
      1,
    );
    assert.equal((await f.other(`/practice-sessions/${s.id}`)).status, 404);
    assert.equal((await f.student("/admin/analytics")).status, 403);
    assert.equal(
      (await f.student(`/analytics/me?user=${f.otherId}`)).status,
      403,
    );
    const saved = await f.student(
      `/practice-sessions/${s.id}/events`,
      "POST",
      {
        id: randomUUID(),
        revision: 1,
        source: "model",
        command: { type: "cover", target: "mainLid", value: true },
      },
      token,
    );
    assert.equal(saved.body.session.sim.instrument.mainLid, true);
    assert.equal((await f.create()).sim.instrument.mainLid, true);
    assert.equal(
      (
        await f.student(
          `/practice-sessions/${s.id}/events`,
          "POST",
          { ...event, id: randomUUID() },
          token,
        )
      ).status,
      409,
    );
    const restarted = await f.student(
      `/practice-sessions/${s.id}/restart`,
      "POST",
      {},
      token,
    );
    assert.notEqual(restarted.body.session.id, s.id);
    assert.equal(restarted.body.session.sim.instrument.mainLid, false);
    const old = (await f.student(`/practice-sessions/${s.id}`)).body.session;
    assert.equal(old.status, "restarted");
    assert.equal(old.events.length, 2);
    assert.equal(old.events[0].diagnostic.errorCode, "prerequisite");
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM attempts").get().n,
      0,
    );
    const t = await f.create("troubleshooting");
    assert.equal(t.kind, "troubleshooting");
    assert.equal(
      (await f.student("/practice-sessions/active")).body.sessions.length,
      2,
    );
  } finally {
    await f.app.close();
  }
});
test("server clock excludes idle, hidden and disconnected gaps; duplicate pulses and takeovers never double count", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s);
    let seq = 0;
    const pulse = (visible = true, age = 0, sequence = ++seq) =>
      f.student(
        "/training/activity",
        "POST",
        {
          mode: "practice",
          sessionId: s.id,
          sequence,
          visible,
          lastActivityAgeMs: age,
        },
        token,
      );
    await pulse();
    for (let i = 1; i <= 8; i++) {
      f.tick(15000);
      await pulse(true, i * 15000);
    }
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .activeMs,
      120000,
    );
    f.tick(15000);
    await pulse(true, 135000);
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .activeMs,
      120000,
    );
    await pulse(true, 0);
    f.tick(15000);
    await pulse(false, 15000);
    f.tick(15000);
    await pulse(false, 30000);
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .activeMs,
      135000,
    );
    await pulse(true, 0);
    f.tick(35000);
    const p = await pulse();
    assert.equal(p.body.timing.activeMs, 135000);
    f.tick(1000);
    await pulse(true, 0, seq);
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .activeMs,
      135000,
    );
    assert.equal(
      (
        await f.student("/training/lease", "POST", {
          mode: "practice",
          sessionId: s.id,
          viewId: "test-view-two",
        })
      ).status,
      423,
    );
    const token2 = await f.lease(s, "test-view-two", true);
    assert.notEqual(token2, token);
    assert.equal((await pulse()).status, 423);
    assert.equal(
      (
        await f.student(
          `/practice-sessions/${s.id}/events`,
          "POST",
          {
            id: randomUUID(),
            revision: 0,
            source: "model",
            command: { type: "index-edit" },
          },
          token,
        )
      ).status,
      423,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM training_activity").get().n,
      1,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM training_leases").get().n,
      1,
    );
  } finally {
    await f.app.close();
  }
});
test("all thirteen groups finalize once, remain inspectable and reject later mutations", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s),
      x = complete("model", currentDailyVersion);
    let state = { ...x.state, dailyPolicy: "practice" };
    const slots = { RB: 1, CALI: 1, QC: 1 };
    function run(command) {
      const out = applyCommand(
        state,
        "daily",
        command,
        f.now(),
        currentDailyVersion,
      );
      assert.equal(out.error, "", JSON.stringify(command));
      state = out.state;
    }
    for (let i = 0; i < preparationRequirements.length; i++) {
      const r = preparationRequirements[i],
        cup = `cup-${i + 1}`;
      for (const a of [
        { action: "select", target: `source:${r.materialId}` },
        { action: "aspirate" },
        { action: "dispense", target: cup },
        ...(r.materialId.startsWith("ae-")
          ? [{ action: "dispense", target: cup }]
          : []),
        { action: "place", target: cup, rack: r.rack, slot: slots[r.rack]++ },
      ])
        run({ type: "preparation", data: a });
    }
    for (const rack of ["RB", "CALI", "QC"])
      for (const action of ["stage", "push"])
        run({ type: "preparation", data: { action, rack } });
    f.app.db
      .prepare("UPDATE practice_sessions SET state=? WHERE id=?")
      .run(JSON.stringify(state), s.id);
    const first = await f.student(
      `/practice-sessions/${s.id}/poll`,
      "POST",
      {},
      token,
    );
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.session.status, "completed");
    assert.equal(first.body.session.result.score, 100);
    const ended = first.body.session.endedAt;
    f.tick(60000);
    const old = (await f.student(`/practice-sessions/${s.id}`)).body.session;
    assert.equal(old.endedAt, ended);
    assert.equal(old.status, "completed");
    assert.equal(
      (
        await f.student(
          `/practice-sessions/${s.id}/events`,
          "POST",
          {
            id: randomUUID(),
            revision: 0,
            source: "model",
            command: { type: "index-edit" },
          },
          token,
        )
      ).status,
      423,
    );
    const again = await f.create();
    assert.equal(
      again.id,
      s.id,
      "completed practice stays read-only until explicit restart",
    );
    const fresh = await f.student(
      `/practice-sessions/${s.id}/restart`,
      "POST",
      {},
    );
    assert.notEqual(fresh.body.session.id, s.id);
    assert.equal(
      f.app.db
        .prepare(
          "SELECT COUNT(*) AS n FROM practice_sessions WHERE status='completed'",
        )
        .get().n,
      1,
    );
  } finally {
    await f.app.close();
  }
});
test("analytics separate versions, include empty learners, preserve missing data and export only coded data", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s);
    const send = async (command) => {
      const r = (await f.student(`/practice-sessions/${s.id}`)).body.session;
      return f.student(
        `/practice-sessions/${s.id}/events`,
        "POST",
        { id: randomUUID(), revision: r.revision, source: "model", command },
        token,
      );
    };
    for (let i = 0; i < 2; i++)
      await send({ type: "daily-wipe", target: "R1-1" });
    await send({ type: "cover", target: "mainLid", value: true });
    await send({ type: "maintenance", target: "analyzer", value: true });
    await send({ type: "daily-wipe", target: "R1-1" });
    const a = await f.student("/analytics/me");
    assert.equal(a.status, 200);
    const step = a.body.steps.find((x) => x.step === "wipe/wipe-R1-1");
    assert.equal(step.errors, 2);
    assert.equal(step.corrections, 1);
    assert.equal(step.firstSuccessRate, 0);
    assert.equal(step.attemptedRounds, 1);
    assert.equal(step.errorLearnerRate, 1);
    const cohort = "snapshot-course";
    f.app.db
      .prepare("INSERT INTO cohorts VALUES(?,?,?)")
      .run(cohort, "Snapshot", f.now());
    for (const [version, score, start] of [
      ["legacy-a", 50, Date.parse("2026-11-10T16:00:00Z")],
      ["legacy-a", 75, Date.parse("2026-11-11T01:00:00Z")],
      ["legacy-b", 99, Date.parse("2026-11-11T02:00:00Z")],
    ]) {
      f.app.db
        .prepare(
          "INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,state,result,rubric,background_snapshot) VALUES(?,?,'daily',?,'submitted',?,?,'{}',?,'[]',?)",
        )
        .run(
          randomUUID(),
          f.id,
          version,
          start,
          start + 10000,
          JSON.stringify({ score, criticalRatio: 80, groups: [], errors: [] }),
          JSON.stringify({ cohortId: cohort, cohortName: "Snapshot" }),
        );
    }
    const report = (await f.admin("/admin/analytics")).body;
    assert.equal(report.learners.length, 2);
    assert.equal(
      report.learners.find((u) => u.id === f.otherId).practiceMs,
      null,
    );
    assert.equal(report.learners.find((u) => u.id === f.otherId).examMs, null);
    assert.equal(report.summary.participants, 1);
    assert.equal(report.gradeGroups.length, 2);
    assert.equal(
      report.comparisons.find((c) => c.version === "legacy-a").difference,
      25,
    );
    assert.equal(
      report.comparisons.find((c) => c.version === "legacy-b").difference,
      null,
    );
    assert.ok(
      report.sessions
        .filter((s) => s.mode === "exam")
        .every(
          (s) =>
            s.timing.activeMs === null && s.timing.quality === "unrecorded",
        ),
    );
    const filtered = (
      await f.admin(
        `/admin/analytics?cohort=${cohort}&from=2026-11-11&to=2026-11-11`,
      )
    ).body;
    assert.equal(filtered.sessions.length, 3);
    for (const table of ["learners", "sessions", "steps"]) {
      const csv = await f.admin(`/admin/analytics/export?table=${table}`);
      assert.equal(csv.status, 200);
      assert.ok(!csv.body.includes("metrics-student"));
      assert.ok(!csv.body.includes("Testing123"));
    }
    assert.equal(
      (await f.admin("/admin/analytics?from=2026-02-31")).status,
      400,
    );
  } finally {
    await f.app.close();
  }
});
test("thirty concurrent learners pulse and save without SQLite conflicts or per-pulse event growth", async () => {
  const f = await fixture(true);
  try {
    const seed = f.app.db.prepare("SELECT * FROM users WHERE id=?").get(f.id),
      profile = f.app.db
        .prepare("SELECT * FROM learner_profiles WHERE user_id=?")
        .get(f.id);
    const clients = [];
    for (let i = 0; i < 30; i++) {
      const id = randomUUID(),
        name = `load-${i}`;
      f.app.db
        .prepare(
          "INSERT INTO users(id,username,name,role,enabled,password,created_at,learner_code) VALUES(?,?,?,'learner',1,?,?,?)",
        )
        .run(id, name, name, seed.password, f.now(), `LOAD-${i}`);
      f.app.db
        .prepare("INSERT INTO learner_profiles VALUES(?,?,?,?)")
        .run(id, profile.version, profile.data, f.now());
      const c = f.client();
      assert.equal(
        (
          await c("/auth/login", "POST", {
            username: name,
            password: "Testing123!",
          })
        ).status,
        200,
      );
      clients.push(c);
    }
    const before = process.memoryUsage().rss,
      cpuBefore = process.cpuUsage(),
      bytes = () =>
        f.app.db.prepare("PRAGMA page_count").get().page_count *
        f.app.db.prepare("PRAGMA page_size").get().page_size,
      diskBefore = bytes(),
      start = performance.now();
    const active = await Promise.all(
      clients.map(async (c) => {
        const s = (await c("/practice-sessions", "POST", { kind: "daily" }))
          .body.session;
        const token = (
          await c("/training/lease", "POST", {
            mode: "practice",
            sessionId: s.id,
            viewId: randomUUID(),
          })
        ).body.token;
        return { c, s, token };
      }),
    );
    for (let sequence = 1; sequence <= 4; sequence++) {
      f.tick(15000);
      const results = await Promise.all(
        active.map(({ c, s, token }) =>
          c(
            "/training/activity",
            "POST",
            {
              mode: "practice",
              sessionId: s.id,
              sequence,
              visible: true,
              lastActivityAgeMs: 0,
            },
            token,
          ),
        ),
      );
      assert.ok(results.every((r) => r.status === 200));
    }
    const result = await Promise.all(
      active.map(({ c, s, token }) =>
        c(
          `/practice-sessions/${s.id}/events`,
          "POST",
          {
            id: randomUUID(),
            revision: 0,
            source: "model",
            command: { type: "index-edit" },
          },
          token,
        ),
      ),
    );
    assert.ok(result.every((r) => r.status === 200));
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM practice_events").get().n,
      30,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM training_activity").get().n,
      30,
    );
    const cpu = process.cpuUsage(cpuBefore);
    assert.ok(
      bytes() - diskBefore < 5 * 1024 * 1024,
      "small batch must not create per-activity storage",
    );
    console.log(
      `SQLite logical growth ${bytes() - diskBefore} bytes; CPU ${Math.round((cpu.user + cpu.system) / 1000)} ms`,
    );
    console.log(
      `30 learners: ${Math.round(performance.now() - start)} ms; RSS growth ${Math.round((process.memoryUsage().rss - before) / 1048576)} MB; 30 aggregate activity rows for 120 pulses`,
    );
  } finally {
    await f.app.close();
  }
});

test("expired leases rotate safely, stale release cannot revoke a fresh lease, and logout preserves both tasks", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      old = await f.lease(s);
    f.tick(46000);
    const expired = await f.student(
      `/practice-sessions/${s.id}/events`,
      "POST",
      {
        id: randomUUID(),
        revision: 0,
        source: "model",
        command: { type: "index-edit" },
      },
      old,
    );
    assert.equal(expired.status, 423);
    assert.equal(expired.body.reason, "lease_expired");
    const token = await f.lease(s);
    assert.notEqual(token, old);
    const stale = await f.student(
      "/training/activity",
      "POST",
      {
        mode: "practice",
        sessionId: s.id,
        sequence: 100,
        visible: false,
        lastActivityAgeMs: 0,
        release: true,
      },
      old,
    );
    assert.equal(stale.status, 423);
    assert.equal(stale.body.reason, "lease_conflict");
    assert.equal(
      f.app.db.prepare("SELECT token FROM training_leases").get().token,
      token,
    );
    const result = await f.student(
      `/practice-sessions/${s.id}/events`,
      "POST",
      {
        id: randomUUID(),
        revision: 0,
        source: "model",
        command: { type: "index-edit" },
      },
      token,
    );
    assert.equal(result.status, 200);
    const t = await f.create("troubleshooting"),
      tt = await f.lease(t);
    const qc = await f.student(
      `/practice-sessions/${t.id}/events`,
      "POST",
      {
        id: randomUUID(),
        revision: 0,
        source: "model",
        command: {
          type: "troubleshooting",
          data: { action: "factor", target: "standard", value: 1 },
        },
      },
      tt,
    );
    assert.equal(qc.status, 200);
    const stored = {
      ...f.app.db
        .prepare("SELECT state FROM practice_sessions WHERE id=?")
        .get(t.id),
    };
    await f.student("/auth/logout", "POST", {});
    assert.equal((await f.student(`/practice-sessions/${t.id}`)).status, 401);
    await f.student("/auth/login", "POST", {
      username: "metrics-student",
      password: "Testing123!",
    });
    const resumed = (await f.student("/practice-sessions/active")).body
      .sessions;
    assert.equal(resumed.length, 2);
    assert.equal(resumed.find((x) => x.id === s.id).revision, 1);
    assert.deepEqual(
      {
        ...f.app.db
          .prepare("SELECT state FROM practice_sessions WHERE id=?")
          .get(t.id),
      },
      stored,
    );
  } finally {
    await f.app.close();
  }
});

test("analytics respects disabled and transferred learners, and unknown legacy step analysis stays missing", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s);
    await f.student(
      `/practice-sessions/${s.id}/events`,
      "POST",
      {
        id: randomUUID(),
        revision: 0,
        source: "model",
        command: { type: "index-edit" },
      },
      token,
    );
    const snapshot = { cohortId: "old-class", cohortName: "Old" };
    f.app.db
      .prepare("UPDATE practice_sessions SET background_snapshot=? WHERE id=?")
      .run(JSON.stringify(snapshot), s.id);
    f.app.db
      .prepare(
        "INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,state,result,rubric,background_snapshot) VALUES(?,?,'daily','legacy','submitted',1,2,'{}',?,'[]',?)",
      )
      .run(
        "legacy",
        f.id,
        JSON.stringify({
          score: 10,
          errors: ["Retained legacy error"],
          groups: [
            {
              id: "temp",
              items: [{ id: "temp", label: "Old step", completed: false }],
            },
          ],
        }),
        JSON.stringify(snapshot),
      );
    f.app.db.prepare("UPDATE users SET enabled=0 WHERE id=?").run(f.id);
    const r = await f.admin("/admin/analytics?cohort=old-class");
    assert.equal(r.status, 200);
    assert.equal(r.body.summary.participants, 1);
    assert.equal(r.body.learners[0].enabled, false);
    assert.equal(r.body.sessions.length, 2);
    assert.equal(r.body.summary.examMs, null);
    assert.equal(r.body.sessions.find((x) => x.id === "legacy").errors, 1);
    assert.equal(r.body.summary.unknownErrors, 1);
    const old = r.body.steps.find((x) => x.version === "legacy");
    assert.equal(old.errors, null);
    assert.equal(old.corrections, null);
    assert.equal(old.unrecordedRounds, 1);
    assert.equal(old.firstSuccessRate, null);
    assert.equal(old.unfinished, 1);
    assert.equal((await f.other(`/practice-sessions/${s.id}`)).status, 404);
    assert.equal(
      (await f.other("/admin/analytics/export?table=steps")).status,
      403,
    );
    assert.equal((await f.other(`/analytics/me?user=${f.id}`)).status, 403);
  } finally {
    await f.app.close();
  }
});

test("tracked exams share timing and lease protection while submit retries preserve another task's lease", async () => {
  const f = await fixture();
  try {
    const a = (await f.student("/attempts", "POST", { kind: "daily" })).body
      .attempt;
    assert.equal(a.timing.activeMs, null);
    f.tick(5000); // Initial UI loading does not make a new tracked exam partial.
    const token = (
      await f.student("/training/lease", "POST", {
        mode: "exam",
        sessionId: a.id,
        viewId: "exam-window",
      })
    ).body.token;
    const pulse = (sequence, release = false) =>
      f.student(
        "/training/activity",
        "POST",
        {
          mode: "exam",
          sessionId: a.id,
          sequence,
          visible: !release,
          lastActivityAgeMs: 0,
          release,
        },
        token,
      );
    await pulse(1);
    assert.equal(
      (await f.student(`/attempts/${a.id}`)).body.attempt.timing.quality,
      "complete",
    );
    f.tick(15000);
    await pulse(2, true);
    assert.equal(
      (await f.student(`/attempts/${a.id}`)).body.attempt.timing.activeMs,
      15000,
    );
    const body = {
      id: randomUUID(),
      revision: 0,
      source: "workstation",
      command: { type: "index-edit" },
    };
    assert.equal(
      (await f.student(`/attempts/${a.id}/events`, "POST", body)).status,
      423,
      "tracked exam cannot resume without a lease",
    );
    const newToken = (
      await f.student("/training/lease", "POST", {
        mode: "exam",
        sessionId: a.id,
        viewId: "exam-window",
      })
    ).body.token;
    assert.equal(
      (await f.student(`/attempts/${a.id}/events`, "POST", body, newToken))
        .status,
      200,
    );
    const submitted = await f.student(
      `/attempts/${a.id}/submit`,
      "POST",
      { revision: 1 },
      newToken,
    );
    assert.equal(submitted.status, 200);
    assert.equal(
      (await f.student(`/attempts/${a.id}/events`, "POST", body, newToken))
        .status,
      200,
      "lost event acknowledgement remains idempotent after completion",
    );
    const practice = await f.create(),
      practiceToken = await f.lease(practice);
    const retry = await f.student(
      `/attempts/${a.id}/submit`,
      "POST",
      { revision: 1 },
      newToken,
    );
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body.attempt.result, submitted.body.attempt.result);
    assert.equal(
      f.app.db.prepare("SELECT token FROM training_leases").get().token,
      practiceToken,
    );
    const report = (await f.student("/analytics/me")).body;
    assert.equal(report.summary.examMs, 15000);
    assert.equal(report.summary.practiceMs, 0);
  } finally {
    await f.app.close();
  }
});

test("v4 backup and restore retain practice state, diagnostic events and aggregate activity", async () => {
  const f = await fixture(true);
  try {
    const s = await f.create(),
      token = await f.lease(s);
    const body = {
      id: randomUUID(),
      revision: 0,
      source: "model",
      command: { type: "index-edit" },
    };
    await f.student(`/practice-sessions/${s.id}/events`, "POST", body, token);
    await f.student(
      "/training/activity",
      "POST",
      {
        mode: "practice",
        sessionId: s.id,
        sequence: 1,
        visible: true,
        lastActivityAgeMs: 0,
      },
      token,
    );
    f.tick(15000);
    await f.student(
      "/training/activity",
      "POST",
      {
        mode: "practice",
        sessionId: s.id,
        sequence: 2,
        visible: false,
        lastActivityAgeMs: 15000,
        release: true,
      },
      token,
    );
    const path = f.app.db.prepare("PRAGMA database_list").get().file;
    const backup = consistentBackup(f.app.db, path),
      restored = join(
        mkdtempSync(join(tmpdir(), "restore-v4-")),
        "copy.sqlite",
      );
    const cli = spawnSync(
      process.execPath,
      ["scripts/database-restore.mjs", backup, restored],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(cli.status, 0, cli.stderr);
    const db = new DatabaseSync(restored, { readOnly: true });
    try {
      assert.equal(db.prepare("PRAGMA user_version").get().user_version, 4);
      for (const table of [
        "practice_sessions",
        "practice_events",
        "training_activity",
      ]) {
        assert.deepEqual(
          db
            .prepare(`SELECT * FROM ${table}`)
            .all()
            .map((r) => ({ ...r })),
          f.app.db
            .prepare(`SELECT * FROM ${table}`)
            .all()
            .map((r) => ({ ...r })),
        );
      }
      assert.equal(
        db.prepare("SELECT active_ms FROM training_activity").get().active_ms,
        15000,
      );
    } finally {
      db.close();
    }
  } finally {
    await f.app.close();
  }
});

test("Taipei start-date filters include the full accumulated interval when activity crosses midnight", async () => {
  const f = await fixture();
  try {
    f.tick(Date.parse("2026-11-11T15:59:50Z") - f.now());
    const s = await f.create(),
      token = await f.lease(s);
    const pulse = (sequence) =>
      f.student(
        "/training/activity",
        "POST",
        {
          mode: "practice",
          sessionId: s.id,
          sequence,
          visible: true,
          lastActivityAgeMs: 0,
        },
        token,
      );
    await pulse(1);
    f.tick(15000);
    await pulse(2);
    const yesterday = (
      await f.admin("/admin/analytics?from=2026-11-11&to=2026-11-11")
    ).body;
    assert.equal(yesterday.sessions.length, 1);
    assert.equal(yesterday.summary.practiceMs, 15000);
    assert.equal(
      (await f.admin("/admin/analytics?from=2026-11-12&to=2026-11-12")).body
        .sessions.length,
      0,
    );
  } finally {
    await f.app.close();
  }
});

test("practice retains abnormal findings across resume and counts their later correction separately", async () => {
  const f = await fixture();
  try {
    const s = await f.create(),
      token = await f.lease(s);
    let revision = 0;
    const send = (command) =>
      f.student(
        `/practice-sessions/${s.id}/events`,
        "POST",
        {
          id: randomUUID(),
          revision: revision++,
          source: "workstation",
          command,
        },
        token,
      );
    await send({ type: "cover", target: "frontSyringe", value: true });
    const target = "R2-2";
    const finding = {
      type: "daily-syringe",
      target,
      value: "異常",
      data: { finding: "moisture" },
    };
    const abnormal = await send(finding);
    assert.equal(abnormal.status, 200);
    assert.equal(
      abnormal.body.session.sim.dailyTasks.syringes[target].moisture,
      "異常",
    );
    assert.equal(
      (await f.create()).sim.dailyTasks.syringes[target].moisture,
      "異常",
    );
    const corrected = await send({ ...finding, value: "正常" });
    assert.equal(corrected.status, 200);
    const step = (await f.student("/analytics/me")).body.steps.find(
      (x) => x.step === `syringes/syringe-${target}-moisture`,
    );
    assert.equal(step.errors, 1);
    assert.equal(step.corrections, 1);
    assert.equal(step.firstSuccessRate, 0);
  } finally {
    await f.app.close();
  }
});

test("QC simulation waits are observed separately, cap at deadlines, and seal on restart without rewriting old scores", async () => {
  const f = await fixture();
  try {
    const s = await f.create("troubleshooting"),
      token = await f.lease(s);
    let revision = 0;
    const send = (data) =>
      f.student(
        `/practice-sessions/${s.id}/events`,
        "POST",
        {
          id: randomUUID(),
          revision: revision++,
          source: "workstation",
          command: { type: "troubleshooting", data },
        },
        token,
      );
    const pulse = (sequence, visible = true) =>
      f.student(
        "/training/activity",
        "POST",
        {
          mode: "practice",
          sessionId: s.id,
          sequence,
          visible,
          lastActivityAgeMs: 0,
        },
        token,
      );
    await pulse(1);
    const bad = await send({ action: "upload" });
    assert.equal(bad.body.applied, false);
    const state = JSON.parse(
      f.app.db
        .prepare("SELECT state FROM practice_sessions WHERE id=?")
        .get(s.id).state,
    );
    state.sim.troubleshooting.trace = ["P01", "P02"];
    state.sim.troubleshooting.report = {
      file: "UIBC_回溯報告.pdf",
      status: "pending",
    };
    f.app.db
      .prepare("UPDATE practice_sessions SET state=? WHERE id=?")
      .run(JSON.stringify(state), s.id);
    const launched = await send({ action: "upload" });
    assert.equal(launched.body.applied, true);
    let report = (await f.student("/analytics/me")).body,
      step = report.steps.find((x) => x.step === "uibc-8/uibc-8-2");
    assert.equal(step.attemptedRounds, 1);
    assert.equal(step.firstSuccessRate, 0);
    assert.equal(step.errors, 1);
    assert.equal(step.corrections, 1);
    assert.equal(step.unfinished, 1);
    f.tick(200);
    let result = await f.student(
      `/practice-sessions/${s.id}/poll`,
      "POST",
      {},
      token,
    );
    assert.equal(result.body.session.timing.simulationWaitMs, 200);
    f.tick(300);
    await pulse(2);
    await pulse(2);
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .simulationWaitMs,
      500,
    );
    f.tick(300);
    result = await f.student(
      `/practice-sessions/${s.id}/poll`,
      "POST",
      {},
      token,
    );
    assert.equal(result.body.session.timing.simulationWaitMs, 650);
    report = (await f.student("/analytics/me")).body;
    assert.equal(report.sessions[0].waitingMs, 650);
    assert.equal(
      report.steps.find((x) => x.step === "uibc-8/uibc-8-2").unfinished,
      0,
    );
    const again = JSON.parse(
      f.app.db
        .prepare("SELECT state FROM practice_sessions WHERE id=?")
        .get(s.id).state,
    );
    again.sim.troubleshooting.report.status = "pending";
    f.app.db
      .prepare("UPDATE practice_sessions SET state=? WHERE id=?")
      .run(JSON.stringify(again), s.id);
    await send({ action: "upload" });
    f.tick(200);
    const restarted = await f.student(
      `/practice-sessions/${s.id}/restart`,
      "POST",
      {},
      token,
    );
    assert.equal(restarted.status, 200);
    f.tick(5000);
    assert.equal(
      (await f.student(`/practice-sessions/${s.id}`)).body.session.timing
        .simulationWaitMs,
      850,
    );
    assert.equal(restarted.body.session.timing.simulationWaitMs, 0);
    const legacy = JSON.parse(JSON.stringify(state));
    delete legacy.trainingWait;
    const frozen = JSON.stringify({
      score: 80,
      criticalRatio: 50,
      groups: [],
      errors: [],
      waitingMs: 0,
      skippedMs: 0,
    });
    f.app.db
      .prepare(
        "INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,state,result,rubric) VALUES('old-qc',?,'troubleshooting',?,'submitted',1,2,?,?,'[]')",
      )
      .run(f.id, s.version, JSON.stringify(legacy), frozen);
    assert.equal(
      (await f.student("/analytics/me")).body.sessions.find(
        (x) => x.id === "old-qc",
      ).waitingMs,
      null,
    );
    assert.equal(
      f.app.db.prepare("SELECT result FROM attempts WHERE id='old-qc'").get()
        .result,
      frozen,
    );
  } finally {
    await f.app.close();
  }
});
