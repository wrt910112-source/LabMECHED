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
  hasPreparation,
  legacyDailyV5 as dailyRubricVersion,
  legacyDailyV3,
} from "../shared/dailyScenario.ts";

function scenario(source = "model", restored, version = dailyRubricVersion) {
  let state = restored || initialEngine(version),
    now = 1000;
  const events = [];
  const run = (type, target, value, data) => {
    const command = { type, target, value, data };
    const out = applyCommand(state, "daily", command, (now += 100), version);
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
    version,
    run,
    get state() {
      return state;
    },
    events,
    score: () => scoreAttempt("daily", state, events, 1000, now, version),
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
  if (hasPreparation(x.version)) x.run("maintenance", "analyzer", true);
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
function complete(source = "model", version = dailyRubricVersion) {
  const x = scenario(source, undefined, version);
  const current = hasPreparation(version);
  manual(x);
  if (current) x.run("maintenance", "analyzer", false);
  clean(x);
  iseBottles(x);
  primeCal(x);
  supplies(x);
  if (current) x.run("maintenance", "analyzer", false);
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

export {
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
};
