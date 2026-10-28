import {
  legacyDailyV4,
  legacyWeeklyV2,
  currentWeeklyVersion,
} from "../shared/dailyScenario.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "./index.mjs";
import {
  initialEngine,
  applyCommand,
  advanceEngine,
  scoreAttempt,
  rubricVersion,
  dailyRubricVersion,
  previousDailyRubricVersion,
} from "../shared/exam.ts";
import {
  dailyProbes,
  detailedProbes,
  mixerIds,
  wellIds,
  syringeIds,
  w2Positions,
} from "../shared/maintenance.ts";
import { initialBottles } from "../src/detergents.ts";

function simulation(
  kind,
  version = kind === "daily" ? previousDailyRubricVersion : rubricVersion,
) {
  let state = initialEngine(version),
    time = 10000,
    events = [];
  return {
    command(command) {
      time += 50;
      const out = applyCommand(state, kind, command, time, version);
      state = out.state;
      events.push({
        id: String(events.length),
        at: time,
        source: "model",
        command,
        accepted: out.accepted,
        label: out.label,
        error: out.error,
      });
      return out;
    },
    wait(ms) {
      time += ms;
      state = advanceEngine(state, time);
    },
    score() {
      return scoreAttempt(kind, state, events, 10000, time, version);
    },
    get state() {
      return state;
    },
    get events() {
      return events;
    },
    get time() {
      return time;
    },
  };
}
const find = (result, id) =>
  result.groups.flatMap((g) => g.items).find((x) => x.id === id);
const c = (x, type, target, value, data) =>
  x.command({
    type,
    ...(target === undefined ? {} : { target }),
    ...(value === undefined ? {} : { value }),
    ...(data === undefined ? {} : { data }),
  });
function open(x) {
  c(x, "maintenance", undefined, true);
  c(x, "lid", undefined, true);
}

test("weekly probe omissions are independent; locked removal is blocked; later correction retains errors", () => {
  const x = simulation("weekly");
  open(x);
  assert.equal(c(x, "probe", "Sample-1", "remove").accepted, false);
  for (const op of ["unlock", "drain", "remove", "wipe", "install", "lock"])
    c(x, "probe", "Sample-1", op);
  let r = x.score();
  assert.equal(find(r, "Sample-1-wipe").completed, true);
  assert.equal(find(r, "Sample-1-wire").completed, false);
  assert.equal(find(r, "Sample-1-lock").completed, true);
  assert.equal(find(r, "Sample-2-install").completed, false);
  for (const op of ["unlock", "drain", "remove", "wire", "install"])
    c(x, "probe", "Sample-1", op);
  r = x.score();
  assert.equal(find(r, "Sample-1-wipe").completed, false);
  assert.equal(find(r, "Sample-1-wire").completed, true);
  assert.equal(find(r, "Sample-1-lock").completed, false);
  for (const op of [
    "unlock",
    "drain",
    "remove",
    "wipe",
    "wire",
    "install",
    "lock",
  ])
    c(x, "probe", "Sample-1", op);
  r = x.score();
  assert.equal(find(r, "Sample-1-wipe").completed, true);
  assert.equal(find(r, "Sample-1-wire").completed, true);
  assert.ok(r.errors.length >= 3);
  assert.ok(r.corrections > 0);
});
test("daily skips are executable; prime before cleaning is recorded without a teaching gate", () => {
  const x = simulation("daily");
  c(x, "maintenance", undefined, true);
  const out = c(x, "prime");
  assert.equal(out.accepted, true);
  assert.equal(x.state.sim.prime, 0);
  assert.match(out.error, /Cleaning/);
  c(x, "index-edit");
  c(x, "index");
  assert.ok(x.state.sim.index);
  assert.match(x.events.at(-1).error, /溫度/);
});
test("untouched weekly setup is not credited as restoration", () => {
  const x = simulation("weekly");
  assert.equal(x.score().score, 0);
  assert.equal(x.score().criticalRatio, 0);
});

function reagentsReady(x) {
  x.state.sim.reagents.forEach((r, i) =>
    c(x, "reagent", String(i), undefined, {
      reviewed: true,
      replaced: r.reason !== "足夠",
      note: "已確認至下次保養",
    }),
  );
  c(x, "reagent-check");
}
function dailyStep(x, step) {
  c(x, "maintenance", undefined, true);
  if (step !== "D") c(x, "lid", undefined, true);
  if (step === "A") for (const id of dailyProbes) c(x, "daily-wipe", id);
  if (step === "B") {
    c(x, "daily-mode", undefined, "inspect");
    for (const id of dailyProbes) c(x, "daily-drain", id, "正常");
    for (const id of ["左側", "右側"]) c(x, "daily-mix", id, "正常");
  }
  if (step === "C") {
    c(x, "cup", undefined, "full");
    c(x, "lid", undefined, false);
    c(x, "cleaning");
  }
  if (step === "D") {
    c(x, "lid", undefined, false);
    for (let i = 0; i < 3; i++) c(x, "prime");
  }
}
function dailyCalibration(x) {
  c(x, "lid", undefined, true);
  c(x, "cup", undefined, "discarded");
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) c(x, "drops", id, 10);
  c(x, "lid", undefined, false);
  c(x, "calibrate", "both");
  c(x, "cal-review");
}
for (const order of ["ABCD", "ACBD", "ACDB", "CABD", "CADB", "CDAB"]) {
  test(`daily ${order}: independent chains, early reagents, final Rack and 100 score`, () => {
    const x = simulation("daily");
    reagentsReady(x); // No calibration or temperature prerequisite for reagent work.
    assert.equal(x.state.sim.reagentChecked, true);
    c(x, "temperature", undefined, undefined, { bath: "37", coolant: "8.2" });
    c(x, "index-edit");
    c(x, "index");
    for (const step of order) dailyStep(x, step);
    dailyCalibration(x);
    for (const [type, category] of [
      ["Serum", "cal"],
      ["Serum", "qc"],
      ["Urine", "qc"],
    ])
      c(x, "rack", type, undefined, { category, tests: ["97.Na"] });
    assert.equal(x.score().score, 100);
    assert.equal(x.score().errors.length, 0);
  });
}
test("early B, D, calibration and Rack stay uncredited until the operation is redone after prerequisites", () => {
  const x = simulation("daily");
  c(x, "temperature", undefined, undefined, { bath: "37", coolant: "8.2" });
  c(x, "index-edit");
  c(x, "index");
  dailyStep(x, "B");
  dailyStep(x, "D");
  dailyStep(x, "A");
  assert.equal(find(x.score(), "drain-Sample-1").completed, false);
  assert.equal(x.state.sim.prime, 0);
  dailyCalibration(x);
  assert.equal(x.state.sim.cal.serum, false);
  c(x, "rack", "Serum", undefined, { category: "cal", tests: ["97.Na"] });
  assert.equal(x.state.sim.rack.Serum.cal.length, 0);
  dailyStep(x, "C");
  dailyStep(x, "D");
  reagentsReady(x);
  dailyCalibration(x);
  // Earlier B and Rack are not retroactively validated by later A/C/D.
  assert.equal(find(x.score(), "drain-Sample-1").completed, false);
  assert.equal(find(x.score(), "calEntry").completed, false);
  dailyStep(x, "B");
  for (const [type, category] of [
    ["Serum", "cal"],
    ["Serum", "qc"],
    ["Urine", "qc"],
  ])
    c(x, "rack", type, undefined, { category, tests: ["97.Na"] });
  assert.equal(x.score().score, 100);
  assert.ok(x.score().errors.length > 0);
});
test("Rack waits for every individual earlier item, including four cups, result review and All positions", () => {
  const x = simulation("daily");
  c(x, "temperature", undefined, undefined, { bath: "37", coolant: "8.2" });
  c(x, "index-edit");
  c(x, "index");
  for (const step of "CADB") dailyStep(x, step);
  dailyCalibration(x);
  reagentsReady(x);
  const state = structuredClone(x.state);
  const missing = [
    (s) => (s.temp.saved = false),
    (s) => (s.index = ""),
    (s) => (s.wiped = s.wiped.slice(1)),
    (s) => (s.dailyDrains["Sample-1"] = "異常"),
    (s) => (s.dailyMix["左側"] = ""),
    (s) => (s.cleaned = false),
    (s) => (s.prime = 2),
    (s) => (s.cal.checked = false),
    (s) => (s.cal.urine = false),
    (s) => (s.drops[3] = "9"),
    (s) => (s.cup = "used"),
    (s) => (s.reagentChecked = false),
    (s) => (s.reagents[0].reviewed = false),
  ];
  for (const mutate of missing) {
    const bad = structuredClone(state);
    mutate(bad.sim);
    const out = applyCommand(
      bad,
      "daily",
      {
        type: "rack",
        target: "Serum",
        data: { selection: { cal: ["97.Na"], qc: [], rb: [], sample: [] } },
      },
      x.time + 1,
      previousDailyRubricVersion,
    );
    assert.equal(out.accepted, true);
    assert.match(out.error, /尚未全部完成/);
    assert.equal(out.state.sim.rack.Serum.cal.length, 0);
  }
});
test("v1 unfinished exams retain their original semantics; new daily exams use v3", () => {
  const x = simulation("daily", rubricVersion);
  c(x, "maintenance", undefined, true);
  c(x, "prime");
  assert.equal(x.state.sim.prime, 1);
  assert.equal(find(x.score(), "prime-1").completed, true);
  const revised = simulation("daily", dailyRubricVersion);
  c(revised, "maintenance", undefined, true);
  c(revised, "prime");
  assert.equal(revised.state.sim.prime, 0);
  assert.equal(find(revised.score(), "prime-1").completed, false);
});
test("batch cleaning preserves abnormal findings and eighteen wells do not dominate scoring", () => {
  const x = simulation("weekly");
  open(x);
  c(x, "damage", "R1S", "異常");
  c(x, "group", "R1S");
  assert.equal(c(x, "probe", "Sample-1", "unlock").accepted, false);
  x.wait(2400);
  c(x, "group", "R2");
  x.wait(2400);
  assert.equal(x.state.sim.damage.R1S, "異常");
  c(x, "swab");
  for (const id of wellIds) c(x, "well", id);
  c(x, "well", wellIds[0]);
  assert.equal(x.state.sim.mixers.length, 18);
  assert.equal(x.state.sim.wells.length, 18);
  const r = x.score();
  assert.equal(r.groups.find((g) => g.id === "wells").proportion, 1);
  assert.ok(r.score < 40);
  assert.ok(r.errors.some((e) => e.error.includes("損傷")));
});
test("W2 invalid runs cannot be credited by later configuration; full weekly scenario scores 100", () => {
  const x = simulation("weekly");
  c(x, "maintenance", undefined, true);
  c(x, "w2-start");
  assert.equal(x.state.sim.phase, "idle");
  assert.equal(find(x.score(), "w2").completed, false);
  c(x, "lid", undefined, true);
  c(x, "prepared", undefined, true);
  for (const id of syringeIds) c(x, "syringe", id, "正常");
  for (const id of detailedProbes) {
    for (const op of [
      "unlock",
      "drain",
      "remove",
      "wipe",
      "wire",
      "install",
      "lock",
    ])
      c(x, "probe", id, op);
    c(x, "diag-config", id, undefined, {
      cuvette: "內部",
      count: 3,
      unit: true,
    });
    c(x, "diag", id === "ISE" ? "ise" : "sample");
    c(x, "drain-result", id, "正常");
  }
  for (const id of ["R1S", "R2"]) {
    c(x, "group", id);
    x.wait(2400);
    c(x, "damage", id, "正常");
  }
  c(x, "swab");
  for (const id of wellIds) c(x, "well", id);
  c(x, "diag-config", "mix", undefined, {
    cuvette: "內部",
    count: 1,
    unit: true,
  });
  c(x, "diag", "front");
  c(x, "mix-result", undefined, "正常");
  c(x, "chemistry", undefined, "hcl");
  for (const id of ["sample-left-2", "sample-right-2"])
    c(x, "bottle", id, "remove");
  for (const id of w2Positions)
    c(x, "bottle", id, "replace", { fluid: "w2", level: 1, chemistry: "hcl" });
  c(x, "cup", undefined, "full");
  c(x, "w2-options", undefined, undefined, { photo: true, enhanced: true });
  c(x, "lid", undefined, false);
  assert.equal(find(x.score(), "w2").completed, false);
  c(x, "w2-start");
  assert.equal(x.state.sim.phase, "w2");
  assert.equal(c(x, "lid", undefined, true).accepted, false);
  x.wait(1000);
  c(x, "fast-forward");
  assert.equal(x.state.sim.phase, "photocal");
  c(x, "fast-forward");
  assert.equal(x.state.sim.phase, "done");
  c(x, "photocal-review");
  c(x, "lid", undefined, true);
  for (const id of w2Positions) c(x, "bottle", id, "remove");
  for (const id of ["r1-inner-3", "r1-outer-3"]) c(x, "diluent-clean", id);
  for (const [id, b] of Object.entries(initialBottles()))
    if (b.fluid) c(x, "bottle", id, "replace", { fluid: b.fluid, level: 1 });
  c(x, "cup", undefined, "discarded");
  c(x, "lid", undefined, false);
  c(x, "maintenance", undefined, false);
  const r = x.score();
  assert.equal(r.score, 100);
  assert.equal(r.criticalRatio, 100);
  assert.ok(r.errors.length >= 2);
  assert.ok(r.skippedMs > 1700000);
  assert.ok(r.waitingMs < 3000);
  assert.ok(r.totalMs < 20000);
});
test("missing bottle, volume, chemistry, DET-2, CLEAN or option prevents an effective W2 run", () => {
  const base = initialEngine();
  base.sim.maintenance = true;
  base.sim.chemistry = "hcl";
  base.sim.cup = "full";
  base.sim.photo = true;
  base.sim.enhanced = true;
  for (const id of w2Positions)
    base.sim.bottles[id] = {
      fluid: "w2",
      level: 1,
      chemistry: "hcl",
      revision: 1,
    };
  for (const id of ["sample-left-2", "sample-right-2"])
    base.sim.bottles[id] = { fluid: null, level: 0, revision: 1 };
  const mutations = [
    (s) => (s.bottles[w2Positions[0]].fluid = null),
    (s) => (s.bottles[w2Positions[0]].level = 0.5),
    (s) => (s.bottles[w2Positions[0]].chemistry = "bleach"),
    (s) => (s.bottles["sample-left-2"].fluid = "det2"),
    (s) => (s.bottles["ise-wash-2"].fluid = null),
    (s) => (s.cup = "empty"),
    (s) => (s.photo = false),
    (s) => (s.enhanced = false),
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(base);
    mutate(broken.sim);
    const out = applyCommand(broken, "weekly", { type: "w2-start" }, 10000);
    assert.equal(out.state.sim.phase, "idle");
    assert.ok(out.error);
    assert.equal(out.state.ledger.w2Prepared, undefined);
  }
});
test("daily full scenario scores 100, abnormal records are never automatically normal", () => {
  const x = simulation("daily");
  c(x, "temperature", undefined, undefined, { bath: "37", coolant: "8.2" });
  c(x, "index-edit");
  c(x, "index");
  open(x);
  for (const id of dailyProbes) c(x, "daily-wipe", id);
  c(x, "daily-mode", undefined, "inspect");
  for (const id of dailyProbes) c(x, "daily-drain", id, "正常");
  for (const id of ["左側", "右側"]) c(x, "daily-mix", id, "正常");
  c(x, "cup", undefined, "full");
  c(x, "lid", undefined, false);
  c(x, "cleaning");
  for (let i = 0; i < 3; i++) c(x, "prime");
  c(x, "lid", undefined, true);
  c(x, "cup", undefined, "discarded");
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) c(x, "drops", id, 10);
  c(x, "lid", undefined, false);
  c(x, "calibrate", "both");
  c(x, "cal-review");
  x.state.sim.reagents.forEach((r, i) =>
    c(x, "reagent", String(i), undefined, {
      reviewed: true,
      replaced: r.reason !== "足夠",
      note: "已確認用量",
    }),
  );
  c(x, "reagent-check");
  for (const [type, category] of [
    ["Serum", "cal"],
    ["Serum", "qc"],
    ["Urine", "qc"],
  ])
    c(x, "rack", type, undefined, { category, tests: ["97.Na"] });
  assert.equal(x.score().score, 100);
  assert.equal(x.score().errors.length, 0);
  assert.equal(x.score().repeatedActions, 0);
  c(x, "daily-drain", "Sample-1", "異常");
  assert.ok(x.score().score < 100);
  assert.equal(x.state.sim.dailyDrains["Sample-1"], "異常");
});

async function client(app, port) {
  let cookie = "";
  return async (path, method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: {
        Connection: "close",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const value = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : await response.text();
    return { status: response.status, value, cookie };
  };
}
test("SQLite persistence, ownership, disable/reset, event replay, immutable submit and CSV agree", async () => {
  const folder = mkdtempSync(join(tmpdir(), "au5800-server-test-")),
    dbPath = join(folder, "test.sqlite");
  let app = createApplication({ dbPath });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  let port = app.server.address().port;
  const admin = await client(app, port),
    learner = await client(app, port),
    other = await client(app, port);
  try {
    assert.equal((await admin("/auth/status")).value.needsSetup, true);
    assert.equal(
      (
        await admin("/auth/setup", "POST", {
          username: "teacher",
          name: "教師",
          password: "Testing123!",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await other("/auth/setup", "POST", {
          username: "otherteacher",
          name: "教師2",
          password: "Testing123!",
        })
      ).status,
      409,
    );
    const student = (
      await admin("/admin/users", "POST", {
        username: "student",
        name: "學員",
        password: "Testing123!",
      })
    ).value.user;
    await admin("/admin/users", "POST", {
      username: "student2",
      name: "學員2",
      password: "Testing123!",
    });
    assert.equal(
      (
        await learner("/auth/login", "POST", {
          username: "student",
          password: "Testing123!",
        })
      ).status,
      200,
    );
    await other("/auth/login", "POST", {
      username: "student2",
      password: "Testing123!",
    });
    assert.equal((await learner("/admin/users")).status, 403);
    assert.equal(
      (await learner("/attempts", "POST", { kind: "biweekly" })).status,
      400,
    );
    const started = (
      await learner("/attempts", "POST", { kind: "daily", score: 100 })
    ).value.attempt;
    assert.equal(
      (await learner("/attempts", "POST", { kind: "weekly" })).status,
      409,
    );
    assert.equal((await other(`/attempts/${started.id}`)).status, 404);
    assert.equal(
      (await admin(`/attempts/${started.id}/submit`, "POST", { revision: 0 }))
        .status,
      403,
    );
    const event = {
      id: "00000000-0000-4000-8000-000000000001",
      revision: 0,
      source: "model",
      command: { type: "index" },
    };
    const saved = await learner(
      `/attempts/${started.id}/events`,
      "POST",
      event,
    );
    assert.equal(saved.value.attempt.revision, 1);
    assert.equal(saved.value.attempt.events, undefined);
    assert.equal(saved.value.attempt.result, null);
    assert.equal(saved.value.attempt.ledger, undefined);
    assert.equal(
      (await learner(`/attempts/${started.id}/events`, "POST", event)).value
        .attempt.revision,
      1,
    );
    assert.equal(
      (
        await learner(`/attempts/${started.id}/events`, "POST", {
          ...event,
          command: { type: "prime" },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await learner(`/attempts/${started.id}/events`, "POST", {
          ...event,
          id: "00000000-0000-4000-8000-000000000002",
        })
      ).status,
      409,
    );
    const resumed = (await learner("/attempts/active")).value.attempt;
    assert.equal(resumed.sim.index, saved.value.attempt.sim.index);
    const submitted = (
      await learner(`/attempts/${started.id}/submit`, "POST", {
        revision: 1,
        score: 100,
      })
    ).value.attempt;
    assert.ok(submitted.result.score < 100);
    assert.equal(submitted.events.length, 1);
    assert.equal(submitted.result.errors.length, 1);
    assert.deepEqual(
      (await learner(`/attempts/${started.id}/submit`, "POST", { revision: 1 }))
        .value.attempt.result,
      submitted.result,
    );
    assert.equal(
      (
        await learner(`/attempts/${started.id}/events`, "POST", {
          ...event,
          id: "00000000-0000-4000-8000-000000000003",
          revision: 1,
        })
      ).status,
      409,
    );
    assert.equal((await other("/attempts")).value.attempts.length, 0);
    const csv = await admin("/admin/export");
    assert.match(csv.value, /學員/);
    assert.match(csv.value, new RegExp(`"${submitted.result.score}"`));
    assert.equal(
      (await admin(`/admin/users/${student.id}`, "PATCH", { enabled: false }))
        .status,
      200,
    );
    assert.equal((await learner("/attempts")).status, 401);
    assert.equal(
      (
        await learner("/auth/login", "POST", {
          username: "student",
          password: "Testing123!",
        })
      ).status,
      401,
    );
    await admin(`/admin/users/${student.id}`, "PATCH", {
      enabled: true,
      password: "Changed123!",
    });
    assert.equal(
      (
        await learner("/auth/login", "POST", {
          username: "student",
          password: "Testing123!",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await learner("/auth/login", "POST", {
          username: "student",
          password: "Changed123!",
        })
      ).status,
      200,
    );
    const active = (await learner("/attempts", "POST", { kind: "weekly" }))
      .value.attempt;
    await app.close();
    app = createApplication({ dbPath });
    await new Promise((resolve) =>
      app.server.listen(port, "127.0.0.1", resolve),
    );
    assert.equal(
      (await learner("/attempts/active")).value.attempt.id,
      active.id,
    );
    assert.equal(
      (await learner(`/attempts/${submitted.id}`)).value.attempt.result.score,
      submitted.result.score,
    );
    assert.equal(
      (await learner(`/attempts/${active.id}/abandon`, "POST", {})).status,
      200,
    );
    assert.equal((await learner("/attempts/active")).value.attempt, null);
    assert.equal(
      (await learner("/attempts")).value.attempts.find(
        (a) => a.id === active.id,
      ).status,
      "abandoned",
    );
    assert.equal(
      readFileSync(dbPath).includes(Buffer.from("Changed123!")),
      false,
    );
  } finally {
    await app.close();
  }
});

test("concurrent event requests respect revision and concurrent submissions return one frozen result", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const request = await client(app, app.server.address().port);
  try {
    await request("/auth/setup", "POST", {
      username: "teacher",
      name: "教師",
      password: "Testing123!",
    });
    const a = (await request("/attempts", "POST", { kind: "daily" })).value
      .attempt;
    const operations = await Promise.all(
      [1, 2].map((n) =>
        request(`/attempts/${a.id}/events`, "POST", {
          id: `00000000-0000-4000-8000-00000000000${n}`,
          revision: 0,
          source: "model",
          command: { type: "index-edit" },
        }),
      ),
    );
    assert.deepEqual(operations.map((x) => x.status).sort(), [200, 409]);
    const results = await Promise.all([
      request(`/attempts/${a.id}/submit`, "POST", { revision: 1 }),
      request(`/attempts/${a.id}/submit`, "POST", { revision: 1 }),
    ]);
    assert.deepEqual(
      results.map((x) => x.status),
      [200, 200],
    );
    assert.deepEqual(
      results[0].value.attempt.result,
      results[1].value.attempt.result,
    );
    assert.equal(
      results[0].value.attempt.submittedAt,
      results[1].value.attempt.submittedAt,
    );
    assert.equal(results[0].value.attempt.events.length, 1);
  } finally {
    await app.close();
  }
});

test("API versions new daily attempts separately and resumes a v1 attempt without changing its submitted result", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const request = await client(app, app.server.address().port);
  try {
    await request("/auth/setup", "POST", {
      username: "teacher",
      name: "教師",
      password: "Testing123!",
    });
    const a = (await request("/attempts", "POST", { kind: "daily" })).value
      .attempt;
    assert.equal(a.version, dailyRubricVersion);
    app.db
      .prepare("UPDATE attempts SET version=? WHERE id=?")
      .run(rubricVersion, a.id);
    assert.equal(
      (await request("/attempts/active")).value.attempt.version,
      rubricVersion,
    );
    for (const [i, command] of [
      { type: "maintenance", value: true },
      { type: "prime" },
    ].entries()) {
      const saved = await request(`/attempts/${a.id}/events`, "POST", {
        id: `00000000-0000-4000-8000-00000000000${i}`,
        revision: i,
        source: "workstation",
        command,
      });
      assert.equal(saved.status, 200);
    }
    const old = (
      await request(`/attempts/${a.id}/submit`, "POST", { revision: 2 })
    ).value.attempt;
    assert.equal(old.version, rubricVersion);
    assert.equal(find(old.result, "prime-1").completed, true);
    const next = (await request("/attempts", "POST", { kind: "daily" })).value
      .attempt;
    assert.equal(next.version, dailyRubricVersion);
    assert.deepEqual(
      (await request(`/attempts/${old.id}`)).value.attempt.result,
      old.result,
    );
  } finally {
    await app.close();
  }
});

test("API resumes a real v2 state and freezes its result while new attempts receive v3 bottles", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const request = await client(app, app.server.address().port);
  try {
    await request("/auth/setup", "POST", {
      username: "teacher",
      name: "教師",
      password: "Testing123!",
    });
    const a = (await request("/attempts", "POST", { kind: "daily" })).value
      .attempt;
    app.db
      .prepare("UPDATE attempts SET version=?,state=? WHERE id=?")
      .run(
        previousDailyRubricVersion,
        JSON.stringify(initialEngine(previousDailyRubricVersion)),
        a.id,
      );
    let active = (await request("/attempts/active")).value.attempt;
    assert.equal(active.version, previousDailyRubricVersion);
    assert.equal(active.sim.instrument, undefined);
    assert.equal(active.sim.reagents.length, 5);
    for (const [i, command] of [
      { type: "lid", value: true },
      { type: "daily-wipe", target: "R1-1" },
      { type: "maintenance", value: true },
      { type: "daily-wipe", target: "R1-1" },
    ].entries()) {
      const saved = await request(`/attempts/${a.id}/events`, "POST", {
        id: `00000000-0000-4000-8000-00000000010${i}`,
        revision: i,
        source: "model",
        command,
      });
      assert.equal(saved.status, 200);
      if (i === 1) assert.deepEqual(saved.value.attempt.sim.wiped, []);
    }
    const old = (
      await request(`/attempts/${a.id}/submit`, "POST", { revision: 4 })
    ).value.attempt;
    assert.equal(find(old.result, "wipe-R1-1").completed, true);
    assert.equal(old.result.errors.length, 1);
    const next = (await request("/attempts", "POST", { kind: "daily" })).value
      .attempt;
    assert.equal(next.version, dailyRubricVersion);
    assert.equal(next.sim.reagents.length, 11);
    assert.deepEqual(
      (await request(`/attempts/${old.id}`)).value.attempt.result,
      old.result,
    );
  } finally {
    await app.close();
  }
});

test("API retains active v4 / weekly v2 scenarios and freezes old results across v5 / weekly v3 rollout", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const request = await client(app, app.server.address().port);
  try {
    await request("/auth/setup", "POST", {
      username: "teacher",
      name: "教師",
      password: "Testing123!",
    });
    for (const [kind, oldVersion, newVersion] of [
      ["daily", legacyDailyV4, dailyRubricVersion],
      ["weekly", legacyWeeklyV2, currentWeeklyVersion],
    ]) {
      const created = (await request("/attempts", "POST", { kind })).value
        .attempt;
      app.db
        .prepare("UPDATE attempts SET version=?,state=? WHERE id=?")
        .run(oldVersion, JSON.stringify(initialEngine(oldVersion)), created.id);
      const active = (await request("/attempts/active")).value.attempt;
      assert.equal(active.version, oldVersion);
      if (kind === "daily") assert.equal(active.sim.reagents.length, 9);
      const lid = (
        await request(`/attempts/${active.id}/events`, "POST", {
          id: crypto.randomUUID(),
          revision: 0,
          source: "model",
          command: { type: "cover", target: "iseTop", value: true },
        })
      ).value.attempt;
      const guard = await request(`/attempts/${active.id}/events`, "POST", {
        id: crypto.randomUUID(),
        revision: lid.revision,
        source: "model",
        command: { type: "bottle", target: "ise-wash-1", value: "refill" },
      });
      assert.equal(guard.value.applied, false);
      assert.equal(
        guard.value.attempt.sim.bottles["ise-wash-1"].level,
        initialEngine(oldVersion).sim.bottles["ise-wash-1"].level,
      );
      const submitted = (
        await request(`/attempts/${active.id}/submit`, "POST", {
          revision: guard.value.attempt.revision,
        })
      ).value.attempt;
      const next = (await request("/attempts", "POST", { kind })).value.attempt;
      assert.equal(next.version, newVersion);
      assert.deepEqual(
        (await request(`/attempts/${active.id}`)).value.attempt.result,
        submitted.result,
      );
      await request(`/attempts/${next.id}/abandon`, "POST", {
        revision: next.revision,
      });
    }
  } finally {
    await app.close();
  }
});
