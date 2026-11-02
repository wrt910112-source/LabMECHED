import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialTroubleshooting,
  applyTroubleshooting,
  advanceTroubleshooting,
  manualTroubleVersion as troubleVersion,
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
export function fixture(version = troubleVersion) {
  let state = initialTroubleshooting(version),
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
