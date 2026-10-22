import { test, expect } from "@playwright/test";

test("12 named wells, six resident bottles and replacement/refill rules", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  await page.getByTestId("part-r2").click();
  await page
    .getByRole("button", { name: "顯示全部 12 孔", exact: true })
    .click();
  const wells = page.locator(".wash-slot");
  await expect(wells).toHaveCount(12);
  await expect(page.locator(".wash-slot strong")).toHaveText([
    "57.CLN-1",
    "58.CLN-2",
    "W2",
    "55.CLN-1",
    "56.CLN-2",
    "W2",
    "57.CLN-1",
    "58.CLN-2",
    "55.Diluent/W2",
    "59.CLN-1",
    "60.CLN-2",
    "56.Diluent/W2",
  ]);
  await expect(page.locator('.wash-slot[data-fluid="cln1"]')).toHaveCount(4);
  await expect(page.locator('.wash-slot[data-fluid="diluent"]')).toHaveCount(2);
  await expect(page.locator('.wash-slot[data-fluid="empty"]')).toHaveCount(6);
  const active = page.getByTestId("bottle-controls");
  await expect(active).toHaveAttribute("data-level", "0.65");
  await page.getByRole("button", { name: "補充", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已補充", {
    timeout: 5000,
  });
  await expect(active).toHaveAttribute("data-level", "1");
  await expect(active).toHaveAttribute("data-revision", "0");
  await page.getByRole("button", { name: "更換新瓶", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(active).toHaveAttribute("data-revision", "1");
  await page.getByRole("button", { name: "取出", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已取出");
  await expect(active).toHaveAttribute("data-fluid", "empty");
  await expect(
    page.getByRole("button", { name: "補充", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "放入瓶子", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(active).toHaveAttribute("data-fluid", "cln1");
  await page.getByTestId("slot-r2-outer-2").click();
  await expect(
    page.getByText("此 CLN-2 槽目前未使用，保持空槽。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更換新瓶", exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("slot-r2-outer-3").click();
  await expect(
    page.getByRole("button", { name: "放入瓶子", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "周保養", exact: true }).click();
  await page.getByRole("button", { name: "放入瓶子", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(active).toHaveAttribute("data-fluid", "w2");
  await page.getByTestId("slot-r1-inner-3").click();
  await expect(active).toHaveAttribute("data-fluid", "diluent");
  await page.getByRole("combobox", { name: "新瓶內容" }).selectOption("w2");
  await page.getByRole("button", { name: "更換新瓶", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(active).toHaveAttribute("data-fluid", "w2");
  await page.getByRole("button", { name: "平日", exact: true }).click();
  await expect(active).toHaveAttribute("data-fluid", "w2");
  await expect(
    page.getByText("平日不使用 W2，請更換為 Diluent。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "補充", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "更換新瓶", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(active).toHaveAttribute("data-fluid", "diluent");
  await page
    .getByRole("button", { name: "重設為平日 6 瓶配置", exact: true })
    .click();
  await expect(page.locator('.wash-slot[data-fluid="cln1"]')).toHaveCount(4);
  await expect(page.locator('.wash-slot[data-fluid="diluent"]')).toHaveCount(2);
  await expect(page.locator('.wash-slot[data-fluid="w2"]')).toHaveCount(0);
  await page.getByTestId("slot-r2-outer-1").click();
  await page.waitForTimeout(1200);
  await page.locator(".detail-panel").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({
    path: `test-results/${info.project.name}-wash-close.png`,
    fullPage: true,
  });
  // Camera focus does not open the main cover; explicitly expose the recess.
  await page.getByRole("switch").click();
  // Direct geometry hit within the focused recess, independent of DOM slot cards.
  const canvas = page.getByTestId("model-canvas"),
    bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await expect(page.locator(".hover-part")).toContainText("57.CLN-1");
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-slot",
    "r2-outer-1",
  );
  expect(errors).toEqual([]);
});

test("both maintenance modes accept W2, unused CLN-2 never accepts bottles", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("part-r2").click();
  await page.getByTestId("slot-r2-inner-3").click();
  await page.getByRole("button", { name: "雙周保養", exact: true }).click();
  await page.getByRole("button", { name: "放入瓶子", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await page.getByTestId("slot-r2-inner-2").click();
  await expect(page.getByTestId("bottle-controls")).toHaveAttribute(
    "data-fluid",
    "empty",
  );
  await expect(
    page.getByRole("button", { name: "放入瓶子", exact: true }),
  ).toHaveCount(0);
});
