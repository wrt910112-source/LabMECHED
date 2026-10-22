import { test, expect } from "@playwright/test";
test("cabinet syringes, probe counts, clearance and inspection records", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  const result = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const { washBanks } = await import("/src/detergents.ts");
    const m = createInstrument();
    const counts = ["r1", "r2", "sample"].map((id) => {
      let n = 0;
      m.groups.get(id)!.traverse((o) => {
        if (o.userData.componentType === "probe") n++;
      });
      return n;
    });
    const syringes: string[] = [];
    m.groups.get("syringes")!.traverse((o) => {
      if (
        o.userData.componentType === "syringe" &&
        o.userData.removable === false
      )
        syringes.push(o.name);
    });
    const disc = m.root.getObjectByName("reaction-cover-base")!;
    const radius = disc.geometry.parameters.radiusTop;
    let clearance = Infinity;
    for (const bank of washBanks) {
      const w = 0.021 + bank.labels.length * 0.033;
      for (let i = 0; i <= 40; i++)
        for (const side of [-1, 1]) {
          for (const [x, z] of [
            [(side * w) / 2, -0.0925 + (i * 0.185) / 40],
            [-w / 2 + (i * w) / 40, side * 0.0925],
          ]) {
            const wx =
              bank.position[0] +
              Math.cos(bank.rotation) * x +
              Math.sin(bank.rotation) * z;
            const wz =
              bank.position[2] -
              Math.sin(bank.rotation) * x +
              Math.cos(bank.rotation) * z;
            clearance = Math.min(
              clearance,
              Math.hypot(wx - disc.position.x, wz - disc.position.z) - radius,
            );
          }
        }
    }
    return {
      counts,
      syringes,
      clearance,
      doorHidden: m.covers.some((o) => o.name === "front-door-0"),
    };
  });
  expect(result.counts).toEqual([2, 2, 2]);
  expect(result.syringes).toEqual([
    "syringe-R2-2",
    "syringe-R2-1",
    "syringe-R1-1",
    "syringe-R1-2",
  ]);
  expect(result.clearance).toBeGreaterThan(0.01);
  expect(result.doorHidden).toBe(false);
  await page.getByTestId("part-syringes").click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByTestId("front-syringe-toggle").click();
  for (const name of ["R2-2", "R2-1", "R1-1", "R1-2"])
    await page.getByLabel(`${name} 水氣檢查`).selectOption("dry");
  await expect(page.getByRole("status")).toContainText("已檢查 4／4");
  await page.getByLabel("R1-2 水氣檢查").selectOption("moisture");
  await expect(page.getByRole("status")).toContainText("發現水氣");
  await page.getByTestId("part-r1").click();
  await page.getByTestId("part-syringes").click();
  await expect(page.getByLabel("R1-2 水氣檢查")).toHaveValue("moisture");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-syringes.png`,
  });
  await page.getByRole("button", { name: "開始新的保養檢查" }).click();
  await expect(page.getByRole("status")).toContainText("已檢查 0／4");
});
