import { reloadExamWindow } from "./ui";
import { createApplication } from "../server/index.mjs";
import { seedAccount } from "../server/account-fixture.mjs";
import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { completeTroubleUi } from "./troubleshooting-v2-ui";
import { completeTroubleUi as legacyUi } from "./troubleshooting-ui";
import { DatabaseSync } from "node:sqlite";
import { initialEngine } from "../shared/exam";
let backend: ChildProcess;
let testDbPath: string;
const serverURL = "http://127.0.0.1:3003";
test.beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "uibc-browser-"));
  testDbPath = join(dir, "test.sqlite");
  const setup = createApplication({ dbPath: testDbPath });
  await seedAccount(setup.db);
  setup.db.close();
  backend = spawn(process.execPath, [resolve("server/index.mjs")], {
    env: {
      ...process.env,
      AU5800_PORT: "3003",
      AU5800_DB: join(dir, "test.sqlite"),
    },
    windowsHide: true,
    stdio: "pipe",
  });
  let error = "";
  backend.stderr?.on("data", (c) => (error += c));
  for (let i = 0; i < 100; i++) {
    if (backend.exitCode !== null) throw Error(error);
    try {
      if ((await fetch(serverURL + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("UIBC test server did not start");
});
test.afterAll(async () => {
  if (backend?.exitCode === null) {
    const ended = new Promise((r) => backend.once("exit", r));
    backend.kill();
    await ended;
  }
});
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(30000);
  await page.route("**/api/**", async (route) => {
    try {
      const response = await route.fetch({
        maxRetries: 1,
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.fulfill({ response, body: await response.body() });
    } catch (error) {
      if (
        !page.isClosed() &&
        !/Fetch response has been disposed|Target page, context or browser has been closed/.test(
          String(error),
        )
      )
        throw error;
    }
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

test.beforeEach(async ({ page }) => {
  await page.request.post(serverURL + "/api/auth/login", {
    data: { username: "teacher", password: "Testing123!" },
  });
});

test("UIBC practice completes all twelve steps with original cups, both old reagents removed and real LIS controls", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: /04.*障礙排除/ }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  const beforeReference = await page.locator(".trouble-hud h2").textContent();
  await page.locator('[data-guide="nav-sop"]').click();
  await expect(
    page.getByAltText("檢驗科生化組品管異常處理流程圖原圖"),
  ).toBeVisible();
  await page.getByRole("button", { name: "放大流程圖", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "QC異常處理流程圖原圖" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉流程圖", exact: true }).click();
  await expect(page.locator(".trouble-hud h2")).toHaveText(beforeReference!);
  await page.locator('[data-guide="nav-approval"]').click();
  const result = await completeTroubleUi(page, info);
  await expect(result.room.locator(".trouble-hint")).toBeVisible();
  await result.b("收合任務資訊").click();
  await expect(result.room.locator(".trouble-hint")).not.toBeVisible();
  await result.b("展開任務資訊").click();
  await result.b("檢視操作紀錄").click();
  await expect(
    result.room.getByRole("table", { name: "UIBC 操作紀錄" }),
  ).toContainText("remove-old UIBC R1");
  await expect(page.locator(".practice-session-bar")).toContainText(
    "本輪已完成並封存",
  );
  const completed = await page.evaluate(
    async () => (await (await fetch("/api/analytics/me")).json()).sessions,
  );
  // Admin test rounds are intentionally excluded from learner analytics.
  expect(completed).toEqual([]);
  await page
    .locator(".practice-session-bar")
    .getByRole("button", { name: "開始新一輪", exact: true })
    .click();
  await expect(page.locator(".trouble-room")).toContainText("步驟 1／12");
  await page
    .locator(".practice-session-bar")
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: /04.*障礙排除/ }).click();
  await page.getByRole("button", { name: "繼續練習", exact: true }).click();
  await expect(page.locator(".trouble-room")).toContainText("步驟 1／12");
  expect(errors).toEqual([]);
});
test("UIBC exam preserves state and time through reload and lost-save retry without answer guidance", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.locator(".exam-login [name=username]").fill("teacher");
  await page.locator(".exam-login [name=password]").fill("Testing123!");
  await page
    .locator(".exam-login")
    .getByRole("button", { name: "登入", exact: true })
    .click();
  await page.getByRole("button", { name: "任務選單", exact: true }).click();
  await page
    .locator(".mission-card")
    .filter({
      has: page.getByRole("heading", { name: "障礙排除", exact: true }),
    })
    .getByRole("button", { name: "開始測驗", exact: true })
    .click();
  const result = await completeTroubleUi(
    page,
    info,
    true,
    async () => {
      const room = page.locator(".trouble-room");
      await expect(room.locator(".trouble-hint")).toHaveCount(0);
      await expect(
        room.getByRole("button", { name: "定位目前操作" }),
      ).toHaveCount(0);
      const before = await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      );
      let lost = false;
      const intercept = async (route: import("@playwright/test").Route) => {
        if (
          !lost &&
          route.request().postDataJSON()?.command?.data?.action === "view"
        ) {
          lost = true;
          await route.fetch({
            url: route
              .request()
              .url()
              .replace("http://127.0.0.1:5173", serverURL),
          });
          await route.abort();
        } else await route.fallback();
      };
      await page.route("**/api/attempts/*/events", intercept);
      await room
        .getByRole("navigation", { name: "UIBC 作業切換" })
        .getByRole("button", { name: "查看 SOP", exact: true })
        .click();
      await expect(
        room.getByRole("button", { name: "重試保存", exact: true }),
      ).toBeEnabled();
      const committed = await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      );
      await page.unroute("**/api/attempts/*/events", intercept);
      await room.getByRole("button", { name: "重試保存", exact: true }).click();
      await expect(room).toHaveAttribute("data-saving", "false");
      const retried = await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      );
      expect(retried.revision).toBe(committed.revision);
      await reloadExamWindow(page);
      await expect(page.locator(".trouble-room")).toBeVisible({
        timeout: 15000,
      });
      const restored = await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      );
      expect(restored.startedAt).toBe(before.startedAt);
      expect(
        restored.sim.troubleshooting.results.map(
          (r: { value: number }) => r.value,
        ),
      ).toEqual([183, 179]);
    },
    async () => {
      const room = page.locator(".trouble-room");
      const active = async () =>
        (
          await (
            await page.request.get(serverURL + "/api/attempts/active")
          ).json()
        ).attempt;
      const before = await active();
      expect(before.sim.troubleshooting.qcRecovered).toBe(false);
      await reloadExamWindow(page);
      await expect(room.locator('[data-guide="nav-chart"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect((await active()).startedAt).toBe(before.startedAt);
      expect((await active()).sim.troubleshooting.qcRecovered).toBe(false);
      let lost = false;
      const intercept = async (route: import("@playwright/test").Route) => {
        if (
          !lost &&
          route.request().postDataJSON()?.command?.data?.action === "confirm-qc"
        ) {
          lost = true;
          await route.fetch({
            url: route
              .request()
              .url()
              .replace("http://127.0.0.1:5173", serverURL),
          });
          await route.abort();
        } else await route.fallback();
      };
      await page.route("**/api/attempts/*/events", intercept);
      await room.locator('[data-guide="confirm-qc"]').click();
      await expect(
        room.getByRole("button", { name: "重試保存", exact: true }),
      ).toBeEnabled();
      await expect(room.locator('[data-guide="nav-chart"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const committed = await active();
      expect(committed.sim.troubleshooting.qcRecovered).toBe(true);
      await page.unroute("**/api/attempts/*/events", intercept);
      await room.getByRole("button", { name: "重試保存", exact: true }).click();
      await expect(room.locator('[data-guide="nav-trace"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect((await active()).revision).toBe(committed.revision);
      expect(
        (await active()).sim.troubleshooting.results.map(
          (r: { value: number }) => r.value,
        ),
      ).toEqual([183, 179, 155, 50]);
    },
  );
  await expect(result.room.locator(".trouble-hint")).toHaveCount(0);
  await result.b("完成考試").click();
  await page
    .getByRole("dialog", { name: "確認交卷" })
    .getByRole("button", { name: "確認交卷" })
    .click();
  await expect(page.locator(".exam-stats")).toContainText("100 / 100", {
    timeout: 15000,
  });
  expect(errors).toEqual([]);
});

for (const version of [
  "AU5800-UIBC-2026-10-29-v1",
  "AU5800-UIBC-2026-10-29-v2",
  "AU5800-UIBC-2026-10-30-v3",
])
  test(`UIBC existing ${version.slice(-2)} exam retains its original workflow and score after later rollout`, async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    await page.request.post(serverURL + "/api/auth/login", {
      data: { username: "teacher", password: "Testing123!" },
    });
    const created = await (
      await page.request.post(serverURL + "/api/attempts", {
        data: { kind: "troubleshooting" },
      })
    ).json();
    expect(created.attempt).toBeTruthy();
    const db = new DatabaseSync(testDbPath);
    try {
      db.prepare("UPDATE attempts SET version=?,state=? WHERE id=?").run(
        version,
        JSON.stringify(initialEngine(version)),
        created.attempt.id,
      );
    } finally {
      db.close();
    }
    await page.goto("/");
    await page.getByRole("button", { name: "登入／考試", exact: true }).click();
    if (version.endsWith("v1"))
      await expect(
        page.getByRole("button", { name: "原杯重測身分核對", exact: true }),
      ).toBeVisible();
    const result = await (
      version.endsWith("v1") ? legacyUi : completeTroubleUi
    )(page, info, true);
    await expect(result.room.locator(".trouble-next")).toHaveCount(0);
    await result.b("完成考試").click();
    await page
      .getByRole("dialog", { name: "確認交卷" })
      .getByRole("button", { name: "確認交卷" })
      .click();
    await expect(page.locator(".exam-stats")).toContainText("100 / 100");
  });

test("filled cups retain neutral gold outlines on the bench and in racks, and clearing removes them", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { createPreparationModel } = await import("/src/preparationModel.ts");
    const { initialTroubleshooting, troubleMaterialsV2, gateForTrouble } =
      await import("/shared/troubleshooting.ts");
    const s = initialTroubleshooting(),
      model = createPreparationModel(troubleMaterialsV2);
    const cup = model.targets.get("cup:cup-1")!,
      outline = cup.getObjectByName("filled-cup-gold-outline")!;
    const other = s.preparation.cups[1];
    // A non-required source is still physically filled and must receive the same marker.
    Object.assign(other, { materialId: "lcc2", additions: 1 });
    model.update(s.preparation, gateForTrouble(s), false);
    const color = (outline as T.LineSegments).material.color.getHexString();
    const initial = outline.visible;
    const wrongSource = model.targets
      .get("cup:cup-2")!
      .getObjectByName("filled-cup-gold-outline")!.visible;
    const empty = model.targets
      .get("cup:cup-3")!
      .getObjectByName("filled-cup-gold-outline")!.visible;
    s.preparation.cups[0].rack = "QC";
    s.preparation.cups[0].slot = 2;
    s.preparation.racks.QC.location = "entry";
    model.update(s.preparation, gateForTrouble(s), false);
    const followsCup =
      outline.parent === cup && outline.visible && cup.scale.x === 0.2;
    Object.assign(s.preparation.cups[0], { materialId: null, additions: 0 });
    model.update(s.preparation, gateForTrouble(s), false);
    const cleared = !outline.visible;
    model.root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ("map" in m) m.map?.dispose();
          m.dispose();
        }
      }
    });
    return { color, initial, wrongSource, empty, followsCup, cleared };
  });
  expect(result).toEqual({
    color: "ffd700",
    initial: true,
    wrongSource: true,
    empty: false,
    followsCup: true,
    cleared: true,
  });
});

test("UIBC carousels contain a ring of recessed bottles and lift the selected old bottle before moving to the bench", async ({
  page,
}) => {
  await page.goto("/");
  const geometry = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { createInstrument } = await import("/src/model.ts");
    const { createTroubleshootingModel } =
      await import("/src/troubleshootingModel.ts");
    const { initialTroubleshooting } =
      await import("/shared/troubleshooting.ts");
    const instrument = createInstrument(),
      model = createTroubleshootingModel(instrument.root),
      state = initialTroubleshooting();
    state.covers = { main: true, R1: true, R2: true };
    model.update(state);
    instrument.root.updateMatrixWorld(true);
    const bottle = model.targets.get("bottle:old-R1")!,
      seated = bottle.position.clone();
    const top = new T.Box3().setFromObject(bottle).max.y;
    const deck = instrument.root.getObjectByName("analyzer-deck")!;
    const ray = new T.Raycaster(
      new T.Vector3(1.038, 2, 0.47),
      new T.Vector3(0, -1, 0),
    );
    const holeHits = ray.intersectObject(deck).length;
    let references = 0;
    model.root.traverse((o) => {
      if (o.userData.referenceOnly) references++;
    });
    state.reagent.old.R1 = false;
    state.reagent.slots.R1 = null;
    model.update(state);
    model.animate(performance.now() + 150);
    const lift = bottle.position.clone();
    model.animate(performance.now() + 1300);
    const removed = bottle.position.clone();
    state.reagent.slots.R1 = "new-R1";
    model.update(state);
    model.animate(performance.now() + 1300);
    const replacement = model.targets.get("bottle:new-R1")!;
    const newY = replacement.position.y;
    state.covers.R1 = false;
    model.update(state);
    const hidden = !replacement.visible;
    model.dispose();
    instrument.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    return {
      top,
      seat: seated.y,
      lift: lift.y,
      horizontal: Math.abs(lift.z - seated.z),
      removedZ: removed.z,
      newY,
      hidden,
      holeHits,
      references,
    };
  });
  expect(geometry.top).toBeLessThan(0.9525);
  expect(geometry.holeHits).toBe(0);
  expect(geometry.references).toBe(30);
  expect(geometry.lift).toBeGreaterThan(geometry.seat + 0.05);
  expect(geometry.horizontal).toBeLessThan(0.001);
  expect(geometry.removedZ).toBeCloseTo(3.15);
  expect(geometry.newY).toBeCloseTo(0.832);
  expect(geometry.hidden).toBe(true);
});
