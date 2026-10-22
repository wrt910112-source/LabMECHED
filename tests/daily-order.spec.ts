import { prepareDailyTasks } from "./daily-fixture";
import { test, expect } from "@playwright/test";

for (const order of ["ACBD", "CADB", "CDAB"]) {
  test(`daily practice allows ${order}, early reagents and only opens Rack after all checks`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page
      .getByRole("button", { name: "01 日保養 開始練習", exact: true })
      .click();
    const ws = page.locator(".workstation");
    const b = (name: string) => ws.getByRole("button", { name, exact: true });
    const home = async (name: string) => {
      await b("Home 主選單").click();
      await b(name).click();
    };
    await b("開始日保養").click();
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await prepareDailyTasks(page, ws);
    await home("Reagent Management");
    await b("Details").click();
    for (const [i, [name, side]] of [
      ["ALT", "R1"],
      ["ALT", "R2"],
      ["AST", "R1"],
      ["AST", "R2"],
      ["GLU", "R1"],
    ].entries()) {
      if (i < 3) await b(`更換 ${name} ${side}`).click();
      await ws
        .getByLabel(`${name} ${side} 紀錄`, { exact: true })
        .fill("已確認至下次保養");
      await ws
        .getByLabel(`${name} ${side} 用量已檢查`, { exact: true })
        .check();
    }
    await b("Reagent Check").click();
    await b("All positions").click();
    await home("Analyzer Status");
    await ws.getByLabel("Bath Temp. 登記").fill("37");
    await ws.getByLabel("Coolant Temp. 登記").fill("8.2");
    await b("儲存溫度紀錄").click();
    await home("Start Condition");
    await b("Edit").click();
    await b("New Index").click();
    await home("Reagent Management");
    await b("Details").click();
    await b("Reagent Check").click();
    await b("All positions").click();
    await ws.getByLabel("主蓋開啟", { exact: true }).check();
    await ws.getByLabel("ISE 上蓋開啟", { exact: true }).check();
    for (const step of order) {
      if (step === "A" || step === "B") {
        await home("Analyzer Maintenance");
        await ws.getByLabel("Analyzer Maintenance", { exact: true }).check();
        await b(
          step === "A" ? "Cleaning Probe" : "Inspect Probe & Mixing Bar",
        ).click();
        for (const id of [
          "R1-1",
          "R1-2",
          "R2-1",
          "R2-2",
          "Sample-1",
          "Sample-2",
        ]) {
          if (step === "A") await b(`酒精棉擦拭 ${id}`).click();
          else
            await ws
              .getByLabel(`${id} 排水`, { exact: true })
              .selectOption("正常");
        }
        if (step === "B")
          for (const id of ["左側", "右側"])
            await ws.getByLabel(`${id} mixing bars`).selectOption("正常");
      } else {
        await home("Analyzer Maintenance");
        await b("ISE Maintenance").click();
        if (step === "C") {
          await ws.getByLabel("ISE Maintenance", { exact: true }).uncheck();
          await b("在 CLEAN 放置裝滿的 Cleaning Solution").click();
          await b("Cleaning").click();
        } else {
          await ws.getByLabel("ISE Maintenance", { exact: true }).check();
          for (let i = 0; i < 3; i++) await b("Total Prime").click();
        }
      }
    }
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await home("Analyzer Maintenance");
    await b("ISE Maintenance").click();
    await ws.getByLabel("ISE Maintenance", { exact: true }).uncheck();
    await b("Calibration").click();
    await b("取出並丟棄 CLEAN 杯").click();
    for (const cup of [
      "S-H · Serum High",
      "S-L · Serum Low",
      "U-H · Urine High",
      "U-L · Urine Low",
    ])
      await ws.getByLabel(`${cup} 滴數`).fill("10");
    await b("Serum/Urine Start").click();
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await home("Analyzer Maintenance");
    await b("ISE Maintenance").click();
    await b("Calibration").click();
    await ws.getByLabel("已檢查 Serum／Urine 數值").check();
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeEnabled();
    await b("Calibration").click();
    await b("Start Entry").click();
    await b("97.Na Cal.").click();
    await b("Entry").click();
    await expect(b("97.Na Cal.")).toHaveAttribute("aria-pressed", "true");
  });
}
