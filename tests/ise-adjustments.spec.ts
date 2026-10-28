import { selectPart, startDaily } from "./ui";
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
    const floorBounds = bounds(floor);
    const rays = [-0.13, 0, 0.1].flatMap((x) =>
      [
        floorBounds.min.z + 0.08,
        (floorBounds.min.z + floorBounds.max.z) / 2,
        floorBounds.max.z - 0.025,
      ].map((z) => {
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
  await selectPart(page, "rear-syringes");
  await page.getByTestId("context-syringe-rear").click();
  await expect(viewer).toHaveAttribute("data-syringe-rear", "true");
  await expect(viewer).toHaveAttribute("data-syringe-front", "false");
  await page.getByTestId("context-syringe-rear").click();
  await selectPart(page, "syringes");
  const toggle = page.getByTestId("context-syringe-front");
  await toggle.click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "true");
  await expect(viewer).toHaveAttribute("data-internal", "false");
  await selectPart(page, "syringes");
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-front-syringe-switch.png`,
  });
  await toggle.click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "false");
  await selectPart(page, "ise");
  await selectPart(page, "ise-reagents");
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-reagent-hood-closed.png`,
  });
  await selectPart(page, "ise");
  for (const id of ["ise-top", "ise-top-rear", "ise-middle", "ise-bottom"])
    await page.getByTestId(`context-${id}`).click();
  await page
    .getByRole("button", { name: "打開 ISE 維護蓋", exact: true })
    .click();
  for (const [id, image] of [
    ["ise-cups", "cups-reference"],
    ["ise-motor", "motor-reference"],
    ["ise-reagents", "lowered-standard-buffer"],
    ["rear-syringes", "two-rear-syringes"],
  ]) {
    await selectPart(page, id);
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
  await startDaily(page);
  const ws = page.locator(".workstation");

  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws.getByRole("button", { name: "日保養", exact: true }).click();
  await ws.locator(".ws-instrument-hud summary").click();
  await ws.getByTestId("practice-front-syringe-toggle").click();
  await ws.getByTestId("practice-rear-syringe-toggle").click();
  await ws.locator(".ws-instrument-hud summary").click();
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-syringe-front", "true");
  await expect(viewer).toHaveAttribute("data-syringe-rear", "true");
  await expect(viewer).toHaveAttribute("data-internal", "false");
});
