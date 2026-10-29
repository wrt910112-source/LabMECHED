import { test } from "node:test";
import assert from "node:assert/strict";
import {
  materials,
  calMaterials,
  qcMaterials,
  materialById,
  resolveMaterialName,
  legacyMaterialLabel,
  preparationRequirements,
  materialPreparationConditions,
  materialBottles,
} from "../shared/materialCatalog.ts";
import {
  initialPreparation,
  applyPreparation,
  preparationProgress,
  preparationGate,
} from "../shared/preparation.ts";
import { currentDailyVersion, legacyDailyV5 } from "../shared/dailyScenario.ts";
import {
  initialEngine,
  applyCommand,
  attemptChecks,
  attemptProgress,
  examPreparationGate,
} from "../shared/exam.ts";
import { complete } from "./daily-fixture.mjs";
const gate = { ready: true, token: "confirmed-test-session" };
test("free simulation accepts a partially dispensed AE cup without changing the assessed reducer rules", () => {
  let state = initialPreparation();
  for (const command of [
    { action: "select", target: "source:ae-1" },
    { action: "aspirate" },
    { action: "dispense", target: "cup-1" },
  ])
    state = applyPreparation(state, command, gate).state;
  const place = { action: "place", target: "cup-1", rack: "CALI", slot: 8 };
  assert.ok(applyPreparation(state, place, gate).error);
  const free = applyPreparation(state, place, gate, { freeSimulation: true });
  assert.equal(free.error, "");
  assert.equal(free.state.cups[0].additions, 1);
  assert.equal(free.state.cups[0].rack, "CALI");
  assert.equal(state.cups[0].rack, null);
});
function fillAll(x) {
  const slots = { RB: 10, CALI: 10, QC: 10 };
  preparationRequirements.forEach((r, i) => {
    const target = `cup-${i + 1}`;
    for (const data of [
      { action: "select", target: `source:${r.materialId}` },
      { action: "aspirate" },
      ...Array.from(
        { length: materialById[r.materialId].dose?.amount || 1 },
        () => ({ action: "dispense", target }),
      ),
      { action: "place", target, rack: r.rack, slot: slots[r.rack]-- },
    ])
      assert.equal(x.run("preparation", undefined, undefined, data).error, "");
  });
  for (const rack of ["QC", "RB", "CALI"])
    for (const action of ["stage", "push"])
      assert.equal(
        x.run("preparation", undefined, undefined, { action, rack }).error,
        "",
      );
}
test("catalog separates 14 CALI / 10 QC levels / water from fixed sixteen; uncertain aliases stay unresolved", () => {
  assert.equal(calMaterials.length, 14);
  assert.equal(qcMaterials.length, 10);
  const series = new Set(qcMaterials.map((m) => m.series));
  assert.equal(series.size, 5);
  assert.ok(
    [...series].every(
      (id) => qcMaterials.filter((m) => m.series === id).length === 2,
    ),
  );
  assert.equal(materials.length, 25);
  assert.equal(preparationRequirements.length, 16);
  assert.equal(new Set(preparationRequirements.map((r) => r.id)).size, 16);
  assert.equal(resolveMaterialName("U-CRE").id, resolveMaterialName("UCRE").id);
  assert.equal(materialById["mas-3"].concentration, "L3");
  assert.equal(materialById.etoh2.concentration, "100 mg/dL");
  assert.equal(materialById["ita-3"].concentration, "QC3");
  assert.equal(materialById["ita-3"].identity, "pending");
  assert.equal(resolveMaterialName("ITA-2"), undefined);
  assert.equal(resolveMaterialName("CRPG-2"), undefined);
  assert.equal(resolveMaterialName("CRPH-2"), undefined);
  assert.equal(materials.filter((m) => m.name === "CRPH-1").length, 1);
  assert.equal(legacyMaterialLabel("CRPG-2").raw, "CRPG-2");
  assert.match(materialById.system.storageText, /馬上使用/);
  assert.equal(
    materialById.lcc1.storage.find((s) => s.tests?.includes("TBIL")).duration,
    4,
  );
  assert.equal(materials.filter((m) => m.dose).length, 2);
  assert.ok(materials.every((m) => m.source.verifiedAgainstIFU === false));
  assert.ok(
    materials.every((m) => m.reconstitutionMl === null || m.dose === null),
  );
  assert.ok(!preparationRequirements.some((r) => r.label === "CHA-2"));
  assert.ok(preparationRequirements.some((r) => r.label === "CHA-3"));
  assert.equal(materialPreparationConditions["mas-3"].at(-1).minutes, 1080);
  assert.equal(materialPreparationConditions["mas-3"].at(-1).minimum, true);
  assert.equal(
    materialPreparationConditions.system.at(-1).operation,
    "use-immediately",
  );
  assert.ok(
    Object.values(materialBottles).every(
      (b) => b.expiresOn === null && b.expiryVerification === "pending",
    ),
  );
});
test("v6 full sixteen process yields thirteen equal groups; v5 scoring and twelve rules remain identical", () => {
  const x = complete("model", currentDailyVersion),
    old = complete("model", legacyDailyV5);
  assert.equal(x.score().score, 92.3);
  assert.equal(old.score().score, 100);
  assert.deepEqual(x.score().groups.slice(0, 12), old.score().groups);
  fillAll(x);
  assert.equal(x.score().groups.length, 13);
  assert.equal(x.score().score, 100);
  assert.deepEqual(
    attemptProgress("daily", x.state, x.events, currentDailyVersion),
    { completedGroups: 13, totalGroups: 13 },
  );
  const p = preparationProgress(
    x.state.sim.preparation,
    examPreparationGate(x.state, currentDailyVersion),
  );
  assert.equal(p.completed, 48);
  assert.deepEqual(x.state.sim.preparation.results, {
    calibration: "not-run",
    qc: "not-run",
  });
  assert.equal(
    x.state.sim.preparation.cups.find((c) => c.materialId === "mas-3")
      .concentration,
    "L3",
  );
  assert.equal(
    x.state.sim.preparation.cups.find((c) => c.materialId === "ita-3")
      .concentration,
    "QC3",
  );
  assert.equal(
    p.items.find((i) => i.materialId === "crp-b").identity,
    "pending",
  );
  assert.ok(
    p.items.every(
      (i) =>
        i.bottleExpiry === "pending" &&
        i.formalPosition === "pending" &&
        i.volume === "pending",
    ),
  );
  assert.equal(
    old.run("preparation", undefined, undefined, {
      action: "select",
      target: "source:lcc1",
    }).accepted,
    false,
  );
});
test("pipette remembers its aspirated source, AE needs two additions, occupied slots and wrong source never create credit", () => {
  let state = initialPreparation();
  const run = (data) => {
    const out = applyPreparation(state, data, gate);
    state = out.state;
    return out;
  };
  assert.ok(run({ action: "select", target: "source:constructor" }).error);
  assert.ok(run({ action: "select", target: 123 }).error);
  run({ action: "select", target: "source:ae-1" });
  run({ action: "aspirate" });
  run({ action: "select", target: "source:lcc1" });
  assert.equal(state.pipette.materialId, "ae-1");
  run({ action: "dispense", target: "cup-1" });
  assert.equal(preparationProgress(state, gate).dispensed, 0);
  assert.ok(
    run({ action: "place", target: "cup-1", rack: "QC", slot: 1 }).error,
  );
  run({ action: "dispense", target: "cup-1" });
  assert.equal(preparationProgress(state, gate).dispensed, 1);
  assert.ok(run({ action: "dispense", target: "cup-1" }).error);
  run({ action: "place", target: "cup-1", rack: "CALI", slot: 1 });
  assert.equal(preparationProgress(state, gate).racked, 0);
  run({ action: "place", target: "cup-1", rack: "QC", slot: 5 });
  assert.equal(preparationProgress(state, gate).racked, 1);
  run({ action: "aspirate" });
  run({ action: "dispense", target: "cup-2" });
  assert.ok(
    run({ action: "place", target: "cup-2", rack: "QC", slot: 5 }).error,
  );
  run({ action: "unrack", target: "cup-1" });
  run({ action: "place", target: "cup-2", rack: "CALI", slot: 1 });
  assert.equal(state.cups[0].slot, null);
  const before = JSON.stringify(state);
  assert.ok(run({ action: "push", rack: "QC" }).error);
  assert.equal(JSON.stringify(state), before);
});
test("partial racks remain incomplete; retrieving and emptying revoke only their own checkpoints", () => {
  let state = initialPreparation();
  const run = (data) => {
    const out = applyPreparation(state, data, gate);
    state = out.state;
    return out;
  };
  for (const data of [
    { action: "select", target: "source:water" },
    { action: "aspirate" },
    { action: "dispense", target: "cup-1" },
    { action: "place", target: "cup-1", rack: "RB", slot: 7 },
    { action: "stage", rack: "RB" },
    { action: "push", rack: "RB" },
  ])
    assert.equal(run(data).error, "");
  assert.equal(preparationProgress(state, gate).loaded, 1);
  assert.equal(preparationProgress(state, gate).done, false);
  assert.ok(run({ action: "push", rack: "RB" }).error);
  assert.ok(run({ action: "unrack", target: "cup-1" }).error);
  run({ action: "retrieve", rack: "RB" });
  assert.equal(preparationProgress(state, gate).loaded, 0);
  assert.equal(preparationProgress(state, gate).racked, 1);
  run({ action: "unrack", target: "cup-1" });
  assert.equal(preparationProgress(state, gate).racked, 0);
  assert.equal(preparationProgress(state, gate).dispensed, 1);
  run({ action: "empty", target: "cup-1" });
  assert.equal(preparationProgress(state, gate).dispensed, 0);
  run({ action: "select", target: "source:hdl" });
  run({ action: "aspirate" });
  run({ action: "dispense", target: "cup-1" });
  assert.equal(preparationProgress(state, gate).dispensed, 0);
});
test("upstream Rack invalidation clears credit, retains physical history and requires retrieve / stage / push again", () => {
  const x = complete("model", currentDailyVersion);
  fillAll(x);
  x.run("rack-qc-entry", undefined, undefined, { Serum: ["3.ALT"], Urine: [] });
  assert.equal(examPreparationGate(x.state, currentDailyVersion).ready, false);
  assert.ok(
    Object.values(x.state.sim.preparation.racks).every(
      (r) => r.location === "loaded" && r.loadedToken === null,
    ),
  );
  x.run("rack-qc-entry", undefined, undefined, {
    Serum: ["3.ALT"],
    Urine: ["9.CRE"],
  });
  assert.equal(examPreparationGate(x.state, currentDailyVersion).ready, true);
  assert.equal(
    preparationProgress(
      x.state.sim.preparation,
      examPreparationGate(x.state, currentDailyVersion),
    ).loaded,
    0,
  );
  for (const rack of ["RB", "CALI", "QC"])
    for (const action of ["retrieve", "stage", "push"])
      assert.equal(
        x.run("preparation", undefined, undefined, { action, rack }).error,
        "",
      );
  assert.equal(x.score().score, 100);
  const restored = JSON.parse(JSON.stringify(x.state));
  assert.deepEqual(
    preparationProgress(
      restored.sim.preparation,
      examPreparationGate(restored, currentDailyVersion),
    ),
    preparationProgress(
      x.state.sim.preparation,
      examPreparationGate(x.state, currentDailyVersion),
    ),
  );
});
test("invalid gates and legacy versions cannot manufacture progress via client flags; select is read-only progress", () => {
  let state = initialEngine(currentDailyVersion);
  const selected = applyCommand(
    state,
    "daily",
    {
      type: "preparation",
      data: { action: "select", target: "source:lcc1", completed: true },
    },
    1000,
    currentDailyVersion,
  );
  assert.equal(selected.accepted, true);
  state = selected.state;
  assert.equal(
    attemptChecks("daily", state, [], currentDailyVersion).at(-1).proportion,
    0,
  );
  assert.equal(
    applyCommand(
      state,
      "daily",
      { type: "preparation", data: { action: "aspirate" } },
      2000,
      currentDailyVersion,
    ).accepted,
    false,
  );
  assert.equal(
    applyCommand(
      initialEngine(legacyDailyV5),
      "daily",
      { type: "preparation", data: { action: "reset" } },
      2000,
      legacyDailyV5,
    ).accepted,
    false,
  );
  assert.equal(
    preparationGate(true, { Serum: { qc: ["b", "a"] } }, "x").token,
    preparationGate(true, { Serum: { qc: ["a", "b"] } }, "x").token,
  );
});
