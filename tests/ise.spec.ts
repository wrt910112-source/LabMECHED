import { test, expect } from "@playwright/test";
test("ISE hinged cover, four named cups and five independently removable components", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  const model = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const m = createInstrument();
    const cups: any[] = [];
    m.groups.get("ise-cups")!.traverse((o) => {
      if (o.userData.cupName)
        cups.push([o.userData.cupName, o.userData.contents]);
    });
    m.iseModel.setState({ open: true, removed: ["ise-plug-a", "ise-plug-b"] });
    m.iseModel.setState({
      open: true,
      removed: ["ise-plug-a", "ise-plug-b", "ise-motor"],
    });
    for (let i = 0; i < 90; i++) m.iseModel.animate();
    const lifted = m.groups.get("ise-motor")!.position.y;
    const other = m.groups.get("ise-mixing-cup")!.position.y;
    const openAngle = m.iseModel.lid.rotation.z;
    m.iseModel.setState({ open: true, removed: ["ise-plug-a", "ise-plug-b"] });
    m.iseModel.setState({ open: false, removed: [] });
    for (let i = 0; i < 90; i++) m.iseModel.animate();
    return {
      cups,
      lifted,
      other,
      openAngle,
      closedAngle: m.iseModel.lid.rotation.z,
      returned: m.groups.get("ise-motor")!.position.y,
      removable: [...m.iseModel.movable.keys()],
    };
  });
  expect(model.cups).toEqual([
    ["S-H", "SEL-Na / CRS-H"],
    ["S-L", "SEL-K / CRS-M"],
    ["U-H", "CRS-L"],
    ["U-L", "CLEAN"],
  ]);
  expect(model.lifted).toBeCloseTo(0.25, 3);
  expect(model.other).toBe(0);
  expect(model.openAngle).toBeCloseTo(Math.PI / 2, 3);
  expect(model.closedAngle).toBeCloseTo(0, 3);
  expect(model.returned).toBeCloseTo(0, 3);
  expect(model.removable).toHaveLength(5);
  await page.getByTestId("part-ise").click();
  await page.waitForTimeout(1100);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-closed.png`,
  });
  await page
    .getByRole("button", { name: "打開 ISE 維護蓋", exact: true })
    .click();
  await page.waitForTimeout(1100);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-open.png`,
  });
  for (const id of [
    "ise-mixing-cup",
    "ise-t-tube",
    "ise-plug-a",
    "ise-plug-b",
    "ise-motor",
  ]) {
    await page.getByTestId(`part-${id}`).click();
    await expect(page.locator(".viewer-host")).toHaveAttribute(
      "data-selected",
      id,
    );
    await page
      .getByRole("button", { name: "拆下選定部件", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "裝回選定部件", exact: true }),
    ).toBeEnabled();
  }
  await expect(page.getByRole("status")).toContainText("已拆下 5／5");
  await page.waitForTimeout(1100);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-detached.png`,
  });
  await page.getByRole("button", { name: "全部裝回", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已拆下 0／5");
  await page
    .getByRole("button", { name: "關閉 ISE 維護蓋", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "拆下選定部件", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("part-ise-cups").click();
  await expect(page.locator(".ise-cup-table th")).toHaveText([
    "S-H",
    "S-L",
    "U-H",
    "U-L",
  ]);
  expect(errors).toEqual([]);
});
