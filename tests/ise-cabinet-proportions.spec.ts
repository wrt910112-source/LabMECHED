import { selectPart } from "./ui";
import { test, expect } from "@playwright/test";

test("ISE and adjacent cabinet fronts align slightly behind the analyzer without displacing rear working parts", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const T = await import("/node_modules/.vite/deps/three.js");
    const m = createInstrument();
    m.root.updateMatrixWorld(true);
    const object = (name: string) => m.root.getObjectByName(name)!;
    const bounds = (name: string) => new T.Box3().setFromObject(object(name));
    const tray = bounds("reagent-tray-front"),
      side = bounds("side-cabinet-front"),
      reference = bounds("reference-door");
    const front = bounds("front-door-1").max.z;
    const jugBounds = ["ISE Mid Standard", "ISE Buffer"].map((name) =>
      new T.Box3().setFromObject(
        m.groups.get("ise-reagents")!.getObjectByName(name)!,
      ),
    );
    const floor = bounds("ise-cavity-floor");
    const position = (name: string) =>
      object(name).getWorldPosition(new T.Vector3()).toArray();
    const clean = m.groups.get("clean-solution")!;
    const tank = new T.Box3().setFromObject(
      clean.getObjectByName("clean-solution-tank")!,
    );
    const cleanLeft = new T.Box3().setFromObject(
      clean.getObjectByName("cabinet-wall--1.049")!,
    );
    const cleanRight = new T.Box3().setFromObject(
      clean.getObjectByName("cabinet-wall--0.315")!,
    );
    return {
      faces: [tray.max.z, side.max.z, reference.max.z],
      recess: front - tray.max.z,
      jugsClear: jugBounds.every(
        (b) =>
          !b.intersectsBox(floor) && b.max.z < tray.min.z && b.max.y < 0.88,
      ),
      sideClear:
        side.max.x < bounds("reference-front-side--0.197").min.x &&
        side.min.x > cleanRight.max.x,
      tankFits: tank.min.x > cleanLeft.max.x && tank.max.x < cleanRight.min.x,
      motor: position("black-motor-body"),
      cups: position("cup-tray"),
    };
  });
  expect(Math.max(...result.faces) - Math.min(...result.faces)).toBeLessThan(
    0.002,
  );
  expect(result.recess).toBeGreaterThan(0.03);
  expect(result.recess).toBeLessThan(0.09);
  expect(result.jugsClear).toBe(true);
  expect(result.sideClear).toBe(true);
  expect(result.tankFits).toBe(true);
  expect(result.motor).toEqual([0.019, 0.827, -0.235]);
  expect(result.cups).toEqual([0.171, 0.913, -0.183]);
});

test("recessed cabinets remain visible and all original doors can still be operated", async ({
  page,
}, info) => {
  await page.goto("/");
  await selectPart(page,"ise");
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-recessed-cabinets.png`,
  });
  const bar = page;
  for (const id of [
    "context-ise-top",
    "context-ise-top-rear",
    "context-ise-module",
    "context-ise-middle",
    "context-ise-bottom",
    "context-loader-door",
  ]) {
    if(id==="context-loader-door")await selectPart(page,"loader");
    await bar.getByTestId(id).click();
    await expect(bar.getByTestId(id)).toHaveAttribute("aria-pressed", "true");
  }
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-recessed-open.png`,
  });
  await selectPart(page,"clean-solution");
  await expect(page.getByTestId("context-loader-door")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-adjacent-clean-solution.png`,
  });
  await bar.getByTestId("context-loader-door").click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-loader-door",
    "false",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
