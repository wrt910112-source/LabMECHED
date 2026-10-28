import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialEngine,
  applyCommand,
  scoreAttempt,
  supportsVersion,
} from "../shared/exam.ts";
import { dailyProbes } from "../shared/maintenance.ts";
import {
  supplyIds,
  dailySyringes,
  iseReagentIds,
  tasksReadiness,
} from "../shared/dailyTasks.ts";
import {
  calibrationNeeds,
  currentDailyVersion as dailyRubricVersion,
  legacyDailyV3,
} from "../shared/dailyScenario.ts";

function scenario(source = "model", restored) {
  let state = restored || initialEngine(dailyRubricVersion),
    now = 1000;
  const events = [];
  const run = (type, target, value, data) => {
    const command = { type, target, value, data };
    const out = applyCommand(
      state,
      "daily",
      command,
      (now += 100),
      dailyRubricVersion,
    );
    state = out.state;
    events.push({
      id: String(events.length),
      at: now,
      source,
      command,
      accepted: out.accepted,
      error: out.error,
      label: out.label,
    });
    return out;
  };
  return {
    run,
    get state() {
      return state;
    },
    events,
    score: () =>
      scoreAttempt("daily", state, events, 1000, now, dailyRubricVersion),
  };
}
function supplies(x, omit = "") {
  x.run("cover", "mainLid", true);
  x.run("maintenance", "analyzer", true);
  x.run("cover", "iseTop", true);
  x.run("maintenance", "ise", true);
  for (const id of supplyIds.filter((id) => id !== omit))
    assert.equal(x.run("bottle", id, "refill").error, "");
}
function iseBottles(x) {
  x.run("cover", "iseReagents", true);
  x.run("cover", "iseReference", true);
  for (const id of iseReagentIds)
    assert.equal(x.run("ise-reagent", id, "inspect").error, "");
  for (const id of ["standard", "buffer"])
    assert.equal(x.run("ise-reagent", id, "replace").error, "");
}
function syringes(x) {
  x.run("cover", "frontSyringe", true);
  x.run("cover", "rearSyringe", true);
  for (const id of dailySyringes)
    for (const finding of ["moisture", "leak"])
      assert.equal(x.run("daily-syringe", id, "正常", { finding }).error, "");
}
function clean(x) {
  x.run("cover", "iseTop", true);
  x.run("cup", undefined, "full");
  x.run("maintenance", "ise", false);
  assert.equal(x.run("cleaning").error, "");
}
function primeCal(x) {
  x.run("maintenance", "ise", true);
  for (let i = 0; i < 3; i++) assert.equal(x.run("prime").error, "");
  x.run("maintenance", "ise", false);
  x.run("cup", undefined, "discarded");
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) x.run("drops", id, 10);
  assert.equal(x.run("calibrate", "both").error, "");
  x.run("cal-review");
}
function manual(x) {
  x.run("cover", "mainLid", true);
  x.run("maintenance", "analyzer", false);
  x.run("maintenance", "ise", true);
  x.run("diag-config", "ISE", undefined, {
    unit: true,
    cuvette: "內部",
    count: 3,
  });
  assert.equal(x.run("diag", "ise").error, "");
  assert.equal(x.run("drain-result", "ISE", "正常").error, "");
  for (const id of dailyProbes) assert.equal(x.run("daily-wipe", id).error, "");
  x.run("maintenance", "analyzer", true);
  x.run("daily-mode", undefined, "inspect");
  for (const id of dailyProbes) x.run("daily-drain", id, "正常");
  for (const id of ["左側", "右側"]) x.run("daily-mix", id, "正常");
}
function register(x) {
  x.run("index-edit");
  x.run("index");
  x.run("temperature", undefined, undefined, { bath: "37", coolant: "8" });
  for (const r of x.state.sim.reagents) x.run("reagent", r.id, "replace");
  return x.run("reagent-check");
}
function rack(x) {
  const needs = calibrationNeeds(x.state.sim.reagents);
  return x.run("rack", "Serum", undefined, {
    category: "calibration",
    selection: { ...needs, qc: [], sample: [] },
  });
}
function complete(source = "model") {
  const x = scenario(source);
  manual(x);
  clean(x);
  iseBottles(x);
  primeCal(x);
  supplies(x);
  syringes(x);
  assert.equal(register(x).error, "");
  assert.equal(rack(x).error, "");
  assert.equal(
    x.run("rack-qc-entry", undefined, undefined, {
      Serum: ["3.ALT"],
      Urine: ["9.CRE"],
    }).error,
    "",
  );
  return x;
}

test("v5 complete daily flow: eleven bottles, RB six / Cali three, nine inspections, twelve equal groups", () => {
  const x = complete();
  assert.equal(x.state.sim.reagents.length, 11);
  assert.deepEqual(calibrationNeeds(x.state.sim.reagents), {
    rb: ["3.ALT", "5.AST", "15.HDL", "20.LDL", "9.CRE", "4.AMY"],
    cal: ["15.HDL", "20.LDL", "9.CRE"],
  });
  assert.equal(x.score().groups.length, 12);
  assert.equal(
    x.score().groups.find((g) => g.id === "inspect").items.length,
    9,
  );
  assert.equal(x.score().score, 100);
  assert.equal(x.score().errors.length, 0);
  assert.deepEqual(x.score().groups, complete("workstation").score().groups);
});
test("v5 every bottle including sufficient-volume expiring AMY is mandatory; replacement repeat does not invalidate valid check", () => {
  for (const omit of initialEngine(dailyRubricVersion).sim.reagents.map(
    (r) => r.id,
  )) {
    const x = scenario();
    supplies(x);
    x.run("index-edit");
    x.run("index");
    x.run("temperature", undefined, undefined, { bath: "37", coolant: "8" });
    for (const r of x.state.sim.reagents.filter((r) => r.id !== omit))
      x.run("reagent", r.id, "replace");
    x.run("reagent-check");
    assert.equal(x.state.sim.reagentChecked, false, omit);
    assert.ok(x.state.sim.reagents.every((r) => r.rb !== "expired"));
    x.run("reagent", omit, "replace");
    x.run("reagent-check");
    assert.equal(x.state.sim.reagentChecked, true);
    assert.equal(x.run("reagent", omit, "replace").accepted, false);
    assert.equal(x.state.sim.reagentChecked, true);
  }
  const amy = initialEngine(dailyRubricVersion).sim.reagents.find(
    (r) => r.name === "AMY",
  );
  assert.ok(amy.remaining >= amy.need);
  assert.equal(amy.reason, "即將到期");
});
test("v5 ISE drain is independent of six wipes but requires valid DIAG and physical state; abnormal correction restores readiness", () => {
  const x = scenario();
  x.run("maintenance", "ise", true);
  assert.ok(x.run("drain-result", "ISE", "正常").error);
  x.run("diag-config", "ISE", undefined, {
    unit: true,
    cuvette: "內部",
    count: 2,
  });
  x.run("diag", "ise");
  x.run("drain-result", "ISE", "正常");
  assert.equal(x.state.ledger.dailyIseDrain, false);
  x.run("diag-config", "ISE", undefined, {
    unit: true,
    cuvette: "內部",
    count: 3,
  });
  x.run("cover", "iseModule", true);
  assert.equal(x.run("diag", "ise").accepted, false);
  x.run("cover", "iseModule", false);
  x.run("diag", "ise");
  x.run("drain-result", "ISE", "正常");
  assert.equal(x.state.ledger.dailyIseDrain, true);
  assert.equal(x.state.sim.wiped.length, 0);
  const y = complete();
  y.run("maintenance", "ise", true);
  y.run("diag-config", "ISE", undefined, {
    unit: true,
    cuvette: "內部",
    count: 3,
  });
  y.run("diag", "ise");
  y.run("drain-result", "ISE", "異常");
  assert.ok(rack(y).error);
  y.run("drain-result", "ISE", "正常");
  assert.equal(rack(y).error, "");
});
test("ISE DET access is version-aware: v5 / weekly v3 without Maintenance; v4 / weekly v2 retain old interlock", () => {
  for (const version of [
    dailyRubricVersion,
    "AU5800-2026-10-22-v4",
    "AU5800-weekly-2026-10-27-v3",
    "AU5800-weekly-2026-10-21-v2",
  ]) {
    const kind = version.includes("weekly") ? "weekly" : "daily";
    let state = initialEngine(version);
    const run = (command) => {
      const out = applyCommand(state, kind, command, 1000, version);
      state = out.state;
      return out;
    };
    assert.equal(
      run({ type: "bottle", target: "ise-wash-1", value: "refill" }).accepted,
      false,
    );
    run({ type: "cover", target: "iseTop", value: true });
    const revised =
      version === dailyRubricVersion ||
      version === "AU5800-weekly-2026-10-27-v3";
    assert.equal(
      run({ type: "bottle", target: "ise-wash-1", value: "refill" }).accepted,
      revised,
    );
    state.sim.phase = "w2";
    state.sim.deadline = 99999;
    assert.equal(
      run({ type: "bottle", target: "ise-wash-1", value: "remove" }).accepted,
      false,
    );
  }
});
test("QC batch validates both types before mutation and preserves all non-QC registrations; invalid / early saves are atomic", () => {
  const x = complete();
  const old = structuredClone(x.state.sim.rack);
  assert.equal(
    x.run("rack-qc-entry", undefined, undefined, {
      Serum: ["3.ALT"],
      Urine: ["invalid"],
    }).accepted,
    false,
  );
  assert.deepEqual(x.state.sim.rack, old);
  assert.equal(
    x.run("rack-qc-entry", undefined, undefined, {
      Serum: ["5.AST", "5.AST"],
      Urine: ["9.CRE"],
    }).error,
    "",
  );
  assert.deepEqual(x.state.sim.rack.Serum.qc, ["5.AST"]);
  assert.deepEqual(x.state.sim.rack.Serum.rb, old.Serum.rb);
  assert.deepEqual(x.state.sim.rack.Serum.cal, old.Serum.cal);
  const early = scenario();
  early.run("rack-qc-entry", undefined, undefined, {
    Serum: ["3.ALT"],
    Urine: ["9.CRE"],
  });
  assert.deepEqual(early.state.sim.rack.Serum.qc, []);
  assert.deepEqual(early.state.sim.rack.Urine.qc, []);
});
test("v5 missing any RB or Cali is uncredited; supply replacement invalidates Check and registration, history survives", () => {
  for (const key of ["rb", "cal"])
    for (const omit of calibrationNeeds(complete().state.sim.reagents)[key]) {
      const x = complete();
      const needs = calibrationNeeds(x.state.sim.reagents);
      needs[key] = needs[key].filter((id) => id !== omit);
      x.run("rack", "Serum", undefined, {
        category: "calibration",
        selection: { ...needs, qc: [], sample: [] },
      });
      assert.equal(x.state.ledger.calEntry, false, omit);
    }
  const x = complete();
  const count = x.events.length;
  x.run("bottle", supplyIds[0], "refill");
  assert.equal(x.state.sim.reagentChecked, false);
  assert.equal(x.state.ledger.calEntry, false);
  assert.ok(x.events.length > count);
});
