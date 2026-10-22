import {
  supplyIds,
  supplyLabel,
  dailySyringes,
  iseReagentIds,
  iseReagentNames,
} from "../shared/dailyTasks";
import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  dailyProbes,
  detailedProbes,
  mixerIds,
  wellIds,
  syringeIds,
  w2Positions,
} from "../shared/maintenance";
import { initialBottles } from "../src/detergents";

let backend: ChildProcess;
const serverURL = "http://127.0.0.1:3002";
test.beforeAll(async () => {
  const folder = mkdtempSync(join(tmpdir(), "au5800-browser-test-"));
  backend = spawn(process.execPath, [resolve("server/index.mjs")], {
    env: {
      ...process.env,
      AU5800_PORT: "3002",
      AU5800_DB: join(folder, "test.sqlite"),
    },
    windowsHide: true,
    stdio: "pipe",
  });
  let output = "";
  backend.stderr?.on("data", (chunk) => {
    output += chunk;
  });
  for (let i = 0; i < 100; i++) {
    if (backend.exitCode !== null)
      throw new Error(`Test backend failed: ${output}`);
    try {
      if ((await fetch(`${serverURL}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Test backend did not start: ${output}`);
});
test.afterAll(async () => {
  if (backend && backend.exitCode === null) {
    const exited = new Promise((r) => backend.once("exit", r));
    backend.kill();
    await exited;
  }
});
test.beforeEach(async ({ page }, info) => {
  await page.route("**/api/**", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
    });
    await route.fulfill({ response });
  });
  if (info.title.startsWith("teacher setup")) return;
  // Each browser test owns its fixture; worker restarts after a failure remain isolated.
  await page.request.post(`${serverURL}/api/auth/setup`, {
    data: { username: "teacher", name: "教學老師", password: "Testing123!" },
  });
  await page.request.post(`${serverURL}/api/auth/login`, {
    data: { username: "teacher", password: "Testing123!" },
  });
  for (const [username, name] of [
    ["student", "學員甲"],
    ["student2", "學員乙"],
  ])
    await page.request.post(`${serverURL}/api/admin/users`, {
      data: { username, name, password: "Testing123!" },
    });
  await page.request.post(`${serverURL}/api/auth/logout`, { data: {} });
});
async function clickSaved(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (r) =>
      /\/api\/attempts\/[^/]+\/events$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await action();
  const saved = await response;
  expect(saved.status()).toBe(200);
  await expect(page.locator(".exam-room .exam-primary").first()).toBeEnabled();
  return await saved.json();
}
async function login(page: Page, username: string, password = "Testing123!") {
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.locator(".exam-login input[name=username]").fill(username);
  await page.locator(".exam-login input[name=password]").fill(password);
  await page
    .locator(".exam-login")
    .getByRole("button", { name: "登入", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "選擇保養任務" }),
  ).toBeVisible();
}
async function command(page: Page, c: unknown, source = "model") {
  return page.evaluate(
    async ({ c, source }) => {
      const active = await (await fetch("/api/attempts/active")).json();
      const response = await fetch(
        `/api/attempts/${active.attempt.id}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            revision: active.attempt.revision,
            source,
            command: c,
          }),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      return await response.json();
    },
    { c, source },
  );
}
test("teacher setup, learner ownership, empty submission, history and dashboard", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.locator(".exam-login input[name=username]").fill("teacher");
  await page.locator(".exam-login input[name=name]").fill("教學老師");
  await page.locator(".exam-login input[name=password]").fill("Testing123!");
  await page.getByRole("button", { name: "建立教師帳號", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "選擇保養任務" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "尚未開放", exact: true }).last(),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-missions.png`,
  });
  await page.getByRole("button", { name: "教師管理", exact: true }).click();
  const form = page.locator(".admin-account-grid>form");
  for (const [username, name] of [
    ["student", "學員甲"],
    ["student2", "學員乙"],
  ]) {
    await form.locator("[name=username]").fill(username);
    await form.locator("[name=name]").fill(name);
    await form.locator("[name=password]").fill("Testing123!");
    await form.getByRole("button", { name: "建立學員帳號" }).click();
    await expect(page.locator(".admin-user-list")).toContainText(name);
  }
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await page.locator(".exam-login input[name=username]").fill("student");
  await page.locator(".exam-login input[name=password]").fill("Testing123!");
  await page
    .locator(".exam-login")
    .getByRole("button", { name: "登入", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "教師管理", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "日保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  await expect(page.getByRole("region", { name: "日保養考試" })).toBeVisible();
  await expect(page.locator(".exam-room")).not.toContainText("目前步驟");
  await expect(page.locator(".exam-room")).not.toContainText("待完成");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "確認交卷" }),
  ).not.toContainText("遺漏");
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "日保養 · 本次成果" }),
  ).toBeVisible();
  await expect(page.locator(".exam-stats")).toContainText("0 / 100");
  await expect(page.locator(".exam-debrief")).toContainText("首次完成測驗");
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "我的歷程", exact: true }).click();
  await expect(page.locator(".exam-comparisons")).toContainText("只有一次紀錄");
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await login(page, "teacher");
  await page.getByRole("button", { name: "教師管理", exact: true }).click();
  await expect(page.locator(".exam-stats")).toContainText("交卷次數");
  await expect(
    page.getByRole("button", { name: "查看結算", exact: true }),
  ).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "匯出 CSV" }).click();
  expect((await download).suggestedFilename()).toBe("au5800-results.csv");
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-admin.png`,
  });
  expect(errors).toEqual([]);
});
test("daily model and native rack/QC controls complete without hints; earliest/latest growth is visible", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await login(page, "student2");
  const startDaily = () =>
    page
      .locator(".mission-card")
      .filter({
        has: page.getByRole("heading", { name: "日保養", exact: true }),
      })
      .getByRole("button", { name: "開始測驗" })
      .click();
  await startDaily();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await page.getByRole("button", { name: "返回歷程", exact: true }).click();
  await page.getByRole("button", { name: "任務選單", exact: true }).click();
  await startDaily();
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  const ws = page.locator(".exam-workstation"),
    panel = page.locator(".exam-model-panel");
  const home = async (name: string) => {
    await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
    await ws.getByRole("button", { name, exact: true }).click();
  };
  await home("日保養補充與檢查");
  for (const label of [
    "主蓋開啟",
    "Analyzer Maintenance",
    "ISE 上蓋開啟",
    "ISE Maintenance",
    "前方 syringe 櫃門",
    "後方 syringe 櫃門",
    "Standard／Buffer 罩",
    "Reference 櫃門",
  ])
    await clickSaved(page, () => ws.getByLabel(label, { exact: true }).check());
  for (const id of supplyIds)
    await clickSaved(page, () =>
      ws
        .getByRole("button", { name: `補充 ${supplyLabel(id)}`, exact: true })
        .click(),
    );
  for (const id of dailySyringes)
    for (const finding of ["水氣", "漏水"])
      await clickSaved(page, () =>
        ws
          .getByLabel(`${id} ${finding}檢查`, { exact: true })
          .selectOption("正常"),
      );
  for (const id of iseReagentIds)
    await clickSaved(page, () =>
      ws
        .getByRole("button", {
          name: `檢查 ${iseReagentNames[id]}`,
          exact: true,
        })
        .click(),
    );
  for (const id of ["standard", "buffer"] as const)
    await clickSaved(page, () =>
      ws
        .getByRole("button", {
          name: `更換 ${iseReagentNames[id]}`,
          exact: true,
        })
        .click(),
    );
  await clickSaved(page, () =>
    ws.getByLabel("ISE Maintenance", { exact: true }).uncheck(),
  );
  for (const label of ["主蓋開啟", "Analyzer Maintenance", "ISE 上蓋開啟"])
    await clickSaved(page, () =>
      ws.getByLabel(label, { exact: true }).uncheck(),
    );
  await home("Analyzer Status");
  await ws.getByLabel("Bath Temp. 登記", { exact: true }).fill("37.0");
  await ws.getByLabel("Coolant Temp. 登記", { exact: true }).fill("8.2");
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "儲存溫度紀錄", exact: true }).click(),
  );
  await home("Start Condition");
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Edit", exact: true }).click(),
  );
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "New Index", exact: true }).click(),
  );
  await home("Analyzer Maintenance");
  await clickSaved(page, () =>
    ws.getByLabel("主蓋開啟", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Cleaning Probe", exact: true }).click(),
  );
  await page
    .locator(".exam-room-toolbar")
    .getByRole("button", { name: "到模型操作", exact: true })
    .click();
  await panel.getByRole("button", { name: "探針", exact: true }).click();
  for (const id of dailyProbes) {
    await panel.getByRole("button", { name: id, exact: true }).click();
    await clickSaved(page, () =>
      panel
        .getByRole("button", { name: "酒精棉擦拭 tip", exact: true })
        .click(),
    );
  }
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  await home("Analyzer Maintenance");
  await clickSaved(page, () =>
    ws.getByLabel("Analyzer Maintenance", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    ws
      .getByRole("button", { name: "Inspect Probe & Mixing Bar", exact: true })
      .click(),
  );
  for (const id of dailyProbes)
    await clickSaved(page, () =>
      ws.getByLabel(`${id} 排水`, { exact: true }).selectOption("正常"),
    );
  for (const id of ["左側", "右側"])
    await clickSaved(page, () =>
      ws.getByLabel(`${id} mixing bars`, { exact: true }).selectOption("正常"),
    );
  await page
    .locator(".exam-room-toolbar")
    .getByRole("button", { name: "到模型操作", exact: true })
    .click();
  await panel.getByRole("button", { name: "CLEAN", exact: true }).click();
  await clickSaved(page, () =>
    panel.getByLabel("ISE 上蓋開啟", { exact: true }).check(),
  );
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-ise-cups.png`,
  });
  await clickSaved(page, () =>
    panel
      .getByRole("button", {
        name: "U-L／CLEAN 放入滿杯 Cleaning Solution",
        exact: true,
      })
      .click(),
  );
  await clickSaved(page, () =>
    panel.getByLabel("主蓋開啟", { exact: true }).uncheck(),
  );
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  await home("Analyzer Maintenance");
  await ws
    .getByRole("button", { name: "ISE Maintenance", exact: true })
    .click();
  await expect(
    ws.getByRole("button", { name: "Total Prime", exact: true }),
  ).toBeDisabled();
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Cleaning", exact: true }).click(),
  );
  await clickSaved(page, () =>
    ws.getByLabel("ISE Maintenance", { exact: true }).check(),
  );
  await expect(
    ws.getByRole("button", { name: "Cleaning", exact: true }),
  ).toBeDisabled();
  for (let i = 0; i < 3; i++)
    await clickSaved(page, () =>
      ws.getByRole("button", { name: "Total Prime", exact: true }).click(),
    );
  await ws.getByRole("button", { name: "Calibration", exact: true }).click();
  await page
    .locator(".exam-room-toolbar")
    .getByRole("button", { name: "到模型操作", exact: true })
    .click();
  await clickSaved(page, () =>
    panel.getByLabel("主蓋開啟", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    panel.getByRole("button", { name: "取出 CLEAN 杯", exact: true }).click(),
  );
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) {
    await panel.getByLabel(`${id} 校正液滴數`, { exact: true }).fill("10");
    await clickSaved(page, () =>
      panel
        .getByRole("button", { name: `放置 ${id} 校正杯`, exact: true })
        .click(),
    );
  }
  await clickSaved(page, () =>
    panel.getByLabel("主蓋開啟", { exact: true }).uncheck(),
  );
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  await home("Analyzer Maintenance");
  await ws
    .getByRole("button", { name: "ISE Maintenance", exact: true })
    .click();
  await ws.getByRole("button", { name: "Calibration", exact: true }).click();
  await clickSaved(page, () =>
    ws.getByLabel("ISE Maintenance", { exact: true }).uncheck(),
  );
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Serum/Urine Start", exact: true }).click(),
  );
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "確認校正結果", exact: true }).click(),
  );
  await home("Reagent Management");
  for (const [name, side] of [
    ["ALT", "R1"],
    ["ALT", "R2"],
    ["HDL", "R1"],
    ["HDL", "R2"],
    ["LDL", "R1"],
    ["LDL", "R2"],
    ["CRE", "R1"],
    ["CRE", "R2"],
    ["AMY", "R1"],
  ]) {
    await clickSaved(page, () =>
      ws
        .getByRole("button", { name: `更換試劑 ${name} ${side}`, exact: true })
        .click(),
    );
  }
  await clickSaved(page, () =>
    ws
      .getByRole("button", {
        name: "Reagent Check · All positions",
        exact: true,
      })
      .click(),
  );
  await expect(ws.locator(".stability-expired")).toHaveCount(15);
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-reagents.png`,
  });
  await home("Rack Requisition");
  // QC first must not save the still-unentered automatic Calibration selection.
  await ws.getByRole("button", { name: "QC", exact: true }).click();
  await ws.getByRole("button", { name: "Start Entry", exact: true }).click();
  await ws.getByRole("button", { name: "3.ALT", exact: true }).click();
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Entry", exact: true }).click(),
  );
  const beforeCal = await page.evaluate(
    async () =>
      (await (await fetch("/api/attempts/active")).json()).attempt.sim,
  );
  expect(beforeCal.rack.Serum.cal).toEqual([]);
  expect(beforeCal.calibrationEntered).toBeFalsy();
  await ws.getByRole("button", { name: "Calibration", exact: true }).click();
  await ws.getByRole("button", { name: "Start Entry", exact: true }).click();
  await expect(ws.getByLabel("RB count", { exact: true })).toHaveText("5");
  await expect(ws.getByLabel("Cal count", { exact: true })).toHaveText("3");
  await expect(
    ws.getByRole("button", { name: "3.ALT RB", exact: true }),
  ).toHaveAttribute("title", "expired");
  await ws
    .getByRole("button", { name: "3.ALT RB", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(ws.locator(".ws-title")).toBeInViewport();
  await expect(ws.getByLabel("Rack Type", { exact: true })).toBeInViewport();
  await expect(
    ws.getByRole("button", { name: "Entry", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-rack-expired.png`,
  });
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Entry", exact: true }).click(),
  );
  await ws.getByRole("button", { name: "QC", exact: true }).click();
  for (const [type, group] of [
    ["Serum", "1.MAS QC"],
    ["Urine", "5.URINE QC"],
  ]) {
    await ws.getByLabel("Rack Type", { exact: true }).selectOption(type);
    await ws.getByRole("button", { name: "Start Entry", exact: true }).click();
    await ws.getByRole("button", { name: "Profile", exact: true }).click();
    const profile = page.getByRole("dialog", {
      name: "QC Profile",
      exact: true,
    });
    await expect(profile).not.toContainText("Entry 才儲存申請");
    await profile.getByRole("button", { name: group, exact: true }).click();
    await profile.getByRole("button", { name: "OK", exact: true }).click();
    await clickSaved(page, () =>
      ws.getByRole("button", { name: "Entry", exact: true }).click(),
    );
  }
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(page.locator(".exam-stats")).toContainText("100 / 100");
  await expect(page.locator(".exam-stats")).toContainText("操作錯誤0");
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-daily-complete.png`,
  });
  await page.getByRole("button", { name: "返回歷程", exact: true }).click();
  await expect(page.locator(".exam-comparisons")).toContainText("0 → 100");
});
test("daily v4 mode buttons are disabled natively and new inspection evidence resumes after refresh", async ({
  page,
}) => {
  await login(page, "student");
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "日保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  await clickSaved(page, () =>
    page.getByTestId("exam-front-syringe-toggle").click(),
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-front",
    "true",
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-internal",
    "false",
  );
  await clickSaved(page, () =>
    page.getByTestId("exam-rear-syringe-toggle").click(),
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-rear",
    "true",
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-front",
    "true",
  );
  await clickSaved(page, () =>
    page.getByTestId("exam-rear-syringe-toggle").click(),
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-rear",
    "false",
  );
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  const ws = page.locator(".exam-workstation");
  await ws
    .getByRole("button", { name: "Analyzer Maintenance", exact: true })
    .click();
  await ws
    .getByRole("button", { name: "ISE Maintenance", exact: true })
    .click();
  const prime = ws.getByRole("button", { name: "Total Prime", exact: true });
  const cleaning = ws.getByRole("button", { name: "Cleaning", exact: true });
  await expect(prime).toBeDisabled();
  await expect(cleaning).toBeEnabled();
  const before = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  await prime.evaluate((element: HTMLButtonElement) => element.click());
  expect(
    await prime.evaluate((el: HTMLButtonElement) => {
      el.focus();
      return document.activeElement === el;
    }),
  ).toBe(false);
  const after = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(after.revision).toBe(before.revision);
  expect(after.version).toBe("AU5800-2026-10-22-v4");
  await clickSaved(page, () =>
    ws.getByLabel("ISE Maintenance", { exact: true }).check(),
  );
  await expect(prime).toBeEnabled();
  await expect(cleaning).toBeDisabled();
  await ws.getByRole("button", { name: "Calibration", exact: true }).click();
  await expect(
    ws.getByRole("button", { name: "Serum/Urine Start", exact: true }),
  ).toBeDisabled();
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws
    .getByRole("button", { name: "日保養補充與檢查", exact: true })
    .click();
  await clickSaved(page, () =>
    ws.getByLabel("Standard／Buffer 罩", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "更換 ISE Standard", exact: true }).click(),
  );
  await clickSaved(page, () =>
    ws.getByLabel("後方 syringe 櫃門", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    ws
      .getByLabel("後方 syringe 組 漏水檢查", { exact: true })
      .selectOption("正常"),
  );
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await expect(page.getByRole("region", { name: "日保養考試" })).toBeVisible();
  const restored = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(restored.sim.instrument.frontSyringe).toBe(true);
  expect(restored.sim.instrument.rearSyringe).toBe(true);
  expect(restored.sim.dailyTasks.iseReagents.standard.replaced).toBe(true);
  expect(restored.sim.dailyTasks.syringes["後方 syringe 組"].leak).toBe("正常");
  expect(restored.sim.dailyTasks.syringes["後方 syringe 組"].moisture).toBe("");
  await page.getByRole("button", { name: "放棄本次", exact: true }).click();
  await page.getByRole("button", { name: "確認放棄", exact: true }).click();
});

test("weekly model actions, skip support, refresh recovery, neutral restrictions and failed-save retry", async ({
  page,
}, info) => {
  await login(page, "student");
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "周保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  const panel = page.locator(".exam-model-panel");
  await clickSaved(page, () =>
    panel.getByLabel("Analyzer Maintenance", { exact: true }).check(),
  );
  await clickSaved(page, () =>
    panel.getByLabel("主蓋開啟", { exact: true }).check(),
  );
  await panel.getByRole("button", { name: "探針", exact: true }).click();
  // No syringe preparation or previous-step completion is required here.
  await clickSaved(page, () =>
    panel.getByRole("button", { name: "提起取出", exact: true }).click(),
  );
  await expect(page.locator(".exam-save-status")).toContainText("鎖頭仍鎖緊");
  await clickSaved(page, () =>
    page.locator('.exam-room [data-weekly-id="lock-Sample-1"]').click(),
  );
  for (const name of [
    "等待液體滴完",
    "提起取出",
    "擦拭 tip",
    "裝回探針",
    "鎖緊鎖頭",
  ])
    await clickSaved(page, () =>
      panel.getByRole("button", { name, exact: true }).click(),
    );
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await expect(page.getByRole("region", { name: "周保養考試" })).toBeVisible();
  const active = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(active.sim.probes["Sample-1"].wiped).toBe(true);
  expect(active.sim.probes["Sample-1"].wired).toBe(false);
  expect(active.sim.probes["Sample-1"].locked).toBe(true);
  // An uncertain network result keeps the same event ID for retry, never claims success.
  let failOnce = true;
  await page.route("**/api/attempts/*/events", async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.abort();
    } else {
      const response = await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.fulfill({ response });
    }
  });
  await panel.getByRole("button", { name: "攪拌棒", exact: true }).click();
  await panel
    .getByRole("button", {
      name: "取下清潔 mixer bar 並裝回（右側）",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("尚未確認保存");
  await page.getByRole("button", { name: "重試保存", exact: true }).click();
  await expect(page.locator(".exam-save-status")).toContainText("操作已保存");
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt.sim
            .mixers.length,
      ),
    )
    .toBe(12);
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-model.png`,
  });
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(page.locator(".exam-debrief")).toContainText(
    "Sample-1 鐵絲通孔",
  );
  await expect(
    page
      .locator(".exam-debrief .omitted")
      .filter({ hasText: "Sample-1 鐵絲通孔" }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".exam-debrief .complete")
      .filter({ hasText: "Sample-1 復位鎖緊" }),
  ).toHaveCount(1);
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-debrief.png`,
  });
});
test("complete weekly run, native W2/Photocal navigation, restoration and repeated restart", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, "student2");
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "周保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  // Prepare via the same authenticated event API used by both model and workstation.
  for (const c of [
    { type: "maintenance", target: "analyzer", value: true },
    { type: "maintenance", target: "ise", value: true },
    { type: "cover", target: "iseTop", value: true },
    { type: "lid", value: true },
    { type: "prepared", value: true },
  ])
    await command(page, c);
  for (const id of syringeIds)
    await command(page, { type: "syringe", target: id, value: "正常" });
  for (const id of detailedProbes) {
    for (const op of [
      "unlock",
      "drain",
      "remove",
      "wipe",
      "wire",
      "install",
      "lock",
    ])
      await command(page, { type: "probe", target: id, value: op });
    await command(
      page,
      {
        type: "diag-config",
        target: id,
        data: { cuvette: "內部", count: 3, unit: true },
      },
      "workstation",
    );
    await command(page, {
      type: "diag",
      target: id === "ISE" ? "ise" : "sample",
    });
    await command(page, { type: "drain-result", target: id, value: "正常" });
  }
  for (const id of ["R1S", "R2"]) {
    await command(page, { type: "group", target: id });
    await page.waitForTimeout(2500);
    await command(page, { type: "damage", target: id, value: "正常" });
  }
  await command(page, { type: "swab" });
  for (const id of wellIds) await command(page, { type: "well", target: id });
  await command(
    page,
    {
      type: "diag-config",
      target: "mix",
      data: { cuvette: "內部", count: 1, unit: true },
    },
    "workstation",
  );
  await command(page, { type: "diag", target: "front" });
  await command(page, { type: "mix-result", value: "正常" });
  await command(page, { type: "chemistry", value: "hcl" });
  for (const id of ["sample-left-2", "sample-right-2"])
    await command(page, { type: "bottle", target: id, value: "remove" });
  for (const id of w2Positions)
    await command(page, {
      type: "bottle",
      target: id,
      value: "replace",
      data: { fluid: "w2", level: 1, chemistry: "hcl" },
    });
  await command(page, { type: "cup", value: "full" });
  await command(page, { type: "lid", value: false });
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "工作站", exact: true }).click();
  const ws = page.locator(".exam-workstation");
  await ws
    .getByRole("button", { name: "Analyzer Maintenance", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "W2 設定", exact: true }),
  ).toHaveCount(0);
  await ws.getByRole("button", { name: "W2", exact: true }).click();
  const w2 = page.getByRole("dialog", { name: "W2 設定", exact: true });
  for (const name of [
    "After W2 ends, perform the photocal",
    "ISE Cleaning (Enhanced)",
  ])
    await clickSaved(page, () => w2.getByLabel(name, { exact: true }).check());
  await clickSaved(page, () =>
    w2.getByRole("button", { name: "OK · Start W2", exact: true }).click(),
  );
  await expect(w2).toContainText("程序狀態：W2");
  await clickSaved(page, () =>
    w2.getByRole("button", { name: "教學快轉", exact: true }).click(),
  );
  await expect(w2).toContainText("PHOTOCAL");
  await clickSaved(page, () =>
    w2.getByRole("button", { name: "教學快轉", exact: true }).click(),
  );
  await w2.getByRole("button", { name: "Cancel", exact: true }).click();
  await ws
    .getByRole("button", { name: "Photocal Monitor", exact: true })
    .click();
  await expect(ws.locator(".photocal-grid span")).toHaveCount(204);
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "確認本次結果", exact: true }).click(),
  );
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await expect(ws.locator(".ws-title")).toContainText("Home");
  await command(page, { type: "lid", value: true });
  for (const id of w2Positions)
    await command(page, { type: "bottle", target: id, value: "remove" });
  for (const id of ["r1-inner-3", "r1-outer-3"])
    await command(page, { type: "diluent-clean", target: id });
  for (const [id, b] of Object.entries(initialBottles()))
    if (b.fluid)
      await command(page, {
        type: "bottle",
        target: id,
        value: "replace",
        data: { fluid: b.fluid, level: 1 },
      });
  for (const c of [
    { type: "cup", value: "discarded" },
    { type: "lid", value: false },
    { type: "maintenance", value: false },
    { type: "maintenance", target: "ise", value: false },
    { type: "cover", target: "iseTop", value: false },
  ])
    await command(page, c);
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(page.locator(".exam-stats")).toContainText("100 / 100");
  await expect(page.locator(".exam-stats")).toContainText("100%");
  await page.getByRole("button", { name: "返回歷程", exact: true }).click();
  await page.getByRole("button", { name: "任務選單", exact: true }).click();
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "周保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  await expect(
    page.locator(".exam-model-panel").getByLabel("主蓋開啟", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "放棄本次", exact: true }).click();
  await page.getByRole("button", { name: "確認放棄", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "選擇保養任務" }),
  ).toBeVisible();
});
