import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialEngine,
  applyCommand,
  attemptProgress,
  attemptChecks,
  scoreAttempt,
  dailyRubricVersion,
  rubricVersion,
  previousDailyRubricVersion,
  weeklyRubricVersion,
} from "../shared/exam.ts";
import {
  legacyDailyV3,
  legacyDailyV4,
  legacyDailyV5,
  legacyWeeklyV2,
} from "../shared/dailyScenario.ts";
import { createApplication } from "./index.mjs";
import { randomUUID } from "node:crypto";

test("HUD progress is read-only, version-aware and exactly agrees with existing completed score groups", () => {
  for (const [kind, version] of [
    ["daily", rubricVersion],
    ["daily", previousDailyRubricVersion],
    ["daily", legacyDailyV3],
    ["daily", dailyRubricVersion],
    ["daily", legacyDailyV4],
    ["daily", legacyDailyV5],
    ["weekly", rubricVersion],
    ["weekly", weeklyRubricVersion],
    ["weekly", legacyWeeklyV2],
  ]) {
    let state = initialEngine(version);
    const events = [];
    const before = JSON.stringify(state);
    const progress = attemptProgress(kind, state, events, version);
    assert.deepEqual(Object.keys(progress).sort(), [
      "completedGroups",
      "totalGroups",
    ]);
    assert.equal(JSON.stringify(state), before);
    const checks = attemptChecks(kind, state, events, version);
    assert.equal(
      progress.completedGroups,
      checks.filter((g) => g.items.every((i) => i.completed)).length,
    );
    assert.equal(
      progress.totalGroups,
      scoreAttempt(kind, state, events, 1000, 2000, version).groups.length,
    );
    if (kind === "daily") {
      const command = {
        type: "temperature",
        data: { bath: "37", coolant: "8" },
      };
      const out = applyCommand(state, kind, command, 2100, version);
      state = out.state;
      events.push({
        id: "temperature",
        at: 2100,
        source: "workstation",
        command,
        accepted: out.accepted,
        label: out.label,
        error: out.error,
      });
      const result = scoreAttempt(kind, state, events, 1000, 2200, version);
      assert.equal(
        attemptProgress(kind, state, events, version).completedGroups,
        result.groups.filter((g) => g.items.every((i) => i.completed)).length,
      );
    }
  }
});

test("active attempt API exposes aggregate progress only and viewing it does not submit or advance a checklist", async () => {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  let cookie = "";
  async function request(path, body) {
    const response = await fetch(
      `http://127.0.0.1:${app.server.address().port}/api${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", cookie },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    assert.ok(response.ok, `${path}: ${response.status}`);
    return response.json();
  }
  try {
    await request("/auth/setup", {
      username: "teacher",
      name: "Teacher",
      password: "Testing123!",
    });
    const { attempt } = await request("/attempts", { kind: "daily" });
    assert.deepEqual(attempt.progress, { completedGroups: 0, totalGroups: 13 });
    assert.equal(attempt.result, null);
    assert.equal(attempt.events, undefined);
    const viewed = (await request(`/attempts/${attempt.id}`)).attempt;
    assert.equal(viewed.revision, 0);
    assert.equal(viewed.status, "active");
    assert.deepEqual(viewed.progress, attempt.progress);
    const event = {
      id: randomUUID(),
      revision: 0,
      source: "workstation",
      command: { type: "temperature", data: { bath: "37", coolant: "8" } },
    };
    const saved = (await request(`/attempts/${attempt.id}/events`, event))
      .attempt;
    assert.deepEqual(saved.progress, { completedGroups: 1, totalGroups: 13 });
    assert.deepEqual(Object.keys(saved.progress).sort(), [
      "completedGroups",
      "totalGroups",
    ]);
    assert.equal(saved.result, null);
    assert.equal(saved.events, undefined);
    const replay = (await request(`/attempts/${attempt.id}/events`, event))
      .attempt;
    assert.equal(replay.revision, saved.revision);
    assert.deepEqual(replay.progress, saved.progress);
  } finally {
    await app.close();
  }
});
