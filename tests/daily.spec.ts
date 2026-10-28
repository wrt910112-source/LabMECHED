import { instrument, closeProgram, cups, iseDrain, replaceAll } from "./ui";
import { prepareDailyTasks } from "./daily-fixture";
import { test, expect } from "@playwright/test";
test("daily maintenance sequence, prerequisites, six probes, calibration and paired reagents", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  await page
    .getByRole("region", { name: "練習任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
  const screen = page.locator(".workstation");
  const button = (name: string) =>
    screen.getByRole("button", { name, exact: true });
  const home = async (name: string) => {
    await button("Home 主選單").click();
    await button(name).click();
  };
  await button("日保養").click();
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
  await instrument(screen, "主蓋開啟", true);
  await instrument(screen, "Analyzer Maintenance", true);
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
  await instrument(screen, "ISE Maintenance", false);
  await instrument(screen, "ISE 上蓋開啟", true);
  await button("Cleaning").click();
  await expect(screen.getByRole("status")).toContainText("裝滿");
  await cups(screen, async () => {
    await button("在 CLEAN 放置裝滿的 Cleaning Solution").click();
  });
  await button("Cleaning").click();
  await instrument(screen, "ISE Maintenance", false);
  await expect(button("Total Prime")).toBeDisabled();
  await instrument(screen, "ISE Maintenance", true);
  await button("Total Prime").click();
  await button("Total Prime").click();

  await button("Total Prime").click();
  await button("Total Prime").click();
  await expect(screen.getByRole("status")).toContainText("3／3");
  await instrument(screen, "ISE Maintenance", false);
  await button("Calibration").click();
  await button("Serum/Urine Start").click();
  await expect(screen.getByRole("status")).toContainText("四杯");
  await button("試劑杯準備").click();
  await button("取出並丟棄 CLEAN 杯").click();
  for (const cup of [
    "S-H · Serum High",
    "S-L · Serum Low",
    "U-H · Urine High",
    "U-L · Urine Low",
  ])
    await screen.getByLabel(`${cup} 滴數`).fill("10");
  await screen.getByLabel("U-L · Urine Low 滴數").fill("9");
  await closeProgram(screen);
  await button("Serum/Urine Start").click();
  await expect(screen.getByLabel("已檢查 Serum／Urine 數值")).toBeDisabled();
  await button("試劑杯準備").click();
  await screen.getByLabel("U-L · Urine Low 滴數").fill("10");
  await closeProgram(screen);
  await button("Serum/Urine Start").click();
  await screen.getByLabel("已檢查 Serum／Urine 數值").check();
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-calibration.png`,
  });
  await home("Reagent Management");
  await button("Details").click();
  await button("Reagent Check").click();
  await button("All positions").click();
  await expect(screen.getByRole("status")).toContainText("十一瓶");

  await replaceAll(screen);
  await button("Reagent Check").click();
  await button("All positions").click();
  await expect(screen.getByRole("status")).toContainText(
    "All positions 已完成",
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-reagents.png`,
  });
  await iseDrain(screen);
  await button("日保養").click();
  await expect(screen.locator(".daily-steps")).toContainText(
    "Rack Requisition",
  );
  await expect(screen.locator(".ws-session-hud")).toContainText("11／12");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.getByTestId("part-console").click();
  await expect(screen.locator(".ws-session-hud")).toContainText("11／12");
  await home("Rack Requisition");
  await button("Calibration").click();
  await button("Start Entry").click();
  await button("97.Na Cal.").click();
  await button("Entry").click();
  await button("QC").click();
  await button("Start Entry").click();
  await button("Profile").click();
  const qc = screen.getByRole("dialog", { name: "QC Profile" });
  await qc.getByRole("button", { name: "1.MAS QC", exact: true }).click();
  await qc.getByRole("button", { name: "OK", exact: true }).click();
  await button("Entry").click();
  await screen.getByLabel("Rack Type").selectOption("Urine");
  await button("Start Entry").click();
  await button("Profile").click();
  await qc.getByRole("button", { name: "5.URINE QC", exact: true }).click();
  await qc.getByRole("button", { name: "OK", exact: true }).click();
  await button("Entry").click();
  await expect(screen.locator(".ws-session-hud")).toContainText("12／12");
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-daily-complete.png`,
  });
  await button("日保養").click();
  await button("重設並開始新一輪日保養").click();
  await page.getByRole("button", { name: "重新開始練習", exact: true }).click();
  await page.getByRole("button", { name: "確認重新開始", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "練習任務紀錄" }),
  ).toContainText("0／12");
  expect(errors).toEqual([]);
});
