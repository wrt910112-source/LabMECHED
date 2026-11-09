import { practiceAccount } from "./practice-account";
import { expect, type Page, type Locator } from "@playwright/test";
/** Follow the HUD navigation; selection itself intentionally never moves the camera. */
export async function selectPart(page: Page, id: string, bottles = false) {
  const scope = (await page.locator(".shared-exam-room").count())
    ? page.locator(".shared-exam-room")
    : page;
  const directory = scope.getByRole("button", {
    name: "部件目錄",
    exact: true,
  });
  if ((await directory.getAttribute("aria-expanded")) !== "true")
    await directory.click();
  await scope.getByTestId(`part-${id}`).click();
  if (id === "console") return;
  await scope.getByRole("button", { name: "操作", exact: true }).click();
  await scope.getByRole("button", { name: /聚焦部件/ }).click();
  if (bottles && ["r1", "r2", "sample"].includes(id)) {
    await scope.getByRole("button", { name: /操作洗滌劑瓶/ }).click();
    await page
      .getByTestId(
        `slot-${id === "sample" ? "sample-left-1" : id === "r1" ? "r1-inner-1" : "r2-outer-1"}`,
      )
      .click();
  }
}
export async function startDaily(page: Page) {
  await practiceAccount(page);
  const exit = page.getByRole("button", { name: "退出螢幕 ×", exact: true });
  if (await exit.isVisible()) await exit.click();
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  await page
    .getByRole("region", { name: "練習任務紀錄" })
    .getByRole("button", { name: "操作電腦", exact: true })
    .click();
}
export async function selectTarget(page: Page, id: string) {
  const scope = (await page.locator(".shared-exam-room").count())
    ? page.locator(".shared-exam-room")
    : page;
  await scope.getByRole("button", { name: "部件目錄", exact: true }).click();
  const targets = scope.locator(".directory-targets");
  if (
    !(await targets.getAttribute("open")) &&
    !(await scope.getByTestId(`target-${id}`).isVisible())
  )
    await targets.locator("summary").click();
  await scope.getByTestId(`target-${id}`).click();
  await scope.getByRole("button", { name: /聚焦部件/ }).click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-selected",
    /r1|r2|sample|mixing|ise/,
  );
}

export async function toggleMain(page: Page) {
  const host = page.locator(".viewer-host");
  const part = await host.getAttribute("data-selected"),
    slot = await host.getAttribute("data-slot");
  await selectPart(page, "analyzer");
  await page.getByTestId("context-main").click();
  if (part) {
    await selectPart(page, part, !!slot);
    if (slot) await page.getByTestId(`slot-${slot}`).click();
  }
}

/** Instrument state moved to the outer HUD; original Maintenance checkbox stays in its action panel. */
export async function instrument(ws: Locator, label: string, value = true) {
  const direct = ws.locator(".ws-actions").getByLabel(label, { exact: true });
  if (await direct.count()) {
    await direct.setChecked(value);
    return;
  }
  const hud = ws.locator(".ws-instrument-hud");
  if (await hud.count()) {
    const control = hud.getByLabel(label, { exact: true });
    if (await control.count()) {
      if (!(await hud.evaluate((el) => el.hasAttribute("open"))))
        await hud.locator("summary").click();
      await control.setChecked(value);
      if (await hud.evaluate((el) => el.hasAttribute("open")))
        await hud.locator("summary").click();
      return;
    }
  }
  await ws.getByLabel(label, { exact: true }).setChecked(value);
}
export async function closeProgram(ws: Locator) {
  const close = ws.getByRole("button", { name: "關閉子工作區", exact: true });
  if (await close.isVisible()) await close.click();
}
export async function cups(ws: Locator, act: () => Promise<void>) {
  await ws.getByRole("button", { name: "試劑杯準備", exact: true }).click();
  await act();
  await closeProgram(ws);
}
export async function iseDrain(ws: Locator) {
  await closeProgram(ws);
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws
    .getByRole("button", { name: "Analyzer Maintenance", exact: true })
    .click();
  await ws
    .getByRole("button", { name: "ISE Maintenance", exact: true })
    .click();
  await instrument(ws, "ISE Maintenance", true);
  await ws
    .getByRole("button", { name: "Replace Sample Probe", exact: true })
    .click();
  await ws
    .getByRole("button", { name: "OK · 儲存 DIAG 設定", exact: true })
    .click();
  await ws.getByRole("button", { name: "DIAG ise", exact: true }).click();
  await ws.getByLabel("ISE 直線排水檢查", { exact: true }).selectOption("正常");
  await closeProgram(ws);
  await instrument(ws, "ISE Maintenance", false);
}
export async function replaceAll(ws: Locator) {
  const buttons = ws.getByRole("button", { name: /^更換試劑 / });
  await expect(buttons).toHaveCount(11);
  for (const button of await buttons.all()) {
    await button.click();
    await expect(button).toBeDisabled();
  }
}
