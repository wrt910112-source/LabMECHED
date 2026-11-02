import assert from "node:assert/strict";
import {
  initialTroubleshooting,
  applyTroubleshooting,
  advanceTroubleshooting,
} from "../shared/troubleshooting.ts";
export function troubleFixture() {
  let state = initialTroubleshooting("AU5800-UIBC-2026-10-29-v1"),
    now = 10000;
  const fixture = {
    get state() {
      return state;
    },
    run(command, options = {}) {
      const result = applyTroubleshooting(state, command, ++now, options);
      state = result.state;
      return result;
    },
    ok(command, options = {}) {
      const result = fixture.run(command, options);
      assert.equal(result.error, "", JSON.stringify(command));
      return result;
    },
    finish() {
      now = state.pending?.due ?? now;
      state = advanceTroubleshooting(state, now);
      return state;
    },
    prep(action, target, extra = {}) {
      return fixture.ok({
        action: "preparation",
        data: { action, ...(target ? { target } : {}), ...extra },
      });
    },
    fill(source, cup) {
      fixture.prep("select", `source:${source}`);
      fixture.prep("aspirate");
      fixture.prep("dispense", cup);
    },
    load(cup, rack, slot) {
      if (state.preparation.racks[rack].location !== "bench")
        fixture.prep("retrieve", undefined, { rack });
      fixture.prep("place", cup, { rack, slot });
      fixture.prep("stage", undefined, { rack });
      fixture.prep("push", undefined, { rack });
    },
    original() {
      fixture.ok({ action: "review-result", target: "initial" });
      fixture.ok({ action: "view", target: "chart" });
      for (const target of ["qc", "reagent", "calibration"])
        fixture.ok({ action: "inspect", target });
      fixture.ok({ action: "confirm-rule", value: "1.3S" });
      fixture.ok({
        action: "verify-original",
        data: { test: "UIBC", specimen: "MAS27091", cup: "cup-1" },
      });
      fixture.load("cup-1", "QC", 9);
      fixture.ok({ action: "run", target: "original" });
      fixture.finish();
      fixture.ok({ action: "review-result", target: "original" });
      fixture.ok({ action: "confirm-rule", value: "2.2S" });
    },
    fresh() {
      fixture.ok({ action: "replace-qc" });
      fixture.fill("uibc-primary", "cup-2");
      fixture.load("cup-2", "QC", 8);
      fixture.ok({ action: "run", target: "fresh" });
      fixture.finish();
    },
    replace() {
      for (const target of ["R1", "R2"]) {
        fixture.ok({ action: "remove-old", target });
        fixture.ok({ action: "pour", target, value: target + "a" });
        fixture.ok({ action: "mix", target });
        fixture.ok({ action: "install", target, value: target });
      }
      fixture.ok({ action: "reagent-check" });
    },
    calibrate(options = {}) {
      fixture.ok({
        action: "rack-entry",
        data: {
          type: "Serum",
          category: "calibration",
          selection: { rb: [], cal: ["27.UIBC"], qc: [], sample: [] },
        },
      });
      fixture.fill("lcc2", "cup-3");
      fixture.load("cup-3", "CALI", 4);
      fixture.ok({ action: "run", target: "calibration" }, options);
      fixture.finish();
    },
    finalQc() {
      fixture.ok({
        action: "rack-entry",
        data: {
          type: "Serum",
          category: "qc",
          selection: { rb: [], cal: [], qc: ["27.UIBC"], sample: [] },
        },
      });
      fixture.fill("uibc-primary", "cup-4");
      fixture.fill("uibc-second", "cup-5");
      fixture.prep("retrieve", undefined, { rack: "QC" });
      fixture.prep("place", "cup-4", { rack: "QC", slot: 6 });
      fixture.prep("place", "cup-5", { rack: "QC", slot: 2 });
      fixture.prep("stage", undefined, { rack: "QC" });
      fixture.prep("push", undefined, { rack: "QC" });
      fixture.ok({ action: "run", target: "final" });
      fixture.finish();
      for (const r of state.results.filter((r) => r.stage === "final"))
        fixture.ok({ action: "review-result", target: r.id });
    },
  };
  return fixture;
}
