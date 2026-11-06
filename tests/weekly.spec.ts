import { isTaskOpen } from "../shared/availability";
import { test, expect } from "@playwright/test";
test.skip(
  !isTaskOpen("weekly"),
  "首波未開放周保養，操作規則仍由共用 reducer 測試覆蓋。",
);

test("weekly maintenance completes with independent probe, rod, W2 and restoration gates", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.locator(".mission-tile").nth(1).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.getByTestId("part-syringes").click();
  await page.getByRole("button", { name: "操作", exact: true }).click();
  const workstation = page.getByRole("dialog", { name: "AU5800 操作工作站" });
  const panel = page.locator("aside .weekly-panel");
  const b = (s: string) => panel.getByRole("button", { name: s, exact: true });
  await panel
    .getByLabel("確認預熱／待機，備妥 70% 異丙醇、無絨軟布、通針鐵絲")
    .check();
  for (const id of ["R2-2", "R2-1", "R1-1", "R1-2"])
    await panel.getByLabel(`${id} 水氣檢查`).selectOption("正常");
  await panel.getByLabel("Analyzer Maintenance 保養模式").check();
  await panel.getByLabel("主蓋開啟").check();
  await panel.getByLabel("ISE 上蓋開啟").check();
  await panel.getByLabel("ISE Maintenance 保養模式", { exact: true }).check();
  await b("探針").click();
  for (const id of ["Sample-1", "Sample-2", "ISE"]) {
    await panel.getByRole("button", { name: `${id} 0/7`, exact: true }).click();
    await page.getByRole("button", { name: /聚焦部件/ }).click();
    await expect(
      page.locator(`[data-weekly-id="lock-${id}"]`),
    ).toBeInViewport();
    await page.locator(`[data-weekly-id="lock-${id}"]`).click();
    for (let i = 0; i < 5; i++)
      await page.locator(`[data-weekly-id="tip-${id}"]`).click();
    await expect(b("確定排水設定，準備按模型 DIAG")).toBeDisabled();
    await expect(
      page.locator(`[data-weekly-id="lock-${id}"]`),
    ).toBeInViewport();
    await page.locator(`[data-weekly-id="lock-${id}"]`).click();
    await panel
      .getByLabel("比色杯", { exact: true })
      .selectOption(id === "Sample-1" ? "內部" : "外部");
    await b("確定排水設定，準備按模型 DIAG").click();
    await b("查看對應 DIAG 位置").click();
    await page
      .locator(`[data-weekly-id="diag-${id === "ISE" ? "ise" : "sample"}"]`)
      .click();
    await panel.getByLabel(`${id} 直線排水檢查`).selectOption("正常");
  }
  await b("攪拌棒").click();
  await panel.getByLabel("R1S 整組彎曲／損傷檢查").selectOption("異常");
  for (const side of ["右", "左"]) {
    await b(`取下清潔 mixer bar 並裝回（${side}側）`).click();
    await expect(b(`取下清潔 mixer bar 並裝回（${side}側）`)).toBeEnabled();
  }
  await expect(panel.getByLabel("R1S 整組彎曲／損傷檢查")).toHaveValue("異常");
  await expect(b("確定攪拌設定，準備按模型 DIAG")).toBeDisabled();
  for (const group of ["R1S", "R2"])
    await panel.getByLabel(`${group} 整組彎曲／損傷檢查`).selectOption("正常");
  await b("孔洞清潔").click();
  await b("棉棒沾取 Cleaning Solution").click();
  for (const group of ["R1S", "R2"]) {
    await b(group === "R1S" ? "查看右側 12孔" : "查看左側 6孔").click();
    for (let i = 1; i <= (group === "R1S" ? 12 : 6); i++)
      await page.locator(`[data-weekly-id="well-${group}-${i}"]`).click();
    await page.screenshot({
      path: `test-results/${info.project.name}-weekly-wells-${group}.png`,
    });
  }
  await expect(panel).toContainText("逐孔清潔 · 18/18");
  await page.locator('[data-weekly-id="well-R2-6"]').click();
  await expect(panel).toContainText("逐孔清潔 · 18/18");
  await b("攪拌棒").click();
  await b("確定攪拌設定，準備按模型 DIAG").click();
  await b("查看對應 DIAG 位置").click();
  await page.locator('[data-weekly-id="diag-front"]').click();
  await panel.getByLabel("攪拌運轉／異音").selectOption("正常");
  await page.screenshot({
    path: `test-results/${info.project.name}-weekly-model.png`,
  });
  await b("W2 準備").click();
  for (const id of ["sample-left-2", "sample-right-2"])
    await panel
      .locator(`.weekly-bottle[data-slot="${id}"]`)
      .getByRole("button", { name: "取出", exact: true })
      .click();
  const slots = [
    "r2-outer-3",
    "r2-inner-3",
    "r1-inner-3",
    "r1-outer-3",
    "sample-left-1",
    "sample-right-1",
    "ise-wash-1",
  ];
  for (const id of slots) {
    const row = panel.locator(`.weekly-bottle[data-slot="${id}"]`);
    const remove = row.getByRole("button", { name: "取出", exact: true });
    if (await remove.isEnabled()) await remove.click();
    await row.getByRole("button", { name: "放入滿瓶 W2", exact: true }).click();
  }
  await b("U-L／CLEAN 放入滿杯 Cleaning Solution").click();
  await b("到工作站操作").click();
  await workstation
    .getByRole("button", { name: "Home 主選單", exact: true })
    .click();
  await workstation
    .getByRole("button", { name: "Analyzer Maintenance", exact: true })
    .click();
  await expect(
    workstation.getByRole("dialog", { name: "W2 設定" }),
  ).not.toBeVisible();
  await workstation.getByRole("button", { name: "W2", exact: true }).click();
  const screen = page.locator(".weekly-dialog .weekly-panel");
  await screen
    .getByRole("button", { name: "OK · Start W2", exact: true })
    .click();
  await expect(screen.getByRole("status")).toContainText("尚未符合");
  await screen.getByLabel("After W2 ends, perform the photocal").check();
  await screen.getByLabel("ISE Cleaning (Enhanced)").check();
  await screen.getByLabel("主蓋開啟").uncheck();
  await page.screenshot({
    path: `test-results/${info.project.name}-weekly-w2.png`,
  });
  await screen
    .getByRole("button", { name: "OK · Start W2", exact: true })
    .click();
  await expect(screen).toContainText("W2（實機約 30 分鐘）");
  await screen.getByRole("button", { name: "教學快轉", exact: true }).click();
  await expect(screen).toContainText("Photocal（教學示意）");
  await screen.getByRole("button", { name: "教學快轉", exact: true }).click();
  await workstation
    .getByRole("button", { name: "關閉 W2 設定", exact: true })
    .click();
  await workstation
    .getByRole("button", { name: "Photocal Monitor", exact: true })
    .click();
  await expect(workstation.locator(".photocal-grid span")).toHaveCount(204);
  await page.screenshot({
    path: `test-results/${info.project.name}-weekly-photocal.png`,
  });
  await workstation
    .getByRole("button", { name: "確認本次正常結果", exact: true })
    .click();
  await page.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await b("復原").click();
  await panel.getByLabel("主蓋開啟").check();
  for (const id of slots) {
    const row = panel.locator(`.weekly-bottle[data-slot="${id}"]`);
    await row.getByRole("button", { name: "取出", exact: true }).click();
  }
  for (const label of ["55.Diluent/W2", "56.Diluent/W2"])
    await panel.getByLabel(`${label} 依科內 SOP 完成清潔`).check();
  for (const id of [...slots, "sample-left-2", "sample-right-2"]) {
    const row = panel.locator(`.weekly-bottle[data-slot="${id}"]`);
    const restore = row.getByRole("button", { name: /^裝回 / });
    if (await restore.count()) await restore.click();
  }
  await b("取出用過的 CLEAN 杯").click();
  await panel.getByLabel("主蓋開啟").uncheck();
  await panel.getByLabel("Analyzer Maintenance 保養模式").uncheck();
  await panel.getByLabel("ISE Maintenance 保養模式", { exact: true }).uncheck();
  await panel.getByLabel("ISE 上蓋開啟").uncheck();
  await expect(
    panel.getByRole("heading", { name: "周保養 · 已完成" }),
  ).toBeVisible();
  await b("開始／重新開始周保養").click();
  await page.getByRole("button", { name: "重新開始練習", exact: true }).click();
  await page.getByRole("button", { name: "確認重新開始", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "練習任務紀錄" }),
  ).toContainText("0／9");
  expect(errors).toEqual([]);
});
