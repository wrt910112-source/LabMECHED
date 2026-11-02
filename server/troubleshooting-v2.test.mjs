import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialTroubleshooting,
  applyTroubleshooting,
  advanceTroubleshooting,
  previousTroubleVersion as troubleVersion,
  legacyTroubleVersion,
  troubleChecks,
  expectedPhrases,
  phraseText,
  gateForTrouble,
} from "../shared/troubleshooting.ts";
import {
  initialEngine,
  supportsVersion,
  applyCommand,
  scoreAttempt,
} from "../shared/exam.ts";
function fixture() {
  let state = initialTroubleshooting(troubleVersion),
    now = 1000;
  const f = {
    get state() {
      return state;
    },
    run(c, o = {}) {
      const r = applyTroubleshooting(state, c, ++now, o);
      state = r.state;
      return r;
    },
    ok(c, o = {}) {
      const r = f.run(c, o);
      assert.equal(r.error, "", JSON.stringify(c));
      return r;
    },
    finish() {
      now = state.pending?.due || now;
      state = advanceTroubleshooting(state, now);
    },
    prep(action, target, extra = {}) {
      return f.ok({
        action: "preparation",
        data: { action, ...(target ? { target } : {}), ...extra },
      });
    },
    original() {
      f.ok({ action: "select-result", target: "initial" });
      f.ok({
        action: "confirm-rule",
        value: "1.3S",
        data: { followup: "original" },
      });
      for (const target of ["qc", "reagent", "calibration"])
        f.ok({ action: "inspect", target });
      f.ok({ action: "open-original" });
      f.prep("place", "cup-1", { rack: "QC", slot: 1 });
      f.prep("stage", undefined, { rack: "QC" });
      f.prep("push", undefined, { rack: "QC" });
      assert.equal(state.results.length, 1);
      f.finish();
      f.ok({ action: "select-result", target: "original" });
      f.ok({
        action: "confirm-rule",
        value: "2.2S",
        data: { followup: "troubleshoot" },
      });
    },
    replace() {
      for (const target of ["main", "R1", "R2"])
        f.ok({ action: "cover", target, value: "open" });
      for (const target of ["R1", "R2"]) {
        f.ok({ action: "remove-old", target });
        f.ok({ action: "pour", target, value: target + "a" });
        f.ok({ action: "mix", target });
        f.ok({ action: "install", target, value: target });
      }
    },
    prepare() {
      f.prep("retrieve", undefined, { rack: "QC" });
      for (const [i, id, rack] of [
        [2, "water", "RB"],
        [3, "lcc1", "CALI"],
        [4, "uibc-primary", "QC"],
        [5, "uibc-second", "QC"],
      ]) {
        f.prep("select", `source:${id}`);
        f.prep("aspirate");
        f.prep("dispense", `cup-${i}`);
        f.prep("place", `cup-${i}`, { rack, slot: i });
      }
    },
    register() {
      f.ok({
        action: "batch-entry",
        data: {
          selection: {
            rb: ["27.UIBC"],
            cal: ["27.UIBC"],
            qc: ["27.UIBC"],
            sample: [],
          },
        },
      });
    },
    batch(action, options = {}) {
      return f.ok({ action, data: { racks: ["RB", "CALI", "QC"] } }, options);
    },
  };
  return f;
}
test("v2 confirms selected point plus rule and followup; original push alone runs179, v1 stays supported", () => {
  const f = fixture();
  assert.equal(f.state.version, troubleVersion);
  assert.ok(
    f.run({
      action: "confirm-rule",
      value: "1.3S",
      data: { followup: "original" },
    }).error,
  );
  f.ok({ action: "select-result", target: "initial" });
  assert.ok(
    f.run({
      action: "confirm-rule",
      value: "1.3S",
      data: { followup: "troubleshoot" },
    }).error,
  );
  f.original();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179],
  );
  assert.ok(
    troubleChecks(f.state)
      .slice(0, 4)
      .every((c) => c.done),
  );
  assert.equal(supportsVersion("troubleshooting", legacyTroubleVersion), true);
  assert.equal(
    initialEngine(legacyTroubleVersion).sim.troubleshooting.version,
    legacyTroubleVersion,
  );
});
test("v2 covers and context recipe are required; final install checks automatically without fresh-QC stage", () => {
  const f = fixture();
  f.original();
  assert.ok(f.run({ action: "remove-old", target: "R1" }).error);
  assert.ok(f.run({ action: "cover", target: "R1", value: "open" }).error);
  f.replace();
  assert.equal(f.state.reagent.checked, true);
  assert.equal(f.state.calibration, "required");
  assert.equal(troubleChecks(f.state)[4].done, true);
  assert.ok(f.state.log.some((r) => r.action === "自動Reagent Check"));
  assert.equal(f.state.results.length, 2);
});
test("v2 three-rack transaction requires RB,LCC1,new MAS1 and MAS3 then calibration before QC", () => {
  const f = fixture();
  f.original();
  f.replace();
  f.prepare();
  const before = structuredClone(f.state.preparation.racks);
  assert.ok(
    f.run({ action: "batch-stage", data: { racks: ["RB", "CALI", "QC"] } })
      .error,
  );
  assert.deepEqual(f.state.preparation.racks, before);
  f.register();
  assert.ok(
    f.run({ action: "batch-push", data: { racks: ["RB", "CALI"] } }).error,
  );
  f.batch("batch-stage");
  f.batch("batch-push");
  assert.equal(f.state.calibration, "running");
  assert.equal(f.state.results.length, 2);
  f.finish();
  assert.equal(f.state.calibration, "success");
  assert.equal(f.state.results.length, 2);
  assert.equal(f.state.pending.kind, "final");
  f.finish();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179, 155, 50],
  );
  assert.equal(f.state.qcRecovered, true);
  assert.equal(f.state.patientHold, true);
  assert.ok(
    troubleChecks(f.state)
      .slice(0, 7)
      .every((c) => c.done),
  );
  const count = f.state.results.length;
  f.batch("batch-push");
  assert.equal(f.state.results.length, count);
  for (const target of ["P01", "P02"]) f.ok({ action: "trace-check", target });
  f.ok({ action: "select-report", target: "UIBC_回溯報告.pdf" });
  f.ok({ action: "upload" });
  f.finish();
  for (const [target, ids] of Object.entries(expectedPhrases))
    f.ok({
      action: "save-phrases",
      target,
      data: { ids, text: phraseText(target, ids) },
    });
  f.ok({ action: "submit" });
  f.finish();
  assert.equal(f.state.submission, "sent-awaiting-review");
  const engine = initialEngine(troubleVersion);
  engine.sim.troubleshooting = f.state;
  assert.equal(
    scoreAttempt("troubleshooting", engine, [], 1, 1000, troubleVersion).score,
    100,
  );
});
test("v2 failed calibration cannot produce QC; changing mixture revokes load credit and preserves history", () => {
  const f = fixture();
  f.original();
  f.replace();
  f.prepare();
  f.register();
  f.batch("batch-stage");
  f.batch("batch-push", { calibrationOutcome: false });
  f.finish();
  assert.equal(f.state.calibration, "failed");
  assert.equal(f.state.pending, null);
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179],
  );
  f.batch("batch-retrieve");
  f.batch("batch-stage");
  f.batch("batch-push");
  f.finish();
  f.finish();
  assert.equal(f.state.qcRecovered, true);
  f.ok({ action: "remove-new", target: "R1" });
  assert.equal(f.state.qcRecovered, false);
  assert.equal(f.state.reagent.checked, false);
  assert.equal(f.state.preparation.racks.RB.loadedToken, null);
  assert.equal(f.state.results.length, 4);
});
