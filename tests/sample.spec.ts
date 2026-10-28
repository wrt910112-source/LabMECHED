import { selectPart } from "./ui";
import { test, expect } from "@playwright/test";

test("sample bottles and W2 interlock; mixer counts and sides", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  const geometry = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const model = createInstrument();
    return ["mixing-rear-left", "mixing-rear-right"].map((name) => {
      const g = model.root.getObjectByName(name)!;
      let rods = 0,
        holes = 0;
      g.traverse((o) => {
        if (o.userData.componentType === "stirrer") rods++;
        if (o.userData.componentType === "stirrer-well") holes++;
      });
      return { rods, holes, x: g.position.x };
    });
  });
  expect(geometry).toEqual([
    { rods: 6, holes: 6, x: 1.115 },
    { rods: 12, holes: 12, x: 0.426 },
  ]);
  await selectPart(page,"mixing",true);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-mixing.png`,
  });
  await selectPart(page,"sample",true);
  await expect(page.locator(".wash-slot strong")).toHaveText([
    "63.DET-1/W2",
    "64.DET-2",
    "61.DET-1/W2",
    "62.DET-2",
  ]);
  await expect(page.locator('.wash-slot[data-fluid="det1"]')).toHaveCount(2);
  await expect(page.locator('.wash-slot[data-fluid="det2"]')).toHaveCount(2);
  await page.getByRole("button", { name: "周保養", exact: true }).click();
  await page.getByLabel("新瓶內容").selectOption("w2");
  await page.getByRole("button", { name: "更換新瓶", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("請先取出同側 DET-2");
  await page.getByTestId("slot-sample-left-2").click();
  await page.getByRole("button", { name: "取出", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已取出");
  await page.getByTestId("slot-sample-left-1").click();
  await page.getByLabel("新瓶內容").selectOption("w2");
  await page.getByRole("button", { name: "更換新瓶", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已換入");
  await expect(page.getByTestId("bottle-controls")).toHaveAttribute(
    "data-fluid",
    "w2",
  );
  await page.getByTestId("slot-sample-left-2").click();
  await page.getByRole("button", { name: "放入瓶子", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("DET-2 槽必須留空");
  await page
    .getByRole("button", { name: "重設為平日 4 瓶配置", exact: true })
    .click();
  await expect(page.locator('.wash-slot[data-fluid="det2"]')).toHaveCount(2);
  await page.getByTestId("slot-sample-right-1").click();
  await page.getByRole("button", { name: "補充", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已補充");
  await page.screenshot({
    path: `test-results/${info.project.name}-sample.png`,
  });
  expect(errors).toEqual([]);
});
