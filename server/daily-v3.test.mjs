import { legacyDailyV3 as dailyRubricVersion } from "../shared/dailyScenario.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialEngine,
  applyCommand,
  scoreAttempt,
  previousDailyRubricVersion,
  rubricVersion,
  weeklyRubricVersion,
  supportsVersion,
} from "../shared/exam.ts";
import { dailyProbes } from "../shared/maintenance.ts";
import { calibrationNeeds } from "../shared/dailyScenario.ts";

function scenario(version = dailyRubricVersion) {
  let state = initialEngine(version),
    now = 1000;
  const events = [];
  const run = (type, target, value, data, source = "model") => {
    if (type === "rack" && version === dailyRubricVersion && data?.selection)
      data = { category: target === "Urine" ? "qc" : "calibration", ...data };
    const command = { type, target, value, data };
    const out = applyCommand(state, "daily", command, (now += 100), version);
    state = out.state;
    events.push({
      id: String(events.length),
      at: now,
      source,
      command,
      accepted: out.accepted,
      label: out.label,
      error: out.error,
    });
    return out;
  };
  const score = () => scoreAttempt("daily", state, events, 1000, now, version);
  return {
    run,
    score,
    get state() {
      return state;
    },
    get events() {
      return events;
    },
  };
}
const item = (x, id) =>
  x
    .score()
    .groups.flatMap((g) => g.items)
    .find((i) => i.id === id);
function step(x, name) {
  const c = x.run;
  if (name === "A") {
    c("cover", "mainLid", true);
    c("maintenance", "analyzer", false);
    for (const id of dailyProbes)
      assert.equal(c("daily-wipe", id).accepted, true);
  }
  if (name === "B") {
    c("maintenance", "analyzer", true);
    c("daily-mode", undefined, "inspect");
    for (const id of dailyProbes) c("daily-drain", id, "正常");
    for (const id of ["左側", "右側"]) c("daily-mix", id, "正常");
  }
  if (name === "C") {
    c("cover", "iseTop", true);
    c("cup", undefined, "full");
    c("maintenance", "ise", true);
    assert.equal(c("cleaning").accepted, true);
    assert.equal(x.state.sim.cup, "used");
  }
  if (name === "D") for (let i = 0; i < 3; i++) c("prime");
}
function prepareReagents(x) {
  for (const r of x.state.sim.reagents) x.run("reagent", r.id, "replace");
}
function registration(x) {
  assert.equal(x.run("index-edit").error, "");
  assert.equal(x.run("index").error, "");
  x.run("temperature", undefined, undefined, { bath: "37", coolant: "8.2" });
  assert.equal(x.run("reagent-check").error, "");
}
function calibration(x) {
  const c = x.run;
  c("maintenance", "ise", false);
  assert.equal(c("cup", undefined, "discarded").error, "");
  for (const id of ["S-H", "S-L", "U-H", "U-L"])
    assert.equal(c("drops", id, 10).error, "");
  assert.equal(c("calibrate", "both").error, "");
  c("cal-review");
}
const selection = (x, qc = []) => ({
  ...calibrationNeeds(x.state.sim.reagents),
  qc,
  sample: [],
});

for (const order of ["ABCD", "ACBD", "ACDB", "CABD", "CADB", "CDAB"]) {
  test(`v3 ${order}: manual work precedes Index/temperature; nine bottles and complete Rack score 100`, () => {
    const x = scenario();
    prepareReagents(x);
    for (const name of order) step(x, name);
    calibration(x);
    assert.equal(x.state.sim.instrument.iseTop, true);
    assert.equal(x.state.sim.instrument.iseModule, false);
    assert.equal(x.state.sim.instrument.iseMaintenance, false);
    registration(x);
    const needs = calibrationNeeds(x.state.sim.reagents);
    assert.deepEqual(
      new Set(needs.rb),
      new Set(["3.ALT", "4.AMY", "9.CRE", "15.HDL", "20.LDL"]),
    );
    assert.deepEqual(
      new Set(needs.cal),
      new Set(["9.CRE", "15.HDL", "20.LDL"]),
    );
    x.run(
      "rack",
      "Serum",
      undefined,
      { selection: selection(x, ["3.ALT"]) },
      "workstation",
    );
    x.run("rack", "Serum", undefined, {
      category: "qc",
      selection: selection(x, ["3.ALT"]),
    });
    x.run("rack", "Urine", undefined, {
      selection: { rb: [], cal: [], qc: ["9.CRE"], sample: [] },
    });
    assert.equal(x.score().score, 100);
    assert.equal(x.score().errors.length, 0);
  });
}

test("v3 three covers and two maintenance modes are independent; invalid physical actions retain reasons", () => {
  const x = scenario();
  assert.equal(x.run("daily-wipe", "R1-1").accepted, false);
  assert.equal(item(x, "wipe-R1-1").diagnosis.status, "曾嘗試但被阻擋");
  assert.match(item(x, "wipe-R1-1").diagnosis.reason, /主蓋/);
  x.run("cover", "mainLid", true);
  assert.equal(x.run("daily-wipe", "R1-1").error, "");
  assert.equal(item(x, "wipe-R1-1").completed, true);
  assert.equal(x.score().corrections, 1);
  assert.equal(x.run("cup", undefined, "full").accepted, false);
  x.run("cover", "iseTop", true);
  assert.equal(x.run("cup", undefined, "full").error, "");
  assert.equal(x.run("cup", undefined, "discarded").error, "");
  x.run("cup", undefined, "full");
  x.run("maintenance", "ise", true);
  x.run("cover", "iseModule", true);
  assert.equal(x.run("cleaning").accepted, false);
  x.run("cover", "iseModule", false);
  assert.equal(x.run("cleaning").error, "");
  assert.equal(x.run("calibrate", "both").accepted, false);
  assert.equal(x.state.sim.instrument.analyzerMaintenance, false);
  assert.equal(x.state.sim.instrument.mainLid, true);
  x.state.sim.phase = "w2";
  x.state.sim.deadline = 999999;
  assert.equal(x.run("cover", "iseTop", false).accepted, false);
  assert.equal(x.run("cup", undefined, "discarded").accepted, false);
});

test("v3 prerequisites are assessed at execution; later correction and changed bottles require fresh checks and Entry", () => {
  const x = scenario();
  step(x, "B");
  assert.equal(item(x, "drain-R1-1").completed, false);
  step(x, "A");
  assert.equal(item(x, "drain-R1-1").completed, false);
  step(x, "B");
  step(x, "C");
  step(x, "D");
  calibration(x);
  prepareReagents(x);
  x.run("reagent-check");
  assert.equal(x.state.sim.reagentChecked, false);
  x.run("rack", "Serum", undefined, { selection: selection(x) });
  assert.equal(item(x, "calEntry").completed, false);
  registration(x);
  x.run("rack", "Serum", undefined, {
    selection: { ...selection(x), cal: ["9.CRE"] },
  });
  assert.equal(item(x, "calEntry").completed, false);
  x.run("rack", "Serum", undefined, { selection: selection(x) });
  assert.equal(item(x, "calEntry").completed, true);
  x.run("reagent", x.state.sim.reagents[0].id, "replace");
  assert.equal(x.state.sim.reagentChecked, false);
  assert.equal(item(x, "calEntry").completed, false);
  x.run("reagent-check");
  assert.equal(item(x, "calEntry").completed, false);
  x.run("rack", "Serum", undefined, { selection: selection(x) });
  assert.equal(item(x, "calEntry").completed, true);
  assert.equal(x.state.sim.reagents.find((r) => r.name === "ALT").cal, "na");
  assert.ok(x.state.sim.reagents.every((r) => r.rb === "expired"));
  assert.ok(x.score().errors.length >= 3);
});

test("v1 and v2 preserve original state and interlocks; v3 permits either Index/temperature order", () => {
  for (const v of [rubricVersion, previousDailyRubricVersion]) {
    const x = scenario(v);
    assert.equal(supportsVersion("daily", v), true);
    assert.equal(x.state.sim.instrument, undefined);
    assert.equal(x.state.sim.reagents.length, 5);
    x.run("lid", undefined, true);
    assert.equal(x.run("daily-wipe", "R1-1").accepted, false);
    x.run("index-edit");
    assert.match(x.run("index").error, /溫度/);
  }
  for (const first of ["index", "temperature"]) {
    const x = scenario();
    if (first === "temperature")
      x.run("temperature", undefined, undefined, {
        bath: "37",
        coolant: "8.2",
      });
    x.run("index-edit");
    assert.equal(x.run("index").error, "");
    if (first === "index")
      x.run("temperature", undefined, undefined, {
        bath: "37",
        coolant: "8.2",
      });
    assert.equal(x.state.sim.temp.saved, true);
  }
});

test("new weekly hardware separates ISE access from the analyzer lid and retains v1 compatibility", () => {
  let state = initialEngine(weeklyRubricVersion),
    now = 1000;
  const run = (type, target, value) => {
    const out = applyCommand(
      state,
      "weekly",
      { type, target, value },
      (now += 100),
      weeklyRubricVersion,
    );
    state = out.state;
    return out;
  };
  assert.equal(supportsVersion("weekly", rubricVersion), true);
  assert.equal(supportsVersion("weekly", weeklyRubricVersion), true);
  run("cover", "iseTop", true);
  assert.equal(run("cup", undefined, "full").accepted, true);
  assert.equal(run("cup", undefined, "discarded").accepted, true);
  assert.equal(run("probe", "ISE", "unlock").accepted, false);
  run("maintenance", "ise", true);
  assert.equal(run("probe", "ISE", "unlock").accepted, true);
  assert.equal(run("probe", "Sample-1", "unlock").accepted, false);
  assert.equal(state.sim.instrument.mainLid, false);
  assert.equal(state.sim.instrument.analyzerMaintenance, false);
});

test("v3 QC and Calibration Entry only save their own categories", () => {
  const x = scenario();
  for (const name of "ABCD") step(x, name);
  calibration(x);
  prepareReagents(x);
  registration(x);
  x.run("rack", "Serum", undefined, {
    category: "qc",
    selection: selection(x, ["3.ALT"]),
  });
  assert.equal(x.state.sim.calibrationEntered, false);
  assert.equal(item(x, "calEntry").completed, false);
  assert.equal(item(x, "serumEntry").completed, true);
  assert.deepEqual(x.state.sim.rack.Serum.rb, []);
  x.run("rack", "Serum", undefined, {
    category: "calibration",
    selection: selection(x),
  });
  assert.equal(item(x, "calEntry").completed, true);
  assert.deepEqual(x.state.sim.rack.Serum.qc, ["3.ALT"]);
});
