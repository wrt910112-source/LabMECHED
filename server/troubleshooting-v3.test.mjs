import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./troubleshooting-v3-fixture.mjs";
import {
  manualTroubleVersion as troubleVersion,
  previousTroubleVersion,
  legacyTroubleVersion,
  troubleChecks,
  initialTroubleshooting,
  formTextMatches,
  applyTroubleshooting,
} from "../shared/troubleshooting.ts";
import { supportsVersion } from "../shared/exam.ts";
function closedChecked(f, review = true) {
  for (const target of ["R1", "R2", "main"])
    f.ok({ action: "cover", target, value: "close" });
  f.ok({ action: "reagent-check" });
  if (review) f.ok({ action: "review-reagent-update" });
}
test("v3 explicitly closes three covers, runs check and inspects UIBC RB/CALI; placing bottles alone earns no completion", () => {
  const f = fixture();
  f.original();
  assert.ok(f.run({ action: "reagent-check" }).error);
  f.replace();
  assert.equal(f.state.reagent.checked, false);
  assert.equal(troubleChecks(f.state)[4].done, false);
  assert.ok(f.run({ action: "review-reagent-update" }).error);
  assert.ok(f.run({ action: "reagent-check" }).error);
  assert.ok(f.run({ action: "cover", target: "main", value: "close" }).error);
  f.ok({ action: "cover", target: "R1", value: "close" });
  assert.ok(f.run({ action: "reagent-check" }).error);
  f.ok({ action: "cover", target: "R2", value: "close" });
  f.ok({ action: "cover", target: "main", value: "close" });
  f.ok({ action: "reagent-check" });
  assert.equal(f.state.reagent.checked, true);
  assert.equal(f.state.reagent.updateReviewed, false);
  assert.equal(troubleChecks(f.state)[4].done, false);
  f.ok({ action: "review-reagent-update" });
  assert.equal(troubleChecks(f.state)[4].done, true);
  assert.equal(f.state.calibration, "required");
  assert.equal(f.state.qcRecovered, false);
});
test("v3 batch cannot bypass closed-cover check or final review; physical changes revoke both and retain results", () => {
  const f = fixture();
  f.original();
  f.replace();
  f.prepare();
  f.register();
  assert.ok(
    f.run({ action: "batch-stage", data: { racks: ["RB", "CALI", "QC"] } })
      .error,
  );
  closedChecked(f, false);
  assert.ok(
    f.run({ action: "batch-stage", data: { racks: ["RB", "CALI", "QC"] } })
      .error,
  );
  f.ok({ action: "review-reagent-update" });
  f.batch("batch-stage");
  f.batch("batch-push");
  f.finish();
  f.finish();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179, 155, 50],
  );
  assert.ok(f.run({ action: "remove-new", target: "R1" }).error);
  f.ok({ action: "cover", target: "main", value: "open" });
  f.ok({ action: "cover", target: "R1", value: "open" });
  f.ok({ action: "remove-new", target: "R1" });
  assert.equal(f.state.reagent.checked, false);
  assert.equal(f.state.reagent.updateReviewed, false);
  assert.equal(f.state.calibration, "required");
  assert.equal(f.state.qcRecovered, false);
  assert.equal(f.state.results.length, 4);
});
test("v3 result phrases allow either line order, while v1/v2 keep their original validation and versions", () => {
  const ids = ["C3", "C1"],
    text = "進行檢體回溯，待合批收。\n品管合格";
  const f = fixture();
  f.ok({ action: "save-phrases", target: "results", data: { ids, text } });
  assert.equal(troubleChecks(f.state)[10].done, true);
  assert.equal(
    formTextMatches(f.state, "results", text + "\n未核准", ids),
    false,
  );
  for (const version of [legacyTroubleVersion, previousTroubleVersion]) {
    const old = initialTroubleshooting(version);
    assert.equal(supportsVersion("troubleshooting", version), true);
    assert.equal(formTextMatches(old, "results", text, ["C1", "C3"]), false);
  }
  assert.equal(f.state.version, troubleVersion);
});
