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
  legacyDailyV4 as dailyRubricVersion,
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
  for (const target of ["Serum", "Urine"])
    x.run("rack", target, undefined, {
      category: "qc",
      selection: { rb: [], cal: [], qc: ["3.ALT"], sample: [] },
    });
  return x;
}
test("v4: twelve equal groups and complete flow scores 100 through either entry", () => {
  assert.equal(supplyIds.length, 12);
  const model = complete(),
    workstation = complete("workstation");
  assert.equal(model.score().groups.length, 12);
  assert.equal(model.score().score, 100);
  assert.equal(model.score().errors.length, 0);
  assert.deepEqual(model.score().groups, workstation.score().groups);
  assert.equal(workstation.score().criticalRatio, 100);
});
test("v4 instrument mode and metal lid independently enforce Cleaning, Prime and calibration", () => {
  const x = scenario();
  x.run("cover", "iseTop", true);
  x.run("cup", undefined, "full");
  x.run("maintenance", "ise", true);
  assert.equal(x.run("cleaning").accepted, false);
  x.run("maintenance", "ise", false);
  x.run("cover", "iseModule", true);
  assert.equal(x.run("cleaning").accepted, false);
  x.run("cover", "iseModule", false);
  assert.equal(x.run("cleaning").error, "");
  assert.equal(x.run("prime").accepted, false);
  x.run("maintenance", "ise", true);
  assert.equal(x.run("calibrate", "both").accepted, false);
  assert.equal(x.state.sim.instrument.iseTop, true);
});
test("v4: every one of the twelve supplies is required before Reagent Check", () => {
  for (const id of supplyIds) {
    const x = scenario();
    supplies(x, id);
    assert.match(register(x).error, /十二瓶/);
    assert.equal(x.state.sim.reagentChecked, false);
    x.run("bottle", id, "refill");
    assert.equal(x.run("reagent-check").error, "");
    x.run("bottle", id, "remove");
    assert.equal(x.state.sim.reagentChecked, false);
    assert.match(x.run("reagent-check").error, /十二瓶/);
  }
});
test("v4: wrong fluid never earns refill completion; correcting it retains error", () => {
  const x = scenario();
  supplies(x);
  x.run("bottle", supplyIds[0], "replace", { fluid: "det2" });
  assert.equal(
    tasksReadiness(x.state.sim.dailyTasks, x.state.sim.bottles).suppliesReady,
    false,
  );
  assert.match(register(x).error, /十二瓶/);
  x.run("bottle", supplyIds[0], "replace", { fluid: "cln1" });
  x.run("reagent-check");
  assert.equal(x.state.sim.reagentChecked, true);
  assert.ok(x.score().errors.length >= 2);
});
test("v4: each syringe has separate moisture/leak evidence and physical cabinet access", () => {
  const x = scenario();
  assert.equal(
    x.run("daily-syringe", "R2-2", "正常", { finding: "moisture" }).accepted,
    false,
  );
  syringes(x);
  for (const id of dailySyringes)
    for (const finding of ["moisture", "leak"]) {
      x.run("daily-syringe", id, "異常", { finding });
      assert.equal(
        tasksReadiness(x.state.sim.dailyTasks, x.state.sim.bottles)
          .syringesReady,
        false,
      );
      x.run("daily-syringe", id, "正常", { finding });
    }
  assert.equal(
    tasksReadiness(x.state.sim.dailyTasks, x.state.sim.bottles).syringesReady,
    true,
  );
  assert.ok(x.score().corrections >= 10);
});
test("v4: Prime requires all three inspected and both insufficient bottles replaced", () => {
  const x = scenario();
  clean(x);
  x.run("maintenance", "ise", true);
  assert.match(x.run("prime").error, /試劑/);
  assert.equal(x.state.sim.prime, 0);
  assert.equal(x.run("ise-reagent", "standard", "replace").accepted, false);
  iseBottles(x);
  assert.equal(x.state.sim.dailyTasks.iseReagents.reference.replaced, false);
  assert.equal(x.run("prime").error, "");
});
test("v4: replacing any ISE bottle invalidates completed Prime/calibration and survives restore", () => {
  for (const id of iseReagentIds) {
    const x = complete();
    assert.equal(x.state.sim.cal.checked, true);
    assert.equal(x.run("ise-reagent", id, "replace").error, "");
    assert.equal(x.state.sim.prime, 0);
    assert.equal(x.state.sim.cal.checked, false);
    assert.match(rack(x).error, /尚未全部完成/);
    const restored = scenario("model", JSON.parse(JSON.stringify(x.state)));
    assert.equal(restored.state.sim.dailyTasks.iseReagents[id].replaced, true);
    assert.match(restored.run("calibrate", "both").error, /儀器狀態/);
    restored.run("maintenance", "ise", false);
    assert.match(restored.run("calibrate", "both").error, /三次/);
    primeCal(restored);
    assert.equal(rack(restored).error, "");
  }
});
test("v4: incomplete or abnormal syringe check prevents Rack until corrected", () => {
  const x = complete();
  x.run("daily-syringe", "後方 syringe 組", "異常", { finding: "leak" });
  assert.match(rack(x).error, /尚未全部完成/);
  x.run("daily-syringe", "後方 syringe 組", "正常", { finding: "leak" });
  assert.equal(rack(x).error, "");
});
test("v4 rollout retains v3 initialization, Cleaning mode and nine groups", () => {
  assert.equal(supportsVersion("daily", legacyDailyV3), true);
  const state = initialEngine(legacyDailyV3);
  assert.equal(state.sim.dailyTasks, undefined);
  assert.equal(state.sim.reagents.length, 9);
  const result = scoreAttempt("daily", state, [], 0, 1000, legacyDailyV3);
  assert.equal(result.groups.length, 9);
});

test("v4 replacement does not substitute for inspecting all three ISE bottles", () => {
  const x = scenario();
  x.run("cover", "iseReagents", true);
  x.run("cover", "iseReference", true);
  for (const id of iseReagentIds) x.run("ise-reagent", id, "replace");
  assert.equal(
    tasksReadiness(x.state.sim.dailyTasks, x.state.sim.bottles).iseReady,
    false,
  );
  for (const id of iseReagentIds) x.run("ise-reagent", id, "inspect");
  assert.equal(
    tasksReadiness(x.state.sim.dailyTasks, x.state.sim.bottles).iseReady,
    true,
  );
  const full = complete();
  full.run("ise-reagent", "standard", "replace");
  const prime = full
    .score()
    .groups.flatMap((g) => g.items)
    .find((i) => i.id === "prime-1");
  assert.equal(prime.diagnosis.status, "配置變更後須重做");
});
