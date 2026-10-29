import { test, expect } from "@playwright/test";
import { preparationShot } from "./preparation-ui";
test("free exploration opens preparation immediately and retains the material catalog and hospital photographs", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "備料工作台", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "校正與品管備料",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("model-canvas")).toHaveCount(1);
  await expect(panel.locator(".prep-source-list button")).toHaveCount(25);
  await expect(
    panel.getByRole("button", { name: "吸取來源液", exact: true }),
  ).toBeEnabled();
  await panel.getByTestId("prep-source-lcc1").click();
  await expect(
    panel.getByRole("region", { name: "備料材料資訊" }),
  ).toContainText("Lyophilized Chemistry Calibrator");
  const image = panel.locator(".prep-material img");
  await expect(image).toHaveAttribute(
    "src",
    "/references/real-photos/CALI.jpg",
  );
  await expect
    .poll(() =>
      image.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true);
  await expect(panel).toContainText("期限核對尚未完成");
  await preparationShot(page, "source", info.project.name);
  await panel.getByTestId("prep-source-ita-3").click();
  await expect(panel.locator(".prep-material")).toContainText("QC3");
  await expect(panel.locator(".prep-material")).toContainText("待確認");
  await panel.getByTestId("prep-source-crp-b").click();
  await expect(panel.locator(".prep-material")).toContainText("代碼待確認");
  await panel.getByRole("button", { name: "返回儀器", exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("free preparation permits arbitrary materials and racks, retains loading and stays separate from daily practice", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const open = () =>
    page.getByRole("button", { name: "備料工作台", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "校正與品管備料",
    exact: true,
  });
  const button = (name: string) =>
    panel.getByRole("button", { name, exact: true });
  await open();
  await expect(panel).toHaveAttribute("data-free-simulation", "true");
  await expect(panel.locator(".prep-progress")).toContainText("不計分");
  await expect(panel.locator(".prep-progress progress")).toHaveCount(0);
  await expect(panel.locator(".prep-hint")).toHaveCount(0);
  await panel.getByTestId("prep-source-lip").click();
  await page.keyboard.press("e");
  await expect(panel.locator(".prep-controls")).toContainText("移液器：LIP");
  await panel.getByTestId("prep-source-hdl").click();
  await button("加入容器").click();
  await expect(panel.getByLabel("備料容器", { exact: true })).toHaveValue(
    "cup-1",
  );
  await expect(panel.locator(".prep-controls")).toContainText("杯內來源：LIP");
  await button("03 裝架").click();
  await panel.getByLabel("備料檢體架", { exact: true }).selectOption("QC");
  await panel.getByLabel("備料孔位", { exact: true }).selectOption("7");
  await button("放入架位").click();
  await button("04 上機").click();
  await button("放至進樣區").click();
  await button("推入儀器").click();
  await expect(panel.locator(".prep-counts b")).toHaveText(["1", "1", "1"]);
  await preparationShot(page, "free-loaded", info.project.name);
  await button("返回儀器").click();
  await open();
  await expect(panel.locator(".prep-counts b")).toHaveText(["1", "1", "1"]);
  await button("查看 Rack Requisition").click();
  await page
    .locator(".workstation")
    .getByRole("button", { name: "退出螢幕 ×", exact: true })
    .click();
  await expect(panel.locator(".prep-counts b")).toHaveText(["1", "1", "1"]);
  await button("返回儀器").click();
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "練習任務紀錄" }),
  ).toContainText("0／13");
  await open();
  await expect(panel).toHaveAttribute("data-free-simulation", "false");
  await expect(button("吸取來源液")).toBeDisabled();
  await expect(panel.locator(".prep-counts b")).toHaveText([
    "0 / 16",
    "0 / 16",
    "0 / 16",
  ]);
  await button("返回儀器").click();
  await page
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await open();
  await expect(panel.locator(".prep-counts b")).toHaveText(["1", "1", "1"]);
  page.once("dialog", (dialog) => dialog.accept());
  await button("重新開始自由模擬").click();
  await expect(panel.locator(".prep-counts b")).toHaveText(["0", "0", "0"]);
  expect(errors).toEqual([]);
});
