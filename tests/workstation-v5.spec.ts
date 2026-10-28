import { test, expect } from "@playwright/test";
import { prepareDailyTasks } from "./daily-fixture";
import {
  selectPart,
  startDaily,
  instrument,
  iseDrain,
  closeProgram,
  replaceAll,
} from "./ui";
test("unified software restores workspace and ISE drain stays independent of six wipes", async ({
  page,
}, info) => {
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await selectPart(page, "console");
  const ws = page.locator(".workstation");
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  const home = async (name: string) => {
    await b("Home 主選單").click();
    await b(name).click();
  };
  await home("Analyzer Maintenance");
  const original = (await ws.locator(".ws-maintenance-body").boundingBox())!;
  expect(original.height).toBeGreaterThan(page.viewportSize()!.height * 0.42);
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-explore-maintenance.png`,
  });
  await startDaily(page);
  await home("Analyzer Maintenance");
  const practice = (await ws.locator(".ws-maintenance-body").boundingBox())!;
  expect(Math.abs(original.height - practice.height)).toBeLessThan(5);
  await expect(ws.locator(".ws-maintenance-list .daily-practice")).toHaveCount(
    0,
  );
  await expect(ws.locator(".ws-table-scroll th")).toHaveText([
    "No.",
    "Maintenance",
    "Pending",
    "Performed",
    "Frequency",
  ]);
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-practice-maintenance.png`,
  });
  await iseDrain(ws);
  await expect(ws.locator(".ws-session-hud")).toContainText("日保養 0／12");
  await expect(b("Replace Sample Probe")).toBeDisabled();
  await instrument(ws, "ISE Maintenance", true);
  await b("Replace Sample Probe").click();
  await expect(ws.getByLabel("ISE 直線排水檢查")).toHaveValue("正常");
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-ise-diag.png`,
  });
  await closeProgram(ws);
  await b("退出螢幕 ×").click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await expect(log).toContainText("1／9");
  await expect(log).toContainText("0／6");
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.locator(".directory-targets summary").click();
  await page.getByTestId("target-ISE").click();
  await expect(page.locator(".model-practice")).toContainText("ISE probe");
  await expect(
    page.getByRole("button", { name: "用酒精棉擦拭 ISE", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("QC cross-Type draft, current-Type selection, Exit and single Entry preserve calibration", async ({
  page,
}, info) => {
  page.setDefaultTimeout(12000);
  await page.goto("/");
  await selectPart(page, "console");
  const ws = page.locator(".workstation");
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  await b("Home 主選單").click();
  await b("Rack Requisition").click();
  await b("Calibration").click();
  await b("Start Entry").click();
  await b("9.CRE RB").click();
  await b("Entry").click();
  await b("QC").click();
  await b("Start Entry").click();
  await b("3.ALT").click();
  await ws.getByLabel("Rack Type").selectOption("Urine");
  await b("9.CRE").click();
  await ws.getByLabel("Rack Type").selectOption("Serum");
  await expect(b("3.ALT")).toHaveAttribute("aria-pressed", "true");
  await b("Deselect All Tests").click();
  await expect(b("3.ALT")).toHaveAttribute("aria-pressed", "false");
  await ws.getByLabel("Rack Type").selectOption("Urine");
  await expect(b("9.CRE")).toHaveAttribute("aria-pressed", "true");
  await b("Exit").click();
  await expect(b("9.CRE")).toHaveAttribute("aria-pressed", "false");
  await b("Start Entry").click();
  await b("9.CRE").click();
  await ws.getByLabel("Rack Type").selectOption("Serum");
  await b("3.ALT").click();
  await b("退出螢幕 ×").click();
  await selectPart(page, "console");
  await expect(b("3.ALT")).toHaveAttribute("aria-pressed", "true");
  await expect(ws.locator(".editing-badge")).toBeVisible();
  await ws.getByLabel("Rack Type").selectOption("Urine");
  await expect(b("9.CRE")).toHaveAttribute("aria-pressed", "true");
  await b("Entry").click();
  await expect(ws.locator(".editing-badge")).not.toBeVisible();
  await ws.getByLabel("Rack Type").selectOption("Serum");
  await expect(b("3.ALT")).toHaveAttribute("aria-pressed", "true");
  await b("Calibration").click();
  await expect(b("9.CRE RB")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-rack-workspace.png`,
  });
});

test("eleven Comment replacements require AMY, expose RB six / Cali three and keep the original full Details table", async ({
  page,
}, info) => {
  page.setDefaultTimeout(12000);
  await page.goto("/");
  await startDaily(page);
  const ws = page.locator(".workstation");
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  const home = async (name: string) => {
    await b("Home 主選單").click();
    await b(name).click();
  };
  await prepareDailyTasks(page, ws);
  await home("Analyzer Status");
  await ws.getByLabel("Bath Temp. 登記").fill("37");
  await ws.getByLabel("Coolant Temp. 登記").fill("8.2");
  await b("儲存溫度紀錄").click();
  await home("Start Condition");
  await b("Edit").click();
  await b("New Index").click();
  await home("Reagent Management");
  await b("Details").click();
  await expect(ws.locator(".reagent-detail th")).toHaveCount(12);
  await expect(ws.getByRole("button", { name: /^更換試劑 / })).toHaveCount(11);
  await expect(ws.locator(".reagent-training")).toHaveCount(0);
  await expect(ws.getByRole("textbox")).toHaveCount(0);
  for (const button of await ws
    .getByRole("button", { name: /^更換試劑 / })
    .all())
    if ((await button.getAttribute("aria-label")) !== "更換試劑 AMY R1") {
      await button.click();
      await expect(button).toBeDisabled();
    }
  const amy = ws.getByTestId("reagent-R1-49");
  await expect(amy).toContainText("180");
  await expect(amy).toContainText("即將到期");
  await b("Reagent Check").click();
  await b("All positions").click();
  await expect(ws.getByRole("status")).toContainText("十一瓶");
  await b("更換試劑 AMY R1").click();
  await b("All positions").click();
  await expect(ws.locator(".stability-expired")).toHaveCount(17);
  await amy.scrollIntoViewIfNeeded();
  await expect(b("Reagent Check")).toBeInViewport();
  await expect(ws.locator(".ws-tabs")).toBeInViewport();
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-practice-details.png`,
  });
  await home("Rack Requisition");
  await b("Calibration").click();
  await expect(ws.locator(".rack-requirements")).toHaveText(
    /3.ALT.*5.AST.*15.HDL.*20.LDL.*9.CRE.*4.AMY.*15.HDL.*20.LDL.*9.CRE/,
  );
  await expect(b("Start Entry")).toBeDisabled();
  await expect(ws.locator(".rack-scroll")).toBeInViewport();
  await page.screenshot({
    path: `artifacts/workstation-v5/${info.project.name}-v5-practice-rack.png`,
  });
});

test("ISE DET physical operations need its black cover, without Maintenance, in exploration and daily practice", async ({
  page,
}) => {
  page.setDefaultTimeout(12000);
  await page.goto("/");
  for (const practice of [false, true]) {
    if (practice) {
      await startDaily(page);
      await page
        .locator(".workstation")
        .getByRole("button", { name: "退出螢幕 ×", exact: true })
        .click();
    }
    await selectPart(page, "ise");
    await page.getByRole("button", { name: /操作洗滌劑瓶與 2/ }).click();
    await page.getByTestId("slot-ise-wash-1").click();
    const refill = page.getByRole("button", { name: "補充", exact: true });
    await expect(refill).toBeDisabled();
    await page.getByTestId("context-ise-top-rear").click();
    await expect(refill).toBeEnabled();
    await refill.click();
    await expect(page.getByTestId("bottle-controls")).toHaveAttribute(
      "data-level",
      "1",
    );
    await page.getByTestId("slot-ise-wash-2").click();
    await expect(refill).toBeEnabled();
    await refill.click();
    await expect(page.getByTestId("bottle-controls")).toHaveAttribute(
      "data-level",
      "1",
    );
    await page.getByTestId("context-ise-top-rear").click();
    await expect(refill).toBeDisabled();
  }
});
