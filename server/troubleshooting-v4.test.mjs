import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./troubleshooting-v3-fixture.mjs";
import {
  troubleVersion,
  troubleVersions,
  finalQcAssessment,
  troubleChecks,
  applyTroubleshooting,
} from "../shared/troubleshooting.ts";
import { supportsVersion, initialEngine } from "../shared/exam.ts";

function completedRuns(version = troubleVersion, outcome = true) {
  const f = fixture(version);
  f.original();
  f.replace();
  for (const target of ["R1", "R2", "main"])
    f.ok({ action: "cover", target, value: "close" });
  f.ok({ action: "reagent-check" });
  f.ok({ action: "review-reagent-update" });
  f.register();
  f.prepare();
  f.batch("batch-stage");
  f.batch("batch-push", { calibrationOutcome: outcome });
  f.finish();
  f.finish();
  return f;
}
test("v4 executes both levels before requiring explicit QC interpretation; viewing alone cannot unlock retrospective checks", () => {
  const f = completedRuns();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179, 155, 50],
  );
  assert.equal(f.state.calibration, "success");
  assert.equal(f.state.qcRecovered, false);
  assert.equal(troubleChecks(f.state)[6].done, false);
  assert.ok(f.run({ action: "trace-check", target: "P01" }).error);
  const rows = finalQcAssessment(f.state);
  assert.deepEqual(
    rows.map((r) => [r.result.value, r.min, r.max, r.accepted]),
    [
      [155, 141, 173, true],
      [50, 35.8, 65, true],
    ],
  );
  assert.equal(rows[0].sdi, -0.25);
  assert.ok(Math.abs(rows[1].sdi + 0.0547945205) < 1e-9);
  for (const r of rows) {
    f.ok({ action: "review-result", target: r.result.id });
    f.ok({ action: "select-result", target: r.result.id });
  }
  assert.equal(f.state.qcRecovered, false);
  f.ok({ action: "confirm-qc" });
  assert.equal(f.state.qcRecovered, true);
  assert.equal(troubleChecks(f.state)[6].done, true);
  assert.equal(f.state.patientHold, true);
  f.ok({ action: "confirm-qc" });
  assert.equal(f.state.results.length, 4);
  f.ok({ action: "trace-check", target: "P01" });
});
test("v4 rejects early, missing, out-of-range, failed or stale QC confirmation", () => {
  assert.ok(fixture(troubleVersion).run({ action: "confirm-qc" }).error);
  const failed = completedRuns(troubleVersion, false);
  assert.equal(failed.state.results.length, 2);
  assert.ok(failed.run({ action: "confirm-qc" }).error);
  const f = completedRuns();
  for (const mutate of [
    (s) => {
      s.results = s.results.filter((r) => r.level !== "second");
    },
    (s) => {
      s.results.find((r) => r.level === "second").value = 65.01;
    },
    (s) => {
      s.results.find((r) => r.level === "second").value = null;
    },
    (s) => {
      s.reagent.generation++;
    },
    (s) => {
      s.calibration = "failed";
    },
  ]) {
    const s = structuredClone(f.state);
    mutate(s);
    const result = applyTroubleshooting(s, { action: "confirm-qc" }, 99999);
    assert.ok(result.error);
    assert.equal(result.state.qcRecovered, false);
  }
  f.ok({ action: "confirm-qc" });
  f.ok({ action: "cover", target: "main", value: "open" });
  f.ok({ action: "cover", target: "R1", value: "open" });
  f.ok({ action: "remove-new", target: "R1" });
  assert.equal(f.state.qcRecovered, false);
  assert.ok(f.run({ action: "confirm-qc" }).error);
  assert.equal(f.state.results.length, 4);
});
test("v1-v3 exams remain supported and v3 keeps its automatic recovery behavior", () => {
  for (const version of troubleVersions) {
    assert.equal(supportsVersion("troubleshooting", version), true);
    assert.equal(initialEngine(version).sim.troubleshooting.version, version);
  }
  const old = completedRuns("AU5800-UIBC-2026-10-30-v3");
  assert.equal(old.state.qcRecovered, true);
  assert.equal(troubleChecks(old.state)[6].done, true);
});
