import { prepareDailyTasks } from "./daily-fixture";
import { test, expect } from "@playwright/test";
test("3D daily targets operate probes and ISE cups with shared workstation progress", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByTestId("part-console").click();
  const screen = page.locator(".workstation");
  const b = (n: string) => screen.getByRole("button", { name: n, exact: true });
  const home = async (n: string) => {
    await b("Home 主選單").click();
    await b(n).click();
  };
  await b("日保養").click();
  await b("開始日保養").click();
  await home("Analyzer Status");
  await screen.getByLabel("Bath Temp. 登記").fill("37");
  await screen.getByLabel("Coolant Temp. 登記").fill("8.2");
  await b("儲存溫度紀錄").click();
  await home("Start Condition");
  await b("Edit").click();
  await b("New Index").click();
  await home("Analyzer Maintenance");
  await screen.getByLabel("Analyzer Maintenance", { exact: true }).check();
  await screen.getByLabel("主蓋開啟", { exact: true }).check();
  await screen.getByLabel("ISE 上蓋開啟", { exact: true }).check();
  await b("Cleaning Probe").click();
  await b("到模型操作").click();
  const panel = page.locator(".model-practice");
  const pb = (n: string) => panel.getByRole("button", { name: n, exact: true });
  await expect(screen).not.toBeVisible();
  for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"]) {
    await pb(id).click();
    await page
      .getByRole("button", { name: `模型操作 ${id}`, exact: true })
      .click();
    await pb(`用酒精棉擦拭 ${id}`).click();
    await expect(pb(`用酒精棉擦拭 ${id}`)).toBeDisabled();
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-model-wipe.png`,
  });
  await pb("返回電腦繼續程序").click();
  await expect(screen.locator(".daily-practice")).toContainText("已擦拭 6／6");
  await b("Inspect Probe & Mixing Bar").click();
  await b("到模型操作").click();
  for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"]) {
    await pb(id).click();
    await pb(`確認 ${id} 正常排水`).click();
  }
  for (const id of ["左側", "右側"]) {
    await pb(id).click();
    await pb(`確認 ${id} mixing bars 正常`).click();
  }
  await pb("返回電腦繼續程序").click();
  await b("ISE Maintenance").click();
  await b("到模型操作").click();
  await page.getByRole("button", { name: "模型操作 U-L", exact: true }).click();
  await pb("放入裝滿 Cleaning Solution 的 CLEAN 杯").click();
  await expect(panel).toContainText("已裝滿");
  await pb("返回電腦繼續程序").click();
  await prepareDailyTasks(page, screen);
  await home("Analyzer Maintenance");
  await b("ISE Maintenance").click();
  await screen.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await b("Cleaning").click();
  await screen.getByLabel("ISE Maintenance", { exact: true }).check();
  for (let i = 0; i < 3; i++) await b("Total Prime").click();
  await b("到模型操作").click();
  await pb("取出並丟棄 CLEAN 杯").click();
  for (const [i, id] of ["S-H", "S-L", "U-H", "U-L"].entries()) {
    await pb(id).click();
    await pb(`放入 ${id} 校正杯`).click();
    for (let j = 0; j < 10; j++)
      await pb(
        `滴入 1 滴 ${["Serum High", "Serum Low", "Urine High", "Urine Low"][i]}`,
      ).click();
    await expect(panel).toContainText("已加入 10 滴");
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-model-cups.png`,
  });
  await pb("返回電腦繼續程序").click();
  await screen.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await b("Calibration").click();
  await b("Serum/Urine Start").click();
  await expect(screen.getByLabel("已檢查 Serum／Urine 數值")).toBeEnabled();
  expect(errors).toEqual([]);
});
