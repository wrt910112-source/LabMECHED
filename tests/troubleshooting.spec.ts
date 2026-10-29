import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { completeTroubleUi } from "./troubleshooting-ui";
let backend: ChildProcess;
const serverURL = "http://127.0.0.1:3003";
test.beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "uibc-browser-"));
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
  page.setDefaultTimeout(15000);
  await page.route("**/api/**", async (route) => {
    try {
      const response = await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.fulfill({ response });
    } catch (error) {
      if (!page.isClosed()) throw error;
    }
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
  const result = await completeTroubleUi(page, info);
  await expect(result.room.locator(".trouble-hint")).toBeVisible();
  await result.b("收合任務資訊").click();
  await expect(result.room.locator(".trouble-hint")).not.toBeVisible();
  await result.b("展開任務資訊").click();
  await result.b("檢視操作紀錄").click();
  await expect(
    result.room.getByRole("table", { name: "UIBC 操作紀錄" }),
  ).toContainText("remove-old UIBC R1");
  await result.b("返回任務中心").click();
  await page.getByRole("button", { name: /04.*障礙排除/ }).click();
  await page.getByRole("button", { name: "繼續練習", exact: true }).click();
  await expect(page.locator(".trouble-room")).toContainText("本次訓練操作完成");
  expect(errors).toEqual([]);
});
test("UIBC exam preserves state and time through reload and lost-save retry without answer guidance", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(serverURL + "/api/auth/setup", {
    data: {
      username: "teacher",
      name: "UIBC teacher",
      password: "Testing123!",
    },
  });
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.locator(".exam-login [name=username]").fill("teacher");
  await page.locator(".exam-login [name=password]").fill("Testing123!");
  await page
    .locator(".exam-login")
    .getByRole("button", { name: "登入", exact: true })
    .click();
  await page
    .locator(".mission-card")
    .filter({
      has: page.getByRole("heading", { name: "障礙排除", exact: true }),
    })
    .getByRole("button", { name: "開始測驗", exact: true })
    .click();
  const result = await completeTroubleUi(page, info, true, async () => {
    const room = page.locator(".trouble-room");
    await expect(room.locator(".trouble-hint")).toHaveCount(0);
    await expect(
      room.getByRole("button", { name: "定位目前操作" }),
    ).toHaveCount(0);
    const before = await page.evaluate(
      async () => (await (await fetch("/api/attempts/active")).json()).attempt,
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
      async () => (await (await fetch("/api/attempts/active")).json()).attempt,
    );
    await page.unroute("**/api/attempts/*/events", intercept);
    await room.getByRole("button", { name: "重試保存", exact: true }).click();
    await expect(room).toHaveAttribute("data-saving", "false");
    const retried = await page.evaluate(
      async () => (await (await fetch("/api/attempts/active")).json()).attempt,
    );
    expect(retried.revision).toBe(committed.revision);
    await page.reload();
    await page.getByRole("button", { name: "登入／考試", exact: true }).click();
    await expect(page.locator(".trouble-room")).toBeVisible({ timeout: 15000 });
    const restored = await page.evaluate(
      async () => (await (await fetch("/api/attempts/active")).json()).attempt,
    );
    expect(restored.startedAt).toBe(before.startedAt);
    expect(
      restored.sim.troubleshooting.results.map(
        (r: { value: number }) => r.value,
      ),
    ).toEqual([183, 179]);
  });
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
