import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  initialEngine,
  applyCommand,
  scoreAttempt,
  examPreparationGate,
  dailyRegistrationNeeds,
  supportsVersion,
} from "../shared/exam.ts";
import {
  currentDailyVersion as v7,
  legacyDailyV6 as v6,
} from "../shared/dailyScenario.ts";
import { diagnoseEvent, analysisVersionFor } from "../shared/training.ts";
import { preparationProgress } from "../shared/preparation.ts";
import { preparationRequirements } from "../shared/materialCatalog.ts";
import { complete } from "./daily-fixture.mjs";
import { createApplication } from "./index.mjs";
import { seedAccount } from "./account-fixture.mjs";

function round(state = initialEngine(v7), version = v7) {
  const events = [];
  let now = Date.now();
  return {
    get state() {
      return state;
    },
    events,
    run(type, target, value, data) {
      const command = { type, target, value, data },
        before = state;
      const out = applyCommand(before, "daily", command, ++now, version);
      state = out.state;
      events.push({
        id: randomUUID(),
        at: now,
        source: "model",
        command,
        accepted: out.accepted,
        error: out.error,
        label: out.label,
        diagnostic: diagnoseEvent("daily", before, command, out, version),
      });
      return out;
    },
    prep(data) {
      return this.run("preparation", undefined, undefined, data);
    },
    score() {
      return scoreAttempt(
        "daily",
        state,
        events,
        now - events.length,
        now,
        version,
      );
    },
  };
}
function ok(out) {
  assert.equal(out.accepted, true, out.error);
  assert.equal(out.error, "");
  return out;
}
function fill(x, rows = preparationRequirements) {
  for (const req of rows) {
    const index = preparationRequirements.indexOf(req);
    const target = `cup-${index + 1}`;
    ok(x.prep({ action: "select", target: `source:${req.materialId}` }));
    ok(x.prep({ action: "aspirate" }));
    for (let n = 0; n < (req.materialId.startsWith("ae-") ? 2 : 1); n++)
      ok(x.prep({ action: "dispense", target }));
    ok(
      x.prep({
        action: "place",
        target,
        rack: req.rack,
        slot: (index % 10) + 1,
      }),
    );
  }
}
function push(x, rack, clean = true) {
  ok(x.prep({ action: "stage", rack }));
  const out = x.prep({ action: "push", rack });
  if (clean) ok(out);
  else assert.equal(out.accepted, true);
  return out;
}
function entry(x, omitRb = [], omitCal = []) {
  const needs = dailyRegistrationNeeds(x.state);
  return x.run("rack", "Serum", undefined, {
    category: "calibration",
    selection: {
      rb: needs.rb.filter((id) => !omitRb.includes(id)),
      cal: needs.cal.filter((id) => !omitCal.includes(id)),
      qc: [],
      sample: [],
    },
  });
}
const check = (x, group, id) =>
  x
    .score()
    .groups.find((g) => g.id === group)
    .items.find((i) => i.id === id);

test("v7 separates operation permission from assessment; practice and v6 keep strict entry and physical gates", () => {
  const x = round();
  assert.equal(examPreparationGate(x.state, v7).ready, false);
  assert.equal(examPreparationGate(x.state, v7).canOperate, true);
  ok(
    entry(
      x,
      dailyRegistrationNeeds(x.state).rb,
      dailyRegistrationNeeds(x.state).cal,
    ),
  );
  ok(
    x.run("rack-qc-entry", undefined, undefined, {
      Serum: ["3.ALT"],
      Urine: ["9.CRE"],
    }),
  );
  assert.equal(check(x, "rack", "calEntry").completed, false);
  assert.equal(x.prep({ action: "stage", rack: "RB" }).accepted, false);
  assert.equal(x.run("daily-mode", undefined, "inspect").accepted, false);
  assert.equal(x.prep({ action: "push", rack: "RB" }).accepted, false);
  assert.equal(x.state.dailyLoads, undefined);
  for (const strict of [
    round(initialEngine(v7, "practice")),
    round(initialEngine(v6), v6),
  ]) {
    assert.ok(entry(strict).error);
    ok(strict.prep({ action: "select", target: "source:water" }));
    assert.equal(strict.prep({ action: "aspirate" }).accepted, false);
    assert.equal(!!strict.state.sim.calibrationEntered, false);
  }
  assert.equal(supportsVersion("daily", v6), true);
  assert.equal(analysisVersionFor("daily", v6), "training-v1");
  assert.equal(analysisVersionFor("daily", v7), "training-v2");
});

test("v7 early maintenance attempts are accepted sequence errors without valid completion evidence", () => {
  const x = round();
  ok(x.run("cover", "mainLid", true));
  ok(x.run("maintenance", "analyzer", true));
  const inspect = x.run("daily-mode", undefined, "inspect");
  assert.equal(inspect.accepted, true);
  assert.ok(inspect.error);
  assert.equal(x.events.at(-1).diagnostic.errorCode, "sequence");
  assert.equal(x.state.ledger.dailyInspectValid, false);
  assert.ok(x.run("daily-drain", "R1-1", "正常").error);
  assert.equal(x.events.at(-1).diagnostic.errorCode, "sequence");
  assert.equal(check(x, "inspect", "drain-R1-1").completed, false);
  ok(x.run("maintenance", "ise", true));
  assert.equal(x.run("prime").accepted, true);
  assert.equal(x.state.sim.prime, 0);
  assert.equal(x.events.at(-1).diagnostic.errorCode, "sequence");
  ok(x.run("maintenance", "ise", false));
  assert.ok(x.run("calibrate", "both").error);
  assert.equal(x.state.sim.cal.serum, false);
  assert.ok(x.run("cal-review").error);
  assert.equal(x.state.sim.cal.checked, false);
  assert.equal(x.events.at(-1).diagnostic.errorCode, "sequence");
});

test("v7 complete maintenance and sixteen samples keep thirteen equal groups and 100 points", () => {
  const x = round(complete("model", v7).state);
  assert.equal(x.score().score, 92.3);
  fill(x);
  for (const rack of ["RB", "CALI", "QC"]) {
    const out = push(x, rack);
    assert.deepEqual(out.loadAssessment.missingIds, []);
    assert.deepEqual(out.loadAssessment.missingRb, []);
    assert.deepEqual(out.loadAssessment.missingCali, []);
  }
  assert.equal(x.score().groups.length, 13);
  assert.equal(x.score().score, 100);
  assert.ok(x.score().groups.every((g) => g.proportion === 1));
});

test("v7 checks only on successful push; early incomplete entry and staging do not record omissions", () => {
  const x = round();
  ok(entry(x, ["3.ALT"], ["15.HDL"]));
  assert.equal(x.events.filter((e) => e.error).length, 0);
  fill(
    x,
    preparationRequirements.filter((r) => r.rack === "RB"),
  );
  ok(x.prep({ action: "stage", rack: "RB" }));
  assert.equal(x.state.dailyLoads, undefined);
  const before = x.events.filter((e) => e.error).length;
  const out = x.prep({ action: "push", rack: "RB" });
  assert.equal(out.accepted, true);
  assert.ok(out.error.includes("RB 未登記：3.ALT"));
  assert.ok(out.error.includes("CALI 未登記：15.HDL"));
  assert.equal(x.events.filter((e) => e.error).length, before + 1);
  assert.equal(x.state.sim.preparation.racks.RB.location, "loaded");
  assert.ok(x.state.dailyLoads.RB.missingIds.includes("temp/temp"));
  assert.ok(x.state.dailyLoads.RB.missingIds.includes("rack/calEntry"));
  const physical = x.events
    .at(-1)
    .diagnostic.stepResults.filter((s) => s.step.startsWith("preparation/"));
  assert.equal(physical.length, 1);
  assert.ok(physical.every((s) => s.success && !s.error));
  assert.equal(
    preparationProgress(
      x.state.sim.preparation,
      examPreparationGate(x.state, v7),
    ).completed,
    3,
  );
  assert.equal(x.prep({ action: "push", rack: "RB" }).accepted, false);
  assert.equal(x.state.dailyLoads.RB.at, out.loadAssessment.at);
});

test("v7 fixes made before the first push create no load omission", () => {
  const x = round();
  ok(entry(x, ["3.ALT"], []));
  fill(
    x,
    preparationRequirements.filter((r) => r.rack === "RB"),
  );
  ok(x.prep({ action: "stage", rack: "RB" }));
  const good = complete("model", v7).state;
  good.sim.preparation = structuredClone(x.state.sim.preparation);
  const resumed = round(good);
  const out = ok(resumed.prep({ action: "push", rack: "RB" }));
  assert.deepEqual(out.loadAssessment.missingIds, []);
});

test("v7 per-rack omissions survive repairs, retrieval, other rack pushes, reset and JSON restoration", () => {
  const seed = complete("model", v7).state;
  seed.sim.temp.saved = false;
  const x = round(seed);
  ok(entry(x, ["3.ALT"], ["15.HDL"]));
  fill(x);
  const first = push(x, "RB", false);
  push(x, "QC", false);
  assert.ok(first.loadAssessment.missingIds.includes("temp/temp"));
  assert.equal(check(x, "temp", "temp").completed, false);
  ok(x.run("temperature", undefined, undefined, { bath: "37", coolant: "8" }));
  ok(entry(x));
  assert.equal(examPreparationGate(x.state, v7).ready, true);
  assert.equal(check(x, "temp", "temp").completed, false);
  assert.equal(check(x, "rack", "calEntry").completed, false);
  assert.match(check(x, "rack", "calEntry").diagnosis.reason, /3.ALT/);
  push(x, "CALI");
  assert.equal(x.score().corrections, 0);
  ok(x.prep({ action: "retrieve", rack: "RB" }));
  assert.equal(check(x, "temp", "temp").completed, false);
  const repaired = push(x, "RB");
  assert.ok(repaired.correctedLoadSteps.includes("temp/temp"));
  assert.equal(x.score().corrections, 1);
  assert.equal(
    check(x, "temp", "temp").completed,
    false,
    "QC still has the omission",
  );
  ok(x.prep({ action: "retrieve", rack: "QC" }));
  push(x, "QC");
  assert.equal(x.score().corrections, 2);
  assert.equal(x.score().score, 100);
  assert.equal(x.score().errors.length, 2, "original errors remain in history");
  assert.ok(
    !x
      .score()
      .groups.flatMap((g) => g.items)
      .some((i) => i.diagnosis?.status === "上機缺失待補正"),
  );
  const restored = round(JSON.parse(JSON.stringify(x.state)));
  assert.equal(restored.score().score, 100);
  restored.state.dailyLoads.RB = first.loadAssessment;
  ok(restored.prep({ action: "reset" }));
  assert.equal(check(restored, "temp", "temp").completed, false);
  assert.ok(restored.state.dailyLoads.RB.missingIds.includes("temp/temp"));
});

test("v7 partial repair uses raw evidence and records correction even when other omissions remain", () => {
  const seed = complete("model", v7).state;
  seed.sim.temp.saved = false;
  const x = round(seed);
  ok(entry(x, ["3.ALT"], []));
  fill(
    x,
    preparationRequirements.filter((r) => r.rack === "RB"),
  );
  push(x, "RB", false);
  ok(x.run("temperature", undefined, undefined, { bath: "37", coolant: "8" }));
  ok(x.prep({ action: "retrieve", rack: "RB" }));
  const partial = push(x, "RB", false);
  assert.deepEqual(partial.correctedLoadSteps, ["temp/temp"]);
  assert.equal(check(x, "temp", "temp").completed, true);
  assert.equal(check(x, "rack", "calEntry").completed, false);
  assert.equal(x.score().corrections, 1);
  ok(entry(x));
  ok(x.prep({ action: "retrieve", rack: "RB" }));
  push(x, "RB");
  assert.equal(check(x, "rack", "calEntry").completed, true);
  assert.equal(x.score().corrections, 2);
});

test("v7 valid actions repair sequence errors without repairing a pending load checkpoint", () => {
  const seed = complete("model", v7).state;
  seed.sim.cal = { serum: false, urine: false, checked: false };
  const x = round(seed);
  assert.ok(x.run("cal-review").error);
  fill(
    x,
    preparationRequirements.filter((r) => r.rack === "RB"),
  );
  push(x, "RB", false);
  ok(x.run("maintenance", "ise", false));
  ok(x.run("calibrate", "both"));
  ok(x.run("cal-review"));
  assert.ok(x.events.at(-1).diagnostic.steps.includes("cal/calReview"));
  assert.equal(x.events.at(-1).diagnostic.success, true);
  assert.equal(x.score().corrections, 1);
  assert.equal(check(x, "cal", "calReview").completed, false);
  ok(x.prep({ action: "retrieve", rack: "RB" }));
  const out = push(x, "RB");
  assert.match(out.label, /上機缺失補正/);
  assert.equal(check(x, "cal", "calReview").completed, true);
  assert.equal(x.score().corrections, 2);
});

test("v7 API owns policy and snapshots; retries, leases, resume, final report, analytics and CSV agree", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  const learnerId = await seedAccount(app.db, "v7-student", "learner");
  await seedAccount(app.db, "v7-other", "learner");
  await seedAccount(app.db, "v7-admin");
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const client = () => {
    let cookie = "";
    return async (path, method = "GET", body, token) => {
      const res = await fetch(base + path, {
        method,
        headers: {
          cookie,
          "Content-Type": "application/json",
          ...(token ? { "X-Training-Lease": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      return {
        status: res.status,
        body: res.headers.get("content-type")?.includes("json")
          ? await res.json()
          : await res.text(),
      };
    };
  };
  const student = client(),
    admin = client(),
    other = client();
  try {
    for (const [c, username] of [
      [student, "v7-student"],
      [admin, "v7-admin"],
      [other, "v7-other"],
    ])
      assert.equal(
        (await c("/auth/login", "POST", { username, password: "Testing123!" }))
          .status,
        200,
      );
    const start = await student("/attempts", "POST", {
      kind: "daily",
      dailyPolicy: "practice",
      dailyLoads: { RB: {} },
    });
    let attempt = start.body.attempt;
    const id = attempt.id;
    const stored = () =>
      JSON.parse(
        app.db.prepare("SELECT state FROM attempts WHERE id=?").get(id).state,
      );
    assert.equal(stored().dailyPolicy, "exam");
    assert.equal(stored().dailyLoads, undefined);
    const lease = await student("/training/lease", "POST", {
      mode: "exam",
      sessionId: id,
      viewId: "v7-api-view",
    });
    const token = lease.body.token;
    async function event(command, extras = {}) {
      const body = {
        id: randomUUID(),
        revision: attempt.revision,
        source: "model",
        command,
        ...extras,
      };
      const res = await student(`/attempts/${id}/events`, "POST", body, token);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      attempt = res.body.attempt;
      return { ...res, request: body };
    }
    const denied = await student(`/attempts/${id}/events`, "POST", {
      id: randomUUID(),
      revision: 0,
      source: "model",
      command: { type: "cal-review" },
    });
    assert.equal(denied.status, 423);
    const early = await event({ type: "cal-review", dailyPolicy: "practice" });
    assert.equal(early.body.applied, true);
    assert.equal(early.body.attempt.sim.cal.checked, false);
    assert.ok(!JSON.stringify(early.body).includes("校正完成前確認結果"));
    const replay = await student(
      `/attempts/${id}/events`,
      "POST",
      early.request,
      token,
    );
    assert.equal(replay.body.applied, true);
    assert.equal(replay.body.attempt.revision, attempt.revision);
    // Seed a valid first-twelve baseline to focus the API on push/checkpoint behavior.
    const seed = complete("model", v7).state;
    seed.sim.temp.saved = false;
    app.db
      .prepare("UPDATE attempts SET state=? WHERE id=?")
      .run(JSON.stringify(seed), id);
    const x = round(seed);
    fill(
      x,
      preparationRequirements.filter((r) => r.rack === "RB"),
    );
    for (const e of x.events) await event(e.command);
    await event({ type: "preparation", data: { action: "stage", rack: "RB" } });
    const pushed = await event({
      type: "preparation",
      data: { action: "push", rack: "RB", dailyLoads: {}, ready: true },
    });
    assert.equal(pushed.body.applied, true);
    assert.equal(attempt.sim.preparation.racks.RB.location, "loaded");
    assert.ok(stored().dailyLoads.RB.missingIds.includes("temp/temp"));
    const at = stored().dailyLoads.RB.at;
    const repeated = await student(
      `/attempts/${id}/events`,
      "POST",
      pushed.request,
      token,
    );
    assert.equal(repeated.body.attempt.revision, attempt.revision);
    assert.equal(stored().dailyLoads.RB.at, at);
    assert.equal((await other(`/attempts/${id}`)).status, 404);
    const resumed = await student(`/attempts/${id}`);
    assert.equal(resumed.body.attempt.preparationAccess.canOperate, true);
    assert.equal(
      resumed.body.attempt.sim.preparation.racks.RB.location,
      "loaded",
    );
    await event({ type: "temperature", data: { bath: "37", coolant: "8" } });
    // Current evidence is fixed, but pushing a different rack cannot repair RB.
    const interim = scoreAttempt("daily", stored(), [], 0, Date.now(), v7);
    assert.equal(
      interim.groups.find((g) => g.id === "temp").items[0].completed,
      false,
    );
    await event({
      type: "preparation",
      data: { action: "retrieve", rack: "RB" },
    });
    await event({ type: "preparation", data: { action: "stage", rack: "RB" } });
    await event({ type: "preparation", data: { action: "push", rack: "RB" } });
    assert.deepEqual(stored().dailyLoads.RB.missingIds, []);
    const submitted = await student(
      `/attempts/${id}/submit`,
      "POST",
      { revision: attempt.revision },
      token,
    );
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const result = submitted.body.attempt.result;
    assert.equal(result.errors.length, 2);
    assert.equal(result.corrections, 1);
    assert.equal(
      result.groups.find((g) => g.id === "temp").items[0].completed,
      true,
    );
    const report = (
      await admin(`/admin/analytics?user=${learnerId}&version=${v7}`)
    ).body;
    assert.equal(
      report.sessions.find((s) => s.id === id).corrections,
      result.corrections,
    );
    const physical = report.steps.filter(
      (s) => s.step.startsWith("preparation/") && s.attemptedRounds > 0,
    );
    assert.equal(physical.length, 3);
    assert.ok(physical.every((s) => s.errors === 0));
    const csv = await admin(
      `/admin/analytics/export?table=steps&user=${learnerId}&version=${v7}`,
    );
    assert.equal(csv.status, 200);
    assert.ok(csv.body.includes("training-v2"));
    assert.ok(csv.body.includes("temp/temp"));
    assert.ok(!csv.body.includes("v7-student"));
    const temp = report.steps.find((s) => s.step === "temp/temp");
    assert.equal(temp.firstSuccessRate, 0);
    assert.equal(temp.errors, 1);
    assert.equal(temp.corrections, 1);
    assert.equal(temp.unfinished, 0);
    const tempCsv = csv.body
      .split("\r\n")
      .find((line) => line.includes('"temp/temp"'));
    assert.deepEqual(tempCsv.split(",").slice(8, 13), [
      '"3"',
      '"0"',
      '"1"',
      '"1"',
      '"1"',
    ]);
    assert.equal(
      (
        await student("/practice-sessions", "POST", {
          kind: "daily",
          dailyPolicy: "exam",
        })
      ).status,
      400,
    );
    const practice = await student("/practice-sessions", "POST", {
      kind: "daily",
    });
    assert.equal(practice.status, 200, JSON.stringify(practice.body));
    const practiceState = JSON.parse(
      app.db
        .prepare("SELECT state FROM practice_sessions WHERE id=?")
        .get(practice.body.session.id).state,
    );
    assert.equal(practiceState.dailyPolicy, "practice");
    assert.equal(practice.body.session.preparationAccess.canOperate, undefined);
    // Existing in-progress v6 records continue their original applied/error rules.
    const legacyStart = await student("/attempts", "POST", { kind: "daily" });
    const legacyId = legacyStart.body.attempt.id;
    app.db
      .prepare("UPDATE attempts SET version=?,state=? WHERE id=?")
      .run(v6, JSON.stringify(initialEngine(v6)), legacyId);
    const oldLease = await student("/training/lease", "POST", {
      mode: "exam",
      sessionId: legacyId,
      viewId: "legacy-api-view",
    });
    const oldEvent = {
      id: randomUUID(),
      revision: 0,
      source: "model",
      command: { type: "cal-review" },
    };
    for (let n = 0; n < 2; n++) {
      const oldReply = await student(
        `/attempts/${legacyId}/events`,
        "POST",
        oldEvent,
        oldLease.body.token,
      );
      assert.equal(oldReply.status, 200);
      assert.equal(oldReply.body.applied, false);
      assert.equal(oldReply.body.attempt.version, v6);
      assert.equal(oldReply.body.attempt.revision, 1);
      assert.equal(
        oldReply.body.attempt.preparationAccess.canOperate,
        undefined,
      );
    }
    assert.equal(
      app.db
        .prepare("SELECT count(*) AS n FROM events WHERE attempt_id=?")
        .get(legacyId).n,
      1,
    );
  } finally {
    await app.close();
  }
});
