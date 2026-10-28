import { selectPart } from "./ui";
import { test, expect } from "@playwright/test";

test("HUD directory, photographs, camera tools and geometry picking", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  const host = page.locator(".viewer-host"),
    canvas = page.getByTestId("model-canvas");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === innerWidth,
    ),
  ).toBe(true);
  for (const id of [
    "loader",
    "console",
    "ise",
    "ise-reagents",
    "analyzer",
    "r2",
    "r1",
    "sample",
    "reaction",
    "mixing",
    "washing",
  ]) {
    await selectPart(page, id);
    if (id === "console")
      await page
        .getByRole("button", { name: "退出螢幕 ×", exact: true })
        .click();
    await expect(host).toHaveAttribute("data-selected", id);
    await page.getByRole("button", { name: "實機照片", exact: true }).click();
    const img = page.locator(".hud-part-info figure img");
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBeTruthy();
  }
  await page.getByRole("button", { name: "放大實機照片", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "實機照片", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "實機照片", exact: true }),
  ).not.toBeVisible();
  await selectPart(page, "analyzer");
  await page.getByTestId("context-main").click();
  await expect(host).toHaveAttribute("data-internal", "true");
  await page.getByRole("button", { name: "俯視", exact: true }).click();
  await expect(host).toHaveAttribute("data-internal", "true");
  await selectPart(page, "analyzer");
  await page.getByTestId("context-main").click();
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(1000);
  const r = (await canvas.boundingBox())!;
  await page.mouse.move(r.width * 0.45, r.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(r.width * 0.6, r.height * 0.62, { steps: 12 });
  await page.mouse.up();
  await expect(host).toHaveAttribute("data-selected", "overview");
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(1000);
  // Click real mesh geometry in the scene, outside either HUD safe area.
  await page.mouse.move(r.width * 0.52, r.height * 0.6);
  await expect(page.locator(".hover-part")).toBeVisible();
  await page.mouse.click(r.width * 0.52, r.height * 0.6);
  await expect(host).not.toHaveAttribute("data-selected", "overview");
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(900);
  await page
    .getByRole("button", { name: "模型標籤：ISE 模組", exact: true })
    .click();
  await expect(host).toHaveAttribute("data-selected", "ise");
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.getByRole("textbox", { name: "搜尋部件" }).fill("不存在");
  await expect(page.getByText("找不到相符部件")).toBeVisible();
  await page.getByRole("button", { name: "清除搜尋", exact: true }).click();
  await page.getByRole("button", { name: "關閉部件目錄", exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-navigation.png`,
  });
  expect(errors).toEqual([]);
});

test("alternate reference photographs remain available", async ({ page }) => {
  await page.goto("/");
  await selectPart(page, "ise-reagents");
  await page.getByRole("button", { name: "實機照片", exact: true }).click();
  await page
    .getByRole("button", { name: "切換參考照片 2", exact: true })
    .click();
  await expect(page.locator(".hud-part-info figure img")).toHaveAttribute(
    "src",
    /ISE reference.jpg$/,
  );
  await selectPart(page, "sample");
  await page.getByRole("button", { name: "實機照片", exact: true }).click();
  await expect(page.locator(".hud-part-info figure img")).toHaveAttribute(
    "src",
    /Sample probes.jpg$/,
  );
  await page
    .getByRole("button", { name: "切換參考照片 2", exact: true })
    .click();
  await expect(page.locator(".hud-part-info figure img")).toHaveAttribute(
    "src",
    /Sample probe DET1, DET2.jpg$/,
  );
});

test("WebGL unavailable keeps reference navigation usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("無法顯示 3D 模型");
  await expect(page.getByText("3D 無法使用", { exact: true })).toBeVisible();
  await selectPart(page, "r2");
  await page.getByRole("button", { name: "認識", exact: true }).click();
  await expect(page.locator(".hud-part-info h2")).toHaveText("R2 試劑槽與探針");
});
