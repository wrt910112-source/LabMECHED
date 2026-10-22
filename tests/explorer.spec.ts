import { test, expect } from "@playwright/test";
test("model navigation, internal view, photos and desktop layout", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByTestId("model-canvas")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-overview.png`,
    fullPage: true,
  });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.width).toBe(dimensions.viewport);
  const bottom = await page.locator(".lower-bar").boundingBox();
  expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
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
    await page.getByTestId(`part-${id}`).click();
    if (id === "console")
      await page
        .getByRole("button", { name: "退出螢幕 ×", exact: true })
        .click();
    await expect(page.locator(".viewer-host")).toHaveAttribute(
      "data-selected",
      id,
    );
    await expect(page.getByTestId(`part-${id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (id === "r1" || id === "r2" || id === "sample")
      await page.getByRole("button", { name: "部件介紹", exact: true }).click();
    const img = page.locator(".reference-photo img");
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBeTruthy();
  }
  await page.getByTestId("part-r1").click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByRole("switch").click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-r1.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "部件介紹", exact: true }).click();
  await page.getByRole("button", { name: "放大實機照片", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("switch").click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-internal",
    "false",
  );
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-selected",
    "overview",
  );
  await page.getByRole("button", { name: "俯視", exact: true }).click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-internal.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "後方", exact: true }).click();
  await page.getByRole("button", { name: "放大模型", exact: true }).click();
  await page.getByRole("button", { name: "縮小模型", exact: true }).click();
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(900);
  const canvas = page.getByTestId("model-canvas"),
    rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.65,
    rect.y + rect.height * 0.5,
    { steps: 15 },
  );
  await page.mouse.up();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-selected",
    "overview",
  );
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(900);
  // Pick actual geometry, not a DOM hotspot. The analyzer cabinet is visible
  // in the lower-right of the initial camera in both supported viewports.
  const meshX = rect.x + rect.width * 0.63;
  const meshY = rect.y + rect.height * 0.65;
  await page.mouse.move(meshX, meshY);
  await expect(page.locator(".hover-part")).toBeVisible();
  await page.mouse.click(meshX, meshY);
  await expect(page.locator(".viewer-host")).not.toHaveAttribute(
    "data-selected",
    "overview",
  );
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(900);
  await page
    .getByRole("button", { name: "模型標籤：ISE 模組", exact: true })
    .click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-selected",
    "ise",
  );
  await page.getByRole("textbox", { name: "搜尋部件" }).fill("不存在");
  await expect(page.getByText("找不到相符部件")).toBeVisible();
  await page.getByRole("button", { name: "清除搜尋" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "學習模式" })
      .locator("button:disabled"),
  ).toHaveCount(2);
  expect(errors).toEqual([]);
});
test("alternate reference photographs", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("part-ise-reagents").click();
  await page
    .getByRole("button", { name: "切換參考照片 2", exact: true })
    .click();
  await expect(page.locator(".reference-photo img")).toHaveAttribute(
    "src",
    /ise-reference.jpg$/,
  );
  await page.getByTestId("part-sample").click();
  await page.getByRole("button", { name: "部件介紹", exact: true }).click();
  await expect(page.locator(".reference-photo img")).toHaveAttribute(
    "src",
    /rear.jpg$/,
  );
  await page
    .getByRole("button", { name: "切換參考照片 2", exact: true })
    .click();
  await expect(page.locator(".reference-photo img")).toHaveAttribute(
    "src",
    /sample.jpg$/,
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
  await page.getByTestId("part-r2").click();
  await page.getByRole("button", { name: "部件介紹", exact: true }).click();
  await expect(page.locator(".detail-title h2")).toHaveText("R2 試劑槽與探針");
});
