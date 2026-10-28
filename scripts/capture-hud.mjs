import { chromium } from "@playwright/test";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// UI-only practice actions. Exam images come from the isolated test database;
// this script never creates accounts or writes exam records in the local DB.
const folder = resolve("artifacts/hud");
mkdirSync(folder, { recursive: true });
const cases = [
  {
    channel: "chrome",
    name: "chrome-1366",
    viewport: { width: 1366, height: 768 },
  },
  {
    channel: "msedge",
    name: "edge-1920",
    viewport: { width: 1920, height: 1080 },
  },
];
for (const c of cases) {
  const browser = await chromium.launch({
    channel: c.channel,
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: c.viewport });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const shot = async (name) => {
      await page.mouse.move(2, 2);
      await page.screenshot({ path: resolve(folder, `${c.name}-${name}.png`) });
    };
    const select = async (id) => {
      await button("部件目錄").click();
      await page.getByTestId(`part-${id}`).click();
      await button("操作").click();
    };
    await page.goto("http://127.0.0.1:5173/");
    await page.getByText("3D LIVE", { exact: true }).waitFor();
    await page.waitForTimeout(900);
    await shot("exploration");
    await button("任務中心").click();
    await shot("task-center");
    await button("開始練習").click();
    await select("analyzer");
    await page.getByTestId("context-main").click();
    await button("部件目錄").click();
    await page.locator(".directory-targets summary").click();
    await page.getByTestId("target-R1-1").click();
    await page.getByRole("button", { name: /聚焦部件/ }).click();
    await button("用酒精棉擦拭 R1-1").click();
    const log = page.getByRole("region", { name: "練習任務紀錄" });
    await log.locator("header button").click();
    await page.locator(".detail-panel").evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(1900);
    await shot("practice");
    await log.locator("header button").click();
    await log.getByRole("button", { name: "操作電腦", exact: true }).click();
    const ws = page.locator(".workstation");
    await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
    await ws
      .getByRole("button", { name: "Analyzer Maintenance", exact: true })
      .click();
    await ws
      .getByRole("button", { name: "ISE Maintenance", exact: true })
      .click();
    await shot("workstation");
    await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
    await button("任務中心").click();
    await page.locator(".mission-tile").nth(1).click();
    await button("開始練習").click();
    await select("syringes");
    const panel = page.locator("aside .weekly-panel");
    await panel
      .getByLabel("確認預熱／待機，備妥 70% 異丙醇、無絨軟布、通針鐵絲")
      .check();
    for (const id of ["R2-2", "R2-1", "R1-1", "R1-2"])
      await panel.getByLabel(`${id} 水氣檢查`).selectOption("正常");
    await page.locator(".detail-panel").evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(900);
    await shot("weekly");
    for (const name of ["exam", "exam-workstation"]) {
      const source = resolve(`test-results/${c.name}-hud-${name}.png`);
      if (existsSync(source))
        copyFileSync(source, resolve(folder, `${c.name}-${name}.png`));
    }
    console.log(
      `${c.name}: exploration, task center, practice, weekly, workstation and isolated exam images saved.`,
    );
  } finally {
    await browser.close();
  }
}
