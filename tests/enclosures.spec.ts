import { test, expect } from "@playwright/test";
test("independent ISE covers, reference shelf, narrow loader cabinet and rear track", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3D LIVE", { exact: true })).toBeVisible();
  const geometry = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const m = createInstrument();
    const mid = m.groups.get("ise-reagents")!,
      ref = m.groups.get("ise-reference")!;
    const T = await import("/node_modules/.vite/deps/three.js");
    m.root.updateMatrixWorld(true);
    const worldPosition = (o: any) => o.getWorldPosition(new T.Vector3());
    const bottleX = (name: string) =>
      worldPosition(mid.getObjectByName(name)!).x;
    m.enclosures.setState({
      "ise-top": true,
      "ise-top-rear": true,
      "ise-middle": false,
      "ise-bottom": true,
      "loader-door": true,
    });
    for (let i = 0; i < 100; i++) m.enclosures.animate();
    const doorAngles = [...m.enclosures.doors].map(([id, g]) => [
      id,
      g.rotation.x,
      g.rotation.y,
    ]);
    const track = m.groups.get("sample-track")!;
    return {
      midLeft: bottleX("ISE Mid Standard"),
      midRight: bottleX("ISE Buffer"),
      refBelow:
        worldPosition(
          ref.getObjectByName("ISE Reference")!.getObjectByName("bottle-body")!,
        ).y <
        worldPosition(
          mid.getObjectByName("ISE Buffer")!.getObjectByName("bottle-body")!,
        ).y,
      doorAngles,
      trackCovers: track.children.filter((o) =>
        o.name.startsWith("smoked-track-cover"),
      ).length,
      tank: !!m.groups
        .get("clean-solution")!
        .getObjectByName("clean-solution-tank"),
    };
  });
  expect(geometry.midLeft).toBeLessThan(geometry.midRight);
  expect(geometry.refBelow).toBe(true);
  expect(geometry.trackCovers).toBe(6);
  expect(geometry.tank).toBe(true);
  const angles = Object.fromEntries(
    geometry.doorAngles.map((a) => [a[0], a.slice(1)]),
  );
  expect(angles["ise-top"][0]).toBeCloseTo(-Math.PI / 2, 3);
  expect(angles["ise-top-rear"][0]).toBeCloseTo(Math.PI / 2, 3);
  expect(angles["ise-middle"][0]).toBe(0);
  expect(angles["ise-bottom"][1]).toBeCloseTo(-1.6, 3);
  expect(angles["loader-door"][1]).toBeCloseTo(1.6, 3);
  await page.getByTestId("part-ise").click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-exterior.png`,
  });
  for (const id of ["ise-top", "ise-top-rear", "ise-middle", "ise-bottom"]) {
    await page.getByTestId(`door-${id}`).click();
    await expect(page.getByTestId(`door-${id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.getByTestId("part-ise-reagents").click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-middle.png`,
  });
  await page.getByTestId("part-ise-reference").click();
  await expect(page.getByTestId("door-ise-bottom")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-reference.png`,
  });
  await page.getByTestId("part-clean-solution").click();
  await page.getByTestId("door-loader-door").click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-clean-solution.png`,
  });
  await page.getByTestId("door-loader-door").click();
  await expect(page.getByTestId("door-loader-door")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByTestId("part-sample-track").click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `test-results/${info.project.name}-sample-track.png`,
  });
  expect(errors).toEqual([]);
});
