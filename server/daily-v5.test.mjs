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
  legacyDailyV5 as dailyRubricVersion,
  legacyDailyV3,
} from "../shared/dailyScenario.ts";

import {
  scenario,
  supplies,
  iseBottles,
  syringes,
  clean,
  primeCal,
  manual,
  register,
  rack,
  complete,
} from "./daily-fixture.mjs";

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
