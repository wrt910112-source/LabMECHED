import { reloadExamWindow } from "./ui";
import { createApplication } from "../server/index.mjs";
import { seedAccount } from "../server/account-fixture.mjs";
import { isTaskOpen } from "../shared/availability";
import { fillPreparationUI, preparationShot } from "./preparation-ui";
import { currentDailyVersion } from "../shared/dailyScenario";
import {
  instrument,
  closeProgram,
  cups,
  iseDrain,
  replaceAll,
  selectPart,
  selectTarget,
} from "./ui";
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
  const setup = createApplication({ dbPath: join(folder, "test.sqlite") });
  await seedAccount(setup.db);
  await seedAccount(setup.db, "student", "learner");
  await seedAccount(setup.db, "student2", "learner");
  setup.db.close();
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
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
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
  page.setDefaultTimeout(30000);
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
  if (await page.locator(".shared-exam-room").count())
    await expect(
      page
        .locator(
          ".shared-exam-room .ws-session-hud, .shared-exam-room > .simulator-shell > .topbar",
        )
        .getByRole("button", { name: "完成", exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeEnabled();
  else
    await expect(
      page.locator(".exam-room .exam-primary").first(),
    ).toBeEnabled();
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
  await expect(page.getByRole("heading", { name: "選擇保養任務" })).toBeVisible(
    { timeout: 12000 },
  );
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
test("learner login, empty submission and saved history remain available without public setup", async ({
  page,
}) => {
  await login(page, "student");
  await expect(
    page.getByRole("button", { name: "帳號管理", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".mission-card")
      .filter({
        has: page.getByRole("heading", { name: "周保養", exact: true }),
      })
      .getByRole("button"),
  ).toBeDisabled();
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "日保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(page.locator(".exam-stats")).toContainText("0.8 / 100");
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "我的歷程", exact: true }).click();
  await expect(page.locator(".exam-comparisons")).toContainText("只有一次紀錄");
});

test("daily model and native rack/QC controls complete without hints; earliest/latest growth is visible", async ({
  page,
}, info) => {
  test.setTimeout(300000);
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
  await page
    .getByRole("region", { name: "考試任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  const ws = page.locator(".shared-exam-room .workstation");
  const button = (name: string) =>
    ws.getByRole("button", { name, exact: true });
  const home = async (name: string) => {
    if (name === "日保養補充與檢查") {
      await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
      const log = page.getByRole("region", { name: "考試任務紀錄" });
      await log.getByRole("button", { name: /補充 CLN-1/ }).click();
      await log.getByRole("button", { name: "操作電腦", exact: true }).click();
      return;
    }
    await closeProgram(ws);
    await button("Home 主選單").click();
    await button(name).click();
  };
  const savedButton = (name: string) =>
    clickSaved(page, () => button(name).click());
  await home("Analyzer Status");
  await ws.getByLabel("Bath Temp. 登記").fill("37.0");
  await ws.getByLabel("Coolant Temp. 登記").fill("8.2");
  await savedButton("儲存溫度紀錄");
  await home("Start Condition");
  await savedButton("Edit");
  await savedButton("New Index");
  await expect(ws).not.toContainText("按 Edit 後選 New Index");
  await home("日保養補充與檢查");
  for (const label of ["主蓋開啟", "ISE 上蓋開啟", "ISE Maintenance"])
    await clickSaved(page, () => instrument(ws, label));
  for (const id of supplyIds) await savedButton(`補充 ${supplyLabel(id)}`);
  for (const label of [
    "前方 syringe 櫃門",
    "後方 syringe 櫃門",
    "Standard／Buffer 罩",
    "Reference 櫃門",
  ])
    await clickSaved(page, () => instrument(ws, label));
  for (const id of dailySyringes)
    for (const finding of ["水氣", "漏水"])
      await clickSaved(page, () =>
        ws
          .getByLabel(`${id} ${finding}檢查`, { exact: true })
          .selectOption("正常"),
      );
  for (const id of iseReagentIds)
    await savedButton(`檢查 ${iseReagentNames[id]}`);
  for (const id of ["standard", "buffer"] as const)
    await savedButton(`更換 ${iseReagentNames[id]}`);
  await clickSaved(page, () => instrument(ws, "ISE Maintenance", false));
  await home("Analyzer Maintenance");
  await clickSaved(page, () => instrument(ws, "Analyzer Maintenance", true));
  await savedButton("Cleaning Probe");
  for (const id of dailyProbes.slice(0, -1))
    await clickSaved(page, () => button(`酒精棉擦拭 ${id}`).click());
  await ws
    .locator(".ws-toolbar")
    .getByRole("button", { name: "到模型操作", exact: true })
    .click();
  const model = page.locator(".shared-exam-room .model-practice");
  await expect(model).toBeVisible();
  const lastProbe = dailyProbes.at(-1)!;
  await selectTarget(page, lastProbe);
  await clickSaved(page, () =>
    model
      .getByRole("button", { name: `用酒精棉擦拭 ${lastProbe}`, exact: true })
      .click(),
  );
  await expect(
    page.locator(
      ".shared-exam-room .guidance-markers span, .shared-exam-room .hud-control-target",
    ),
  ).toHaveCount(0);
  await page
    .getByRole("region", { name: "考試任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  await home("Analyzer Maintenance");
  await savedButton("Inspect Probe & Mixing Bar");
  for (const id of dailyProbes)
    await clickSaved(page, () =>
      ws.getByLabel(`${id} 排水`, { exact: true }).selectOption("正常"),
    );
  for (const id of ["左側", "右側"])
    await clickSaved(page, () =>
      ws.getByLabel(`${id} mixing bars`, { exact: true }).selectOption("正常"),
    );
  await clickSaved(page, () => instrument(ws, "Analyzer Maintenance", false));
  await button("ISE Maintenance").click();
  await button("試劑杯準備").click();
  await savedButton("在 CLEAN 放置裝滿的 Cleaning Solution");
  await closeProgram(ws);
  await savedButton("Cleaning");
  await clickSaved(page, () => instrument(ws, "ISE Maintenance", true));
  for (let i = 0; i < 3; i++) await savedButton("Total Prime");
  await button("試劑杯準備").click();
  await savedButton("取出並丟棄 CLEAN 杯");
  for (const id of [
    "S-H · Serum High",
    "S-L · Serum Low",
    "U-H · Urine High",
    "U-L · Urine Low",
  ])
    await clickSaved(page, () =>
      ws.getByLabel(`${id} 滴數`).pressSequentially("10", { delay: 1 }),
    );
  await closeProgram(ws);
  await clickSaved(page, () => instrument(ws, "ISE Maintenance", false));
  const configured = await page.evaluate(
    async () =>
      (await (await fetch("/api/attempts/active")).json()).attempt.sim,
  );
  expect(configured.drops).toEqual(["10", "10", "10", "10"]);
  expect(configured.prime).toBe(3);
  expect(configured.cup).toBe("discarded");
  await button("Calibration").click();
  await savedButton("Serum/Urine Start");
  await clickSaved(page, () =>
    ws.getByLabel("已檢查 Serum／Urine 數值", { exact: true }).check(),
  );
  await home("Analyzer Maintenance");
  await button("ISE Maintenance").click();
  await clickSaved(page, () => instrument(ws, "ISE Maintenance", true));
  await button("Replace Sample Probe").click();
  await savedButton("OK · 儲存 DIAG 設定");
  await savedButton("DIAG ise");
  await clickSaved(page, () =>
    ws.getByLabel("ISE 直線排水檢查", { exact: true }).selectOption("正常"),
  );
  await closeProgram(ws);
  await home("Reagent Management");
  await button("Details").click();
  for (const b of await ws.getByRole("button", { name: /^更換試劑 / }).all())
    await clickSaved(page, () => b.click());
  await button("Reagent Check").click();
  await savedButton("All positions");
  await expect(ws.locator(".stability-expired")).toHaveCount(17);
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
  for (const id of ["3.ALT", "5.AST", "15.HDL", "20.LDL", "9.CRE", "4.AMY"])
    await ws.getByRole("button", { name: `${id} RB`, exact: true }).click();
  for (const id of ["15.HDL", "20.LDL", "9.CRE"])
    await ws.getByRole("button", { name: `${id} Cal.`, exact: true }).click();
  await expect(ws.locator(".rack-required")).toHaveCount(0);
  await expect(ws.getByLabel("RB count", { exact: true })).toHaveText("6");
  await expect(ws.getByLabel("Cal count", { exact: true })).toHaveText("3");
  await expect(
    ws.getByRole("button", { name: "3.ALT RB", exact: true }),
  ).not.toHaveAttribute("title");
  await ws
    .getByRole("button", { name: "3.ALT RB", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(ws.locator(".ws-title")).toBeInViewport();
  await expect(ws.getByLabel("Rack Type", { exact: true })).toBeInViewport();
  await expect(
    ws.getByRole("button", { name: "Entry", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-exam-rack-expired-completed.png`,
  });
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "Entry", exact: true }).click(),
  );
  await ws.getByRole("button", { name: "QC", exact: true }).click();
  await ws.getByRole("button", { name: "Start Entry", exact: true }).click();
  for (const [type, group] of [
    ["Serum", "1.MAS QC"],
    ["Urine", "5.URINE QC"],
  ]) {
    await ws.getByLabel("Rack Type", { exact: true }).selectOption(type);
    await ws.getByRole("button", { name: "Profile", exact: true }).click();
    const profile = page.getByRole("dialog", {
      name: "QC Profile",
      exact: true,
    });
    await profile.getByRole("button", { name: group, exact: true }).click();
    await profile.getByRole("button", { name: "OK", exact: true }).click();
  }
  await ws.getByLabel("Rack Type", { exact: true }).selectOption("Serum");
  await expect(ws.getByLabel("Selected Tests")).toHaveText("37");
  await ws.getByLabel("Rack Type", { exact: true }).selectOption("Urine");
  await expect(ws.getByLabel("Selected Tests")).toHaveText("13");
  const revisionBeforeQc = await page.evaluate(
    async () =>
      (await (await fetch("/api/attempts/active")).json()).attempt.revision,
  );
  let uncertainQc = true;
  await page.route("**/api/attempts/*/events", async (route) => {
    if (
      route.request().postDataJSON()?.command?.type === "rack-qc-entry" &&
      uncertainQc
    ) {
      uncertainQc = false;
      await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.abort();
    } else {
      const response = await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", serverURL),
      });
      await route.fulfill({ response, body: await response.body() });
    }
  });
  await ws.getByRole("button", { name: "Entry", exact: true }).click();
  await expect(ws.getByRole("alert")).toBeVisible();
  await expect(ws.locator(".editing-badge")).toBeVisible();
  await expect(ws.getByLabel("Selected Tests")).toHaveText("13");
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "重試保存", exact: true }).click(),
  );
  await expect(ws.locator(".editing-badge")).not.toBeVisible();
  const qcSaved = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(qcSaved.revision).toBe(revisionBeforeQc + 1);
  expect(qcSaved.sim.rack.Serum.qc).toHaveLength(37);
  expect(qcSaved.sim.rack.Urine.qc).toHaveLength(13);
  expect(qcSaved.sim.rack.Serum.rb).toHaveLength(6);
  expect(qcSaved.sim.rack.Serum.cal).toHaveLength(3);
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-exam-qc-completed.png`,
  });
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await page
    .locator(".shared-exam-room > .simulator-shell > .topbar")
    .getByRole("button", { name: "備料工作台", exact: true })
    .click();
  await fillPreparationUI(page, true, async (i) => {
    if (i !== 0) return;
    const prep = page.getByRole("region", {
      name: "校正與品管備料",
      exact: true,
    });
    const started = (
      await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      )
    ).startedAt;
    const pick = page.waitForResponse(
      (r) => r.url().includes("/events") && r.request().method() === "POST",
    );
    await prep.getByTestId("prep-source-lcc1").click();
    await pick;
    let lost = false;
    const loseResponse = async (route: import("@playwright/test").Route) => {
      if (
        !lost &&
        route.request().postDataJSON()?.command?.type === "preparation" &&
        route.request().postDataJSON()?.command?.data?.action === "aspirate"
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
    await page.route("**/api/attempts/*/events", loseResponse);
    await prep.getByRole("button", { name: "吸取來源液", exact: true }).click();
    await expect(
      page
        .locator(".assessment-save-status")
        .getByRole("button", { name: "重試保存", exact: true }),
    ).toBeVisible();
    await expect(prep.locator(".prep-controls")).toContainText("移液器：空");
    const committed = (
      await page.evaluate(
        async () =>
          (await (await fetch("/api/attempts/active")).json()).attempt,
      )
    ).revision;
    await page.unroute("**/api/attempts/*/events", loseResponse);
    await clickSaved(page, () =>
      page
        .locator(".assessment-save-status")
        .getByRole("button", { name: "重試保存", exact: true })
        .click(),
    );
    const retried = await page.evaluate(
      async () => (await (await fetch("/api/attempts/active")).json()).attempt,
    );
    expect(retried.revision).toBe(committed);
    expect(retried.sim.preparation.pipette.materialId).toBe("lcc1");
    await reloadExamWindow(page);
    await page
      .locator(".shared-exam-room > .simulator-shell > .topbar")
      .getByRole("button", { name: "備料工作台", exact: true })
      .click();
    await expect(prep.locator(".prep-controls")).toContainText("LCC1");
    expect(
      (
        await page.evaluate(
          async () =>
            (await (await fetch("/api/attempts/active")).json()).attempt,
        )
      ).startedAt,
    ).toBe(started);
    await expect(
      page.locator(".exam-room .preparation-hud .prep-hint"),
    ).toHaveCount(0);
    await expect(page.locator(".exam-room .guidance-markers span")).toHaveCount(
      0,
    );
    await clickSaved(page, () =>
      prep.getByRole("button", { name: "清空移液器", exact: true }).click(),
    );
    await prep
      .getByRole("button", { name: "放大材料實機照片", exact: true })
      .click();
    await page.keyboard.press("e");
    await expect(prep.locator(".prep-controls")).toContainText("移液器：空");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "材料實機照片", exact: true }),
    ).not.toBeVisible();
  });
  await preparationShot(page, "exam-loaded", info.project.name);
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(page.locator(".exam-stats")).toContainText("100 / 100");
  await expect(page.locator(".exam-stats")).toContainText("操作錯誤0");
  await page.screenshot({
    path: `test-results/${info.project.name}-exam-daily-complete.png`,
  });
  await page.getByRole("button", { name: "返回歷程", exact: true }).click();
  await expect(page.locator(".exam-comparisons")).toContainText("0.8 → 100");
});
test("daily exam mode buttons are disabled natively and new inspection evidence resumes after refresh", async ({
  page,
}) => {
  await login(page, "student");
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "日保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  await expect(page.locator(".shared-exam-room")).toBeVisible();
  await selectPart(page, "syringes");
  await clickSaved(page, () =>
    page.getByTestId("context-syringe-front").click(),
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-front",
    "true",
  );
  await selectPart(page, "rear-syringes");
  await clickSaved(page, () =>
    page.getByTestId("context-syringe-rear").click(),
  );
  await expect(page.locator(".exam-room .viewer-host")).toHaveAttribute(
    "data-syringe-rear",
    "true",
  );
  await page
    .getByRole("region", { name: "考試任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  const ws = page.locator(".shared-exam-room .workstation");
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
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
  expect(after.version).toBe(currentDailyVersion);
  await clickSaved(page, () => instrument(ws, "ISE Maintenance", true));
  await expect(prime).toBeEnabled();
  await expect(cleaning).toBeDisabled();
  await ws.getByRole("button", { name: "Calibration", exact: true }).click();
  await expect(
    ws.getByRole("button", { name: "Serum/Urine Start", exact: true }),
  ).toBeDisabled();
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  const log = page.getByRole("region", { name: "考試任務紀錄" });
  await log.getByRole("button", { name: /補充 CLN-1/ }).click();
  await log.getByRole("button", { name: "操作電腦", exact: true }).click();
  await clickSaved(page, () => instrument(ws, "Standard／Buffer 罩", true));
  await clickSaved(page, () =>
    ws.getByRole("button", { name: "更換 ISE Standard", exact: true }).click(),
  );
  await instrument(ws, "後方 syringe 櫃門", true);
  await clickSaved(page, () =>
    ws
      .getByLabel("後方 syringe 組 漏水檢查", { exact: true })
      .selectOption("正常"),
  );
  await ws.getByRole("button", { name: "返回日保養", exact: true }).click();
  await expect(ws).not.toContainText("擦拭後才檢查排水");
  await expect(ws).not.toContainText("目前步驟");
  await expect(
    ws.getByRole("button", { name: "重設並開始新一輪日保養" }),
  ).toHaveCount(0);
  await reloadExamWindow(page);
  await expect(page.getByRole("region", { name: "日保養考試" })).toBeVisible({
    timeout: 12000,
  });
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
  test.skip(
    !isTaskOpen("weekly"),
    "首波關閉周保養，保留原操作測試待重新開放。",
  );
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
  await expect(page.locator(".assessment-save-status")).toContainText(
    "鎖頭仍鎖緊",
  );
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
  await reloadExamWindow(page);
  await expect(page.getByRole("region", { name: "周保養考試" })).toBeVisible({
    timeout: 12000,
  });
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
      await route.fulfill({ response, body: await response.body() });
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
  await expect(page.locator(".assessment-save-status")).toContainText(
    "操作已保存",
  );
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
  test.skip(
    !isTaskOpen("weekly"),
    "首波關閉周保養，保留原操作測試待重新開放。",
  );
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
  await reloadExamWindow(page);
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
  await reloadExamWindow(page);
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
  await expect(page.getByRole("heading", { name: "選擇保養任務" })).toBeVisible(
    { timeout: 12000 },
  );
});

test("HUD exam preserves screen drafts, canvas and time without disclosing answers", async ({
  page,
}, info) => {
  await login(page, "student");
  await page
    .locator(".mission-card")
    .filter({ has: page.getByRole("heading", { name: "日保養", exact: true }) })
    .getByRole("button", { name: "開始測驗" })
    .click();
  const room = page.locator(".exam-room"),
    canvas = room.getByTestId("model-canvas");
  await expect(room).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate((el) =>
    el.setAttribute("data-persistence-check", "same-scene"),
  );
  const before = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(before.progress).toEqual({ completedGroups: 0, totalGroups: 13 });
  await selectTarget(page, "ISE");
  const panel = room.locator(".detail-panel");
  await panel.getByRole("button", { name: "實機照片", exact: true }).click();
  const image = panel.locator(".hud-part-info figure img");
  await expect(image).toHaveAttribute(
    "src",
    "/references/real-photos/ISE probe.jpg",
  );
  await expect
    .poll(() =>
      image.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(room.locator(".guidance-markers span")).toHaveCount(0);
  await expect(room.locator(".hud-control-target")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-exam.png`,
  });
  await room
    .getByRole("region", { name: "考試任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  const ws = room.locator(".workstation");
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws
    .getByRole("button", { name: "Analyzer Status", exact: true })
    .click();
  await ws.getByLabel("Bath Temp. 登記").fill("37.5");
  await page.keyboard.press("Escape");
  await expect(ws).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ws).not.toBeVisible();
  await room.getByRole("button", { name: "操作電腦", exact: true }).click();
  await expect(ws.locator(".ws-title")).toContainText("Analyzer Status");
  await expect(ws.getByLabel("Bath Temp. 登記")).toHaveValue("37.5");
  await expect(canvas).toHaveAttribute("data-persistence-check", "same-scene");
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-exam-workstation.png`,
  });
  const after = await page.evaluate(
    async () => (await (await fetch("/api/attempts/active")).json()).attempt,
  );
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.revision).toBe(before.revision);
  expect(after.progress).toEqual(before.progress);
  await ws
    .locator(".ws-toolbar")
    .getByRole("button", { name: "到模型操作", exact: true })
    .click();
  await room.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "確認交卷", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "日保養 · 本次成果" }),
  ).toBeVisible();
});
