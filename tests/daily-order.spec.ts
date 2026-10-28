import { instrument, closeProgram, cups, iseDrain, replaceAll } from "./ui";
import { startDaily } from "./ui";
import { prepareDailyTasks } from "./daily-fixture";
import { test, expect } from "@playwright/test";

for (const order of ["ACBD", "CADB", "CDAB"]) {
  test(`daily practice allows ${order}, early reagents and only opens Rack after all checks`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await startDaily(page);
    const ws = page.locator(".workstation");
    const b = (name: string) => ws.getByRole("button", { name, exact: true });
    const home = async (name: string) => {
      await closeProgram(ws);
      await b("Home 主選單").click();
      await b(name).click();
    };

    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await prepareDailyTasks(page, ws);
    await home("Reagent Management");
    await b("Details").click();
    await replaceAll(ws);
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
    await instrument(ws, "主蓋開啟", true);
    await instrument(ws, "ISE 上蓋開啟", true);
    await iseDrain(ws);
    for (const step of order) {
      if (step === "A" || step === "B") {
        await home("Analyzer Maintenance");
        await instrument(ws, "Analyzer Maintenance", true);
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
          await instrument(ws, "ISE Maintenance", false);
          await cups(ws, async () => {
            await b("在 CLEAN 放置裝滿的 Cleaning Solution").click();
          });
          await b("Cleaning").click();
        } else {
          await instrument(ws, "ISE Maintenance", true);
          for (let i = 0; i < 3; i++) await b("Total Prime").click();
        }
      }
    }
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await home("Analyzer Maintenance");
    await b("ISE Maintenance").click();
    await instrument(ws, "ISE Maintenance", false);
    await b("Calibration").click();
    await b("試劑杯準備").click();
    await b("取出並丟棄 CLEAN 杯").click();
    for (const cup of [
      "S-H · Serum High",
      "S-L · Serum Low",
      "U-H · Urine High",
      "U-L · Urine Low",
    ])
      await ws.getByLabel(`${cup} 滴數`).fill("10");
    await closeProgram(ws);
    await b("Serum/Urine Start").click();
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeDisabled();
    await home("Analyzer Maintenance");
    await b("ISE Maintenance").click();
    await b("Calibration").click();
    await ws.getByLabel("已檢查 Serum／Urine 數值").check();
    await closeProgram(ws);
    await home("Rack Requisition");
    await expect(b("Start Entry")).toBeEnabled();
    await b("Calibration").click();
    await b("Start Entry").click();
    await b("97.Na Cal.").click();
    await b("Entry").click();
    await expect(b("97.Na Cal.")).toHaveAttribute("aria-pressed", "true");
  });
}
