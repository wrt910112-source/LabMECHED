import { test, expect } from "@playwright/test";

test("lower shelf keeps Standard/Buffer caps clear and rear cabinet contains two syringes", async ({
  page,
}) => {
  await page.goto("/");
  const geometry = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const T = await import("/node_modules/.vite/deps/three.js");
    const m = createInstrument();
    m.root.updateMatrixWorld(true);
    const bounds = (o: any) => new T.Box3().setFromObject(o);
    const bottles = m.groups.get("ise-reagents")!;
    const fascia = bounds(m.root.getObjectByName("ise-front-rim"));
    const floor = bounds(m.root.getObjectByName("ise-cavity-floor"));
    const shelf = bounds(m.root.getObjectByName("middle-shelf"));
    const reference = bounds(m.root.getObjectByName("reference-door"));
    const caps = ["ISE Mid Standard", "ISE Buffer"].map((name) => {
      const bottle = bottles.getObjectByName(name)!;
      return {
        capBelowFascia:
          bounds(bottle.getObjectByName("cap")).max.y < fascia.min.y,
        bodyAboveShelf:
          bounds(bottle.getObjectByName("bottle-body")).min.y > shelf.max.y,
        floorClear: !bounds(
          bottle.getObjectByName("bottle-body"),
        ).intersectsBox(floor),
      };
    });
    let rearCount = 0;
    m.groups.get("rear-syringes")!.traverse((o) => {
      if (o.userData.componentType === "syringe") rearCount++;
    });
    return {
      caps,
      rearCount,
      referenceBelowShelf: reference.max.y < shelf.min.y,
    };
  });
  expect(geometry).toEqual({
    caps: [
      { capBelowFascia: true, bodyAboveShelf: true, floorClear: true },
      { capBelowFascia: true, bodyAboveShelf: true, floorClear: true },
    ],
    rearCount: 2,
    referenceBelowShelf: true,
  });
});

test("rear right panel stays closed and the upper ISE cavity has a solid boundary above the bottle bay", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const T = await import("/node_modules/.vite/deps/three.js");
    const m = createInstrument();
    m.root.updateMatrixWorld(true);
    const bounds = (o: any) => new T.Box3().setFromObject(o);
    const fixed = m.root.getObjectByName("rear-fixed-right-door")!;
    const before = bounds(fixed);
    const leaf = m.root.getObjectByName("rear-syringe-door")!;
    const leftClosed = bounds(leaf);
    const rear = m.enclosures.doors.get("syringe-rear")!;
    rear.rotation.y = -1.6;
    m.root.updateMatrixWorld(true);
    const floor = m.root.getObjectByName("ise-cavity-floor")!;
    const bottles = ["ISE Mid Standard", "ISE Buffer"].map((name) =>
      m.groups.get("ise-reagents")!.getObjectByName(name)!,
    );
    const jugs = bottles.map((b) => bounds(b));
    // Rays through the module opening must meet the floor before any jug.
    const rays = [-0.13, 0, 0.1].flatMap((x) =>
      [-0.2, 0.1, 0.4].map((z) => {
        const hits = new T.Raycaster(
          new T.Vector3(x, 0.9, z),
          new T.Vector3(0, -1, 0),
        ).intersectObjects([floor, ...bottles], true);
        return hits[0]?.object.name === "ise-cavity-floor";
      }),
    );
    const moduleFront = bounds(m.root.getObjectByName("ise-front-rim")).max.z;
    return {
      fixedRight: before.equals(bounds(fixed)),
      leftOnly: leftClosed.min.x > before.max.x,
      leftMoved: !leftClosed.equals(bounds(leaf)),
      bottlesInSeparateBay: jugs.every((b) => b.min.z > moduleFront),
      solidFloor: rays.every(Boolean),
    };
  });
  expect(result).toEqual({
    fixedRight: true,
    leftOnly: true,
    leftMoved: true,
    bottlesInSeparateBay: true,
    solidFloor: true,
  });
});

test("reference camera framing and front syringe switch preserve independent cover state", async ({
  page,
}, info) => {
  await page.goto("/");
  const viewer = page.locator(".viewer-host");
  const toggle = page.getByTestId("front-syringe-toggle");
  const rearToggle = page.getByTestId("rear-syringe-toggle");
  await expect(rearToggle).toBeVisible();
  const frontRect = await toggle.boundingBox(),
    rearRect = await rearToggle.boundingBox();
  expect(Math.abs(frontRect!.y - rearRect!.y)).toBeLessThan(2);
  await rearToggle.click();
  await expect(viewer).toHaveAttribute("data-syringe-rear", "true");
  await expect(viewer).toHaveAttribute("data-syringe-front", "false");
  await rearToggle.click();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText("開啟前方 syringe 櫃門");
  await toggle.click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "true");
  await expect(viewer).toHaveAttribute("data-internal", "false");
  await page.getByTestId("part-syringes").click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-front-syringe-switch.png`,
  });
  await toggle.click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "false");
  await page.getByTestId("part-ise").click();
  await page.getByTestId("part-ise-reagents").click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-reagent-hood-closed.png`,
  });
  await page.getByTestId("part-ise").click();
  for (const id of ["ise-top", "ise-top-rear", "ise-middle", "ise-bottom"])
    await page.getByTestId(`door-${id}`).click();
  await page
    .getByRole("button", { name: "打開 ISE 維護蓋", exact: true })
    .click();
  for (const [id, image] of [
    ["ise-cups", "cups-reference"],
    ["ise-motor", "motor-reference"],
    ["ise-reagents", "lowered-standard-buffer"],
    ["rear-syringes", "two-rear-syringes"],
  ]) {
    await page.getByTestId(`part-${id}`).click();
    if (id === "rear-syringes")
      await page
        .getByRole("button", { name: "開關 syringe 櫃門", exact: true })
        .click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `test-results/${info.project.name}-${image}.png`,
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "01 日保養 開始練習", exact: true })
    .click();
  const ws = page.locator(".workstation");
  await ws.getByRole("button", { name: "開始日保養", exact: true }).click();
  await ws.getByTestId("practice-front-syringe-toggle").click();
  await ws.getByTestId("practice-rear-syringe-toggle").click();
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "true");
  await expect(viewer).toHaveAttribute("data-syringe-rear", "true");
  await expect(viewer).toHaveAttribute("data-internal", "false");
});
