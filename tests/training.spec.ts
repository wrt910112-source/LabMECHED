import { test, expect, type Page } from "@playwright/test";
import { createApplication } from "../server/index.mjs";
import { seedAccount } from "../server/account-fixture.mjs";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
let backend: ChildProcess;
const origin = "http://127.0.0.1:3010";
test.beforeAll(async () => {
  const path = join(mkdtempSync(join(tmpdir(), "training-ui-")), "test.sqlite"),
    app = createApplication({ dbPath: path });
  await seedAccount(app.db, "tracking-admin");
  await seedAccount(app.db, "tracking-student", "learner");
  await seedAccount(app.db, "tracking-empty", "learner");
  app.db.close();
  backend = spawn(process.execPath, [resolve("server/index.mjs")], {
    env: { ...process.env, AU5800_PORT: "3010", AU5800_DB: path },
    windowsHide: true,
    stdio: "pipe",
  });
  let output = "";
  backend.stderr?.on("data", (s) => (output += s));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(output || "Training backend did not start");
});
test.afterAll(async () => {
  if (backend?.exitCode === null) {
    const exited = new Promise((r) => backend.once("exit", r));
    backend.kill();
    await exited;
  }
});
test.beforeEach(async ({ context, page }) => {
  await context.route("**/api/**", async (route) => {
    try {
      const r = await route.fetch({
        maxRetries: 1,
        url: route.request().url().replace("http://127.0.0.1:5173", origin),
      });
      await route.fulfill({ response: r, body: await r.body() });
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
  page.setDefaultTimeout(30000);
});
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: "wait" });
});
async function login(page: Page, name = "tracking-student") {
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.locator(".exam-login input[name=username]").fill(name);
  await page.locator(".exam-login input[name=password]").fill("Testing123!");
  await page
    .locator(".exam-login")
    .getByRole("button", { name: "登入", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "學習成效", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉考試中心", exact: true }).click();
}
async function start(page: Page, claim = true) {
  const permission = page.waitForResponse((r) =>
    r.url().endsWith("/api/training/lease"),
  );
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page
    .getByRole("button", { name: /^(開始|繼續)練習$/, exact: true })
    .click();
  await expect(page.getByRole("region", { name: "練習任務紀錄" })).toBeVisible({
    timeout: 15000,
  });
  await permission;
  const takeover = page.getByRole("button", { name: "接手操作", exact: true });
  if (claim && (await takeover.isVisible())) await takeover.click();
  // After a browser reload, a failed unload delivery may leave the old lease alive.
  const r = await page.evaluate(async () => {
    const x = await fetch("/api/practice-sessions/active");
    return x.json();
  });
  return r.sessions.find((s: { kind: string }) => s.kind === "daily");
}
async function action(page: Page, fn: () => Promise<unknown>) {
  const response = page.waitForResponse((r) =>
    /\/api\/practice-sessions\/[^/]+\/events$/.test(r.url()),
  );
  await fn();
  expect((await response).status()).toBe(200);
  await expect(
    page
      .locator(".persistent-practice-room .ws-session-hud button")
      .filter({ hasText: "返回探索" }),
  ).toBeEnabled();
}
test("saved practice resumes after pause and reload, and the learner sees their own analytics", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const initial = await start(page);
  await page
    .getByRole("region", { name: "練習任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  const ws = page.locator(".persistent-practice-room .workstation"),
    b = (name: string) => ws.getByRole("button", { name, exact: true });
  await b("Home 主選單").click();
  await b("Analyzer Status").click();
  await ws.getByLabel("Bath Temp. 登記").fill("37.1");
  await ws.getByLabel("Coolant Temp. 登記").fill("8.2");
  await action(page, () => b("儲存溫度紀錄").click());
  await b("Home 主選單").click();
  await b("Start Condition").click();
  await action(page, () => b("Edit").click());
  await action(page, () => b("New Index").click());
  const released = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/training/activity") &&
      r.request().postDataJSON()?.release === true,
  );
  await ws
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  const rr = await released;
  expect(rr.status()).toBe(200);
  await expect(page.locator(".practice-portal")).not.toBeVisible({
    timeout: 15000,
  });
  const resumed = await start(page);
  expect(resumed.id).toBe(initial.id);
  expect(resumed.sim.temp.bath).toBe("37.1");
  expect(resumed.sim.index).not.toBe("");
  await page.reload();
  const again = await start(page);
  expect(again.id).toBe(initial.id);
  expect(again.sim.temp.saved).toBe(true);
  const claim = page.getByRole("button", { name: "接手操作", exact: true });
  if (await claim.isVisible()) await claim.click();
  await page
    .locator(".persistent-practice-room > .simulator-shell > .topbar")
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "學習成效", exact: true }).click();
  const report = page.getByRole("region", { name: "學習成效分析" });
  await expect(report).toContainText("有效練習時間");
  await expect(report).toContainText("未完成／可接續");
  await report
    .getByRole("button", { name: "查看明細", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "訓練紀錄明細" }),
  ).toContainText("溫度登記");
  await page.getByRole("button", { name: "關閉明細", exact: true }).click();
  await page.screenshot({
    path: `artifacts/training/${info.project.name}-learner.png`,
  });
  expect(errors).toEqual([]);
});
test("administrator analytics lists learners without records and exports coded CSV", async ({
  page,
}, info) => {
  await login(page, "tracking-admin");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "學習成效", exact: true }).click();
  const report = page.getByRole("region", { name: "學習成效分析" });
  await expect(report).toContainText("tracking-empty");
  await expect(report).toContainText("班級與個人學習成效");
  await report.getByLabel("任務", { exact: true }).selectOption("daily");
  const download = page.waitForEvent("download");
  await report
    .getByRole("button", { name: "學員彙總 CSV", exact: true })
    .click();
  const stream = await (await download).createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain("學員代碼");
  expect(csv).not.toContain("tracking-student");
  await page.screenshot({
    path: `artifacts/training/${info.project.name}-admin.png`,
  });
});

test("two windows require explicit takeover, and a lost acknowledgement retries one saved event", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await login(page);
  const initial = await start(page);
  const openScreen = async (p: Page) => {
    await p
      .getByRole("region", { name: "練習任務紀錄" })
      .getByRole("button", { name: "操作電腦", exact: true })
      .click();
    const ws = p.locator(".persistent-practice-room .workstation");
    await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
    await ws
      .getByRole("button", { name: "Analyzer Status", exact: true })
      .click();
    await ws.getByLabel("Bath Temp. 登記").fill("37.0");
    await ws.getByLabel("Coolant Temp. 登記").fill("8.2");
    return ws;
  };
  const first = await openScreen(page);
  const second = await context.newPage();
  await second.goto("/");
  const resumed = await start(second, false);
  expect(resumed.id).toBe(initial.id);
  const claim = second.getByRole("button", { name: "接手操作", exact: true });
  await expect(claim).toBeVisible();
  await claim.click();
  const next = await openScreen(second);
  await action(second, () =>
    next.getByRole("button", { name: "儲存溫度紀錄", exact: true }).click(),
  );
  // Force a write from the old holder rather than waiting for its next heartbeat.
  await first
    .getByRole("button", { name: "儲存溫度紀錄", exact: true })
    .click();
  await expect(
    first.getByRole("button", { name: "接手操作", exact: true }),
  ).toBeVisible();
  const before = await second.evaluate(
    async (id) =>
      (await (await fetch(`/api/practice-sessions/${id}`)).json()).session,
    initial.id,
  );
  let lost = false;
  await second.route("**/api/practice-sessions/*/events", async (route) => {
    if (lost) {
      await route.continue();
      return;
    }
    lost = true;
    const r = await route.fetch({
      maxRetries: 1,
      url: route.request().url().replace("http://127.0.0.1:5173", origin),
    });
    expect(r.status()).toBe(200);
    await route.abort("failed");
  });
  await next.getByLabel("Bath Temp. 登記").fill("37.2");
  await next.getByRole("button", { name: "儲存溫度紀錄", exact: true }).click();
  const retry = next.getByRole("button", { name: "重試保存", exact: true });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).not.toBeVisible();
  const after = await second.evaluate(
    async (id) =>
      (await (await fetch(`/api/practice-sessions/${id}`)).json()).session,
    initial.id,
  );
  expect(after.events.length).toBe(before.events.length + 1);
  expect(after.revision).toBe(before.revision + 1);
  await next
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await expect(second.locator(".practice-portal")).not.toBeVisible();
  await second.close();
});

test("leaving while the initial lease response is delayed cannot count free exploration time", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, "tracking-empty");
  let allowResponse = () => {},
    leaseStarted = () => {},
    sessionId = "";
  const gate = new Promise<void>((resolve) => {
      allowResponse = resolve;
    }),
    started = new Promise<void>((resolve) => {
      leaseStarted = resolve;
    });
  await page.route("**/api/training/lease", async (route) => {
    sessionId = route.request().postDataJSON().sessionId;
    const response = await route.fetch({
      url: route.request().url().replace("http://127.0.0.1:5173", origin),
    });
    expect(response.status()).toBe(200);
    leaseStarted();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "任務中心", exact: true }).click();
    await page
      .getByRole("button", { name: /^(開始|繼續)練習$/, exact: true })
      .click();
    await started;
    await page
      .locator(".persistent-practice-room > .simulator-shell > .topbar")
      .getByRole("button", { name: "返回探索（保留練習）", exact: true })
      .click();
    await expect(page.locator(".practice-portal")).not.toBeVisible();
    const release = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/training/activity") &&
        r.request().postDataJSON()?.release === true,
    );
    allowResponse();
    expect((await release).status()).toBe(200);
    await page.unroute("**/api/training/lease");
    const result = await page.evaluate(async (id) => {
      const session = (
        await (await fetch(`/api/practice-sessions/${id}`)).json()
      ).session;
      const acquired = await fetch("/api/training/lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "practice",
          sessionId: id,
          viewId: "lease-after-leaving",
        }),
      });
      const { token } = await acquired.json();
      if (acquired.ok)
        await fetch("/api/training/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Training-Lease": token,
          },
          body: JSON.stringify({
            mode: "practice",
            sessionId: id,
            sequence: 1,
            visible: false,
            lastActivityAgeMs: 0,
            release: true,
          }),
        });
      return { status: acquired.status, timing: session.timing };
    }, sessionId);
    expect(result.status).toBe(200);
    expect(result.timing.activeMs).toBe(0);
  } finally {
    allowResponse();
  }
});

test("visibility changes are reported immediately while an earlier activity response is delayed", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, "tracking-empty");
  let allowResponse = () => {},
    pulseStarted = () => {},
    held = false;
  const gate = new Promise<void>((resolve) => {
      allowResponse = resolve;
    }),
    started = new Promise<void>((resolve) => {
      pulseStarted = resolve;
    });
  await page.route("**/api/training/activity", async (route) => {
    const body = route.request().postDataJSON();
    if (held || !body.visible || body.release) {
      await route.fallback();
      return;
    }
    held = true;
    const response = await route.fetch({
      maxRetries: 1,
      url: route.request().url().replace("http://127.0.0.1:5173", origin),
    });
    expect(response.status()).toBe(200);
    const buffer = await response.body();
    pulseStarted();
    await gate;
    await route.fulfill({ response, body: buffer });
  });
  try {
    await start(page);
    await started;
    const hidden = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/training/activity") &&
        r.request().postDataJSON()?.visible === false &&
        !r.request().postDataJSON()?.release,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect((await hidden).status()).toBe(200);
    allowResponse();
    await page
      .locator(".persistent-practice-room > .simulator-shell > .topbar")
      .getByRole("button", { name: "返回探索（保留練習）", exact: true })
      .click();
    await expect(page.locator(".practice-portal")).not.toBeVisible();
  } finally {
    allowResponse();
  }
});
