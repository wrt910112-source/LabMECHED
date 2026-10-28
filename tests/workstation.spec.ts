import { selectPart } from "./ui";
import { test, expect } from "@playwright/test";
import {
  analyzerActions,
  iseActions,
  analyzerFooter,
  iseFooter,
  mainMenu,
} from "../src/workstationData";
test("workstation full screen navigation, maintenance layouts and temperature checks", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await selectPart(page,"console");
  const screen = page.getByRole("dialog", { name: "AU5800 操作工作站" });
  await expect(screen).toBeVisible();
  const bounds = await screen.boundingBox();
  expect(bounds!.width).toBeGreaterThan(page.viewportSize()!.width * 0.95);
  expect(bounds!.height).toBeGreaterThan(page.viewportSize()!.height * 0.90);
  await expect(screen.locator(".ws-status-links button")).toHaveText([
    "Sample Status",
    "Analyzer Status",
  ]);
  await expect(screen.locator(".ws-home-footer button")).toHaveText(mainMenu);
  await page.screenshot({
    path: `test-results/${info.project.name}-workstation-home.png`,
  });
  await screen
    .getByRole("button", { name: "Analyzer Status", exact: true })
    .click();
  await expect(screen.locator("output")).toHaveText(["37.0", "8.2"]);
  await screen.getByLabel("Bath Temp. 已檢查").check();
  await screen.getByLabel("Coolant Temp. 已檢查").check();
  await expect(screen.locator(".ws-check-count")).toHaveText("已檢查 2／2 項");
  await page.screenshot({
    path: `test-results/${info.project.name}-workstation-status.png`,
  });
  await screen
    .getByRole("button", { name: "Home 主選單", exact: true })
    .click();
  await screen
    .getByRole("button", { name: "Analyzer Maintenance", exact: true })
    .click();
  await expect(
    screen.getByRole("button", { name: "PRO Service", exact: true }),
  ).toBeDisabled();
  await expect(screen.locator(".ws-tabs button")).toHaveText([
    "Maintenance",
    "Consumption",
    "Photocal Monitor",
  ]);
  await expect(screen.locator(".ws-action-grid button")).toHaveText(
    analyzerActions.flat().filter(Boolean) as string[],
  );
  await expect(screen.locator(".ws-footer button")).toHaveText(analyzerFooter);
  await screen.getByLabel("Analyzer Maintenance", { exact: true }).check();
  await screen
    .getByRole("button", { name: "Replace Sample Probe", exact: true })
    .click();
  await expect(screen.getByRole("status")).toContainText("未執行儀器動作");
  await page.screenshot({
    path: `test-results/${info.project.name}-workstation-analyzer.png`,
  });
  await screen
    .getByRole("button", { name: "Consumption", exact: true })
    .click();
  await expect(screen.locator(".ws-placeholder")).toContainText("Consumption");
  await screen
    .getByRole("button", { name: "ISE Maintenance", exact: true })
    .click();
  await expect(screen.locator(".ws-tabs button")).toHaveText([
    "Maintenance",
    "Calibration",
    "Slope Chart",
    "Selectivity Check",
  ]);
  await expect(screen.locator(".ws-action-grid button")).toHaveText(
    iseActions.flat().filter(Boolean) as string[],
  );
  await expect(screen.locator(".ws-footer button")).toHaveText(iseFooter);
  const flow = await screen
    .getByRole("button", { name: "Drain Flowcell", exact: true })
    .boundingBox();
  const bypass = await screen
    .getByRole("button", { name: "Drain Bypass", exact: true })
    .boundingBox();
  expect(flow!.x).toBe(bypass!.x);
  expect(flow!.y).toBeLessThan(bypass!.y);
  await page.screenshot({
    path: `test-results/${info.project.name}-workstation-ise.png`,
  });
  await screen
    .getByRole("button", { name: "Calibration", exact: true })
    .click();
  await expect(
    screen.getByRole("button", { name: "Serum/Urine Start", exact: true }),
  ).toBeVisible();
  for (const b of ["Slope Chart", "Selectivity Check"]) {
    await screen.getByRole("button", { name: b, exact: true }).click();
    await expect(screen.locator(".ws-placeholder h2")).toHaveText(b);
  }
  await screen
    .getByRole("button", { name: "Load Reagent Parameters", exact: true })
    .click();
  await expect(screen.locator(".ws-placeholder")).toContainText(
    "參數載入流程尚未加入",
  );
  await page.keyboard.press("Escape");
  await expect(screen).not.toBeVisible();
  await expect(page.getByTestId("model-canvas")).toBeVisible();
  await selectPart(page,"console");
  await screen
    .getByRole("button", { name: "Home 主選單", exact: true })
    .click();
  await screen
    .getByRole("button", { name: "Analyzer Status", exact: true })
    .click();
  await expect(screen.getByLabel("Bath Temp. 已檢查")).toBeChecked();
  await screen
    .getByRole("button", { name: "開始新的保養檢查", exact: true })
    .click();
  await expect(screen.locator(".ws-check-count")).toHaveText("已檢查 0／2 項");
  await screen.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await expect(screen).not.toBeVisible();
  expect(errors).toEqual([]);
});
