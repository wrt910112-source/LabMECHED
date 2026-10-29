import { test } from "node:test";
import assert from "node:assert/strict";
import { troubleFixture } from "./troubleshooting-fixture.mjs";
import {
  sdi,
  qcRule,
  chartRows,
  levels,
  troubleChecks,
  readyToSend,
  phraseText,
  expectedPhrases,
  traceRows,
  differencePercent,
  traceAcceptable,
  troubleVersion,
} from "../shared/troubleshooting.ts";
import {
  initialEngine,
  scoreAttempt,
  applyCommand,
  supportsVersion,
} from "../shared/exam.ts";
import { createApplication } from "./index.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("UIBC fixed data use shared SDI, same-level adjacent 2.2S and strict retrospective comparison", () => {
  assert.equal(sdi("primary", 183), 3.25);
  assert.equal(qcRule("primary", 183, 156), "1.3S");
  assert.equal(sdi("primary", 179), 2.75);
  assert.equal(qcRule("primary", 179, 183), "2.2S");
  assert.equal(qcRule("primary", 179, 141), "");
  assert.equal(qcRule("primary", 173, 183), "");
  assert.equal(sdi("primary", 155), -0.25);
  assert.ok(Math.abs(sdi("second", 50) + 0.05479452055) < 1e-9);
  assert.equal(differencePercent(322, 320).toFixed(2), "0.62");
  assert.equal(differencePercent(167, 165).toFixed(2), "1.20");
  assert.equal(traceAcceptable(1000, 898), false);
  assert.equal(traceAcceptable(1000, 899), true);
  assert.equal(traceRows.length, 2);
});
test("UIBC complete twelve-step process scores 100, preserves abnormal history and awaits supervisor", () => {
  const f = troubleFixture();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183],
  );
  assert.equal(chartRows(f.state, "second").length, 12);
  assert.ok(f.run({ action: "run", target: "original" }).error);
  assert.equal(f.state.results.length, 1);
  f.original();
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179],
  );
  f.fresh();
  assert.equal(f.state.results.at(-1).value, null);
  assert.equal(chartRows(f.state, "primary").length, 14);
  f.replace();
  assert.equal(f.state.calibration, "required");
  assert.ok(f.run({ action: "run", target: "final" }).error);
  f.calibrate();
  assert.equal(f.state.calibration, "success");
  assert.equal(f.state.qcRecovered, false);
  assert.equal(f.state.results.length, 3);
  f.finalQc();
  assert.equal(f.state.qcRecovered, true);
  assert.deepEqual(
    f.state.results.map((r) => r.value),
    [183, 179, null, 155, 50],
  );
  assert.equal(chartRows(f.state, "primary").length, 15);
  assert.equal(chartRows(f.state, "second").length, 13);
  for (const id of ["P01", "P02"]) f.ok({ action: "trace-check", target: id });
  f.ok({ action: "select-report", target: "UIBC_回溯報告.pdf" });
  f.ok({ action: "upload" });
  assert.equal(f.state.report.status, "uploading");
  f.finish();
  for (const [target, ids] of Object.entries(expectedPhrases))
    f.ok({
      action: "save-phrases",
      target,
      data: { ids, text: phraseText(target, ids) },
    });
  assert.equal(readyToSend(f.state), true);
  f.ok({ action: "submit" });
  assert.equal(f.state.submission, "sending");
  f.finish();
  assert.equal(f.state.submission, "sent-awaiting-review");
  assert.equal(f.state.patientHold, true);
  assert.ok(troubleChecks(f.state).every((c) => c.done));
  const engine = initialEngine(troubleVersion);
  engine.sim.troubleshooting = f.state;
  const score = scoreAttempt(
    "troubleshooting",
    engine,
    [],
    1,
    10000,
    troubleVersion,
  );
  assert.equal(score.score, 100);
  assert.equal(score.groups.length, 12);
  assert.ok(f.run({ action: "submit" }).error);
  assert.ok(f.state.log.some((r) => r.action.includes("remove-old")));
  assert.ok(f.state.log.some((r) => r.target === "fresh"));
});
test("old bottles occupy slots; omitted removal, mix and wrong pairing cannot pass Reagent Check", () => {
  const f = troubleFixture();
  f.original();
  f.fresh();
  assert.ok(f.run({ action: "install", target: "R1", value: "R1" }).error);
  assert.equal(f.state.reagent.slots.R1, "old-R1");
  f.ok({ action: "remove-old", target: "R1" });
  assert.equal(f.state.calibration, "required");
  assert.equal(f.state.reagent.old.R2, true);
  assert.ok(f.run({ action: "pour", target: "R1", value: "R2a" }).error);
  assert.equal(f.state.reagent.mix.R1.source, "R2a");
  assert.ok(f.run({ action: "reagent-check" }).error);
  f.ok({ action: "reset-reagent", target: "R1" });
  f.ok({ action: "pour", target: "R1", value: "R1a" });
  f.ok({ action: "install", target: "R1", value: "R1" });
  assert.ok(f.run({ action: "reagent-check" }).error);
  f.ok({ action: "mix", target: "R1" });
  assert.ok(f.run({ action: "reagent-check" }).error);
  assert.equal(f.state.reagent.checked, false);
  const gen = f.state.reagent.generation;
  f.ok({ action: "remove-old", target: "R1" });
  assert.equal(f.state.reagent.generation, gen);
});
test("calibration failure and reagent changes retain interlocks and never relabel old accepted QC", () => {
  const f = troubleFixture();
  f.original();
  f.fresh();
  f.replace();
  f.calibrate({ calibrationOutcome: false });
  assert.equal(f.state.calibration, "failed");
  assert.equal(f.state.results.length, 3);
  assert.ok(f.run({ action: "run", target: "final" }).error);
  f.ok({ action: "run", target: "calibration" });
  f.finish();
  f.finalQc();
  assert.equal(f.state.qcRecovered, true);
  const oldIds = f.state.results
    .filter((r) => r.stage === "final")
    .map((r) => r.id);
  f.ok({ action: "remove-new", target: "R1" });
  assert.equal(f.state.qcRecovered, false);
  assert.equal(f.state.calibration, "required");
  assert.equal(f.state.results.length, 5);
  f.ok({ action: "install", target: "R1", value: "R1" });
  f.ok({ action: "reagent-check" });
  assert.ok(f.run({ action: "run", target: "calibration" }).error);
  f.prep("retrieve", undefined, { rack: "CALI" });
  f.prep("stage", undefined, { rack: "CALI" });
  f.prep("push", undefined, { rack: "CALI" });
  f.ok({ action: "run", target: "calibration" });
  f.finish();
  for (const target of oldIds) f.ok({ action: "review-result", target });
  assert.equal(f.state.qcRecovered, false);
});

test("UIBC preparation may precede old-bottle removal; wrong banks and malformed commands preserve evidence without credit", () => {
  const f = troubleFixture();
  f.original();
  f.fresh();
  for (const target of ["R1", "R2"]) {
    f.ok({ action: "pour", target, value: target + "a" });
    f.ok({ action: "mix", target });
    assert.ok(f.run({ action: "install", target, value: target }).error);
    f.ok({ action: "remove-old", target });
  }
  f.ok({ action: "install", target: "R1", value: "R2" });
  f.ok({ action: "install", target: "R2", value: "R1" });
  assert.ok(f.run({ action: "reagent-check" }).error);
  assert.equal(f.state.reagent.checked, false);
  f.ok({ action: "remove-new", target: "R1" });
  f.ok({ action: "remove-new", target: "R2" });
  f.ok({ action: "install", target: "R1", value: "R1" });
  f.ok({ action: "install", target: "R2", value: "R2" });
  f.ok({ action: "reagent-check" });
  for (const command of [
    null,
    {},
    { action: "mix", target: {} },
    { action: "rack-entry", data: {} },
  ])
    assert.ok(f.run(command).error);
  assert.equal(f.state.calibration, "required");
  assert.ok(f.state.log.some((entry) => !entry.ok));
});
test("duplicate runs, wrong or reused aliquots, incomplete forms and failed upload do not manufacture completion", () => {
  const f = troubleFixture();
  f.original();
  f.ok({ action: "run", target: "original" });
  assert.equal(f.state.results.length, 2);
  f.ok({ action: "replace-qc" });
  assert.ok(f.run({ action: "run", target: "fresh" }).error);
  f.fresh();
  f.replace();
  f.calibrate();
  assert.ok(f.run({ action: "run", target: "final" }).error);
  assert.ok(f.run({ action: "submit" }).error);
  f.finalQc();
  f.ok({ action: "trace-check", target: "P01" });
  f.ok({ action: "select-report", target: "UIBC_回溯報告.pdf" });
  assert.ok(f.run({ action: "upload" }).error);
  f.ok({ action: "trace-check", target: "P02" });
  f.ok({ action: "upload" }, { uploadOutcome: false });
  f.finish();
  assert.equal(f.state.report.status, "failed");
  assert.equal(readyToSend(f.state), false);
  f.ok({ action: "upload" });
  f.finish();
  assert.equal(f.state.report.status, "success");
  f.ok({ action: "upload" });
  assert.equal(f.state.pending, null);
  f.ok({
    action: "save-phrases",
    target: "cause",
    data: { ids: ["A1"], text: phraseText("cause", ["A1"]) },
  });
  assert.equal(readyToSend(f.state), false);
  assert.ok(f.run({ action: "submit" }).error);
  const restored = JSON.parse(JSON.stringify(f.state));
  assert.deepEqual(troubleChecks(restored), troubleChecks(f.state));
  assert.equal(restored.version, troubleVersion);
  assert.equal(supportsVersion("troubleshooting", troubleVersion), true);
  assert.equal(supportsVersion("troubleshooting", "AU5800-2026-10-v1"), false);
  assert.equal(
    applyCommand(
      initialEngine(),
      "daily",
      { type: "troubleshooting", data: { action: "submit" } },
      1000,
    ).accepted,
    false,
  );
});
test("UIBC API uses existing transactions, resumes a new kind, deduplicates events and freezes incomplete submission", async () => {
  const folder = mkdtempSync(join(tmpdir(), "au5800-uibc-")),
    app = createApplication({ dbPath: join(folder, "exam.sqlite") });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  let cookie = "";
  const request = async (path, body) => {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: response.status, body: await response.json() };
  };
  try {
    await request("/auth/setup", {
      username: "teacher",
      name: "UIBC teacher",
      password: "Testing123!",
    });
    await request("/auth/login", {
      username: "teacher",
      password: "Testing123!",
    });
    const start = await request("/attempts", { kind: "troubleshooting" });
    assert.equal(start.status, 201);
    const a = start.body.attempt;
    assert.equal(a.version, troubleVersion);
    assert.equal(a.progress.totalGroups, 12);
    const event = {
      id: "uibc-event-initial-review-0001",
      revision: a.revision,
      source: "workstation",
      command: {
        type: "troubleshooting",
        data: { action: "review-result", target: "initial" },
      },
    };
    const first = await request(`/attempts/${a.id}/events`, event),
      duplicate = await request(`/attempts/${a.id}/events`, event);
    assert.equal(first.status, 200);
    assert.equal(duplicate.body.attempt.revision, first.body.attempt.revision);
    assert.equal(
      (
        await request(`/attempts/${a.id}/events`, {
          ...event,
          id: "uibc-event-stale-revision-0002",
        })
      ).status,
      409,
    );
    const resumed = (await request("/attempts/active")).body.attempt;
    assert.equal(resumed.startedAt, a.startedAt);
    assert.deepEqual(
      resumed.sim.troubleshooting.results.map((r) => r.value),
      [183],
    );
    const finish = await request(`/attempts/${a.id}/submit`, {
      revision: resumed.revision,
    });
    assert.equal(finish.status, 200);
    assert.equal(finish.body.attempt.status, "submitted");
    assert.equal(finish.body.attempt.result.groups.length, 12);
    assert.ok(finish.body.attempt.result.score < 100);
    const again = await request(`/attempts/${a.id}/submit`, { revision: 0 });
    assert.deepEqual(again.body.attempt.result, finish.body.attempt.result);
  } finally {
    await app.close();
  }
});
