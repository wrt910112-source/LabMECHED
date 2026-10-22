import { prepareDailyTasks } from "./daily-fixture";
import { test, expect } from "@playwright/test";
test("daily maintenance sequence, prerequisites, six probes, calibration and paired reagents", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByTestId("part-console").click();
  const screen = page.locator(".workstation");
  const button = (name: string) =>
    screen.getByRole("button", { name, exact: true });
  const home = async (name: string) => {
    await button("Home 主選單").click();
    await button(name).click();
  };
  await button("日保養").click();
  await button("開始日保養").click();
  await home("Start Condition");
  await expect(button("New Index")).toBeDisabled();
  await home("Analyzer Status");
  await screen.getByLabel("Bath Temp. 登記").fill("37.0");
  await screen.getByLabel("Coolant Temp. 登記").fill("8.2");
  await button("儲存溫度紀錄").click();
  await home("Start Condition");
  await button("Edit").click();
  await button("New Index").click();
  await expect(screen.locator(".daily-page")).toContainText(
    "已建立本次練習 Index",
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-start.png`,
  });
  await home("Analyzer Maintenance");
  await button("Cleaning Probe").click();
  await expect(screen.getByRole("status")).toContainText("主蓋");
  await screen.getByLabel("主蓋開啟", { exact: true }).check();
  await screen.getByLabel("Analyzer Maintenance", { exact: true }).check();
  await button("Cleaning Probe").click();
  await button("Inspect Probe & Mixing Bar").click();
  await expect(screen.getByRole("status")).toContainText("6 支");
  for (const p of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
    await button(`酒精棉擦拭 ${p}`).click();
  await button("Inspect Probe & Mixing Bar").click();
  for (const p of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
    await screen.getByLabel(`${p} 排水`, { exact: true }).selectOption("正常");
  for (const s of ["左側", "右側"])
    await screen.getByLabel(`${s} mixing bars`).selectOption("正常");
  await prepareDailyTasks(page, screen);
  await home("Analyzer Maintenance");
  await button("ISE Maintenance").click();
  await screen.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await screen.getByLabel("ISE 上蓋開啟", { exact: true }).check();
  await button("Cleaning").click();
  await expect(screen.getByRole("status")).toContainText("裝滿");
  await button("在 CLEAN 放置裝滿的 Cleaning Solution").click();
  await button("Cleaning").click();
  await screen.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await expect(button("Total Prime")).toBeDisabled();
  await screen.getByLabel("ISE Maintenance", { exact: true }).check();
  await button("Total Prime").click();
  await button("Total Prime").click();
  await expect(button("取出並丟棄 CLEAN 杯")).toBeEnabled();
  await button("Total Prime").click();
  await button("Total Prime").click();
  await expect(screen.getByRole("status")).toContainText("3／3");
  await screen.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await button("Calibration").click();
  await button("Serum/Urine Start").click();
  await expect(screen.getByRole("status")).toContainText("四杯");
  await button("取出並丟棄 CLEAN 杯").click();
  for (const cup of [
    "S-H · Serum High",
    "S-L · Serum Low",
    "U-H · Urine High",
    "U-L · Urine Low",
  ])
    await screen.getByLabel(`${cup} 滴數`).fill("10");
  await screen.getByLabel("U-L · Urine Low 滴數").fill("9");
  await button("Serum/Urine Start").click();
  await expect(screen.getByLabel("已檢查 Serum／Urine 數值")).toBeDisabled();
  await screen.getByLabel("U-L · Urine Low 滴數").fill("10");
  await button("Serum/Urine Start").click();
  await screen.getByLabel("已檢查 Serum／Urine 數值").check();
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-calibration.png`,
  });
  await home("Reagent Management");
  await button("Details").click();
  await button("Reagent Check").click();
  await button("All positions").click();
  await expect(screen.getByRole("status")).toContainText("逐項記錄");
  await button("取消").click();
  for (const [n, s] of [
    ["ALT", "R1"],
    ["ALT", "R2"],
    ["AST", "R1"],
  ])
    await button(`更換 ${n} ${s}`).click();
  for (const [n, s] of [
    ["ALT", "R1"],
    ["ALT", "R2"],
    ["AST", "R1"],
    ["AST", "R2"],
    ["GLU", "R1"],
  ]) {
    await screen
      .getByLabel(`${n} ${s} 紀錄`, { exact: true })
      .fill("已確認足夠至下次保養");
    await screen.getByLabel(`${n} ${s} 用量已檢查`).check();
  }
  await button("Reagent Check").click();
  await button("All positions").click();
  await expect(screen.getByRole("status")).toContainText(
    "All positions 教學檢查完成",
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-reagents.png`,
  });
  await button("日保養").click();
  await expect(screen.locator(".daily-steps")).toContainText(
    "Rack Requisition",
  );
  await expect(screen.locator(".daily-progress")).toContainText("11／12");
  await page.keyboard.press("Escape");
  await page.getByTestId("part-console").click();
  await expect(screen.locator(".daily-progress")).toContainText("11／12");
  await button("日保養").click();
  await button("重設並開始新一輪日保養").click();
  await expect(screen.locator(".daily-progress")).toContainText("0／12");
  expect(errors).toEqual([]);
});
