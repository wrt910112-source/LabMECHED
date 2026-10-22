import { test, expect } from "@playwright/test";

test("v4 covers sweep to ninety degrees without crossing each other, arch or module cover", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const { OBB } =
      await import("/node_modules/three/examples/jsm/math/OBB.js");
    const m = createInstrument(),
      front = m.enclosures.doors.get("ise-top")!,
      rear = m.enclosures.doors.get("ise-top-rear")!;
    const meshes = (parent: any) => {
      const all: any[] = [];
      parent.traverse((o: any) => {
        if (o.isMesh) all.push(o);
      });
      return all;
    };
    const panel = meshes(front),
      back = meshes(rear);
    const arch = meshes(m.groups.get("ise")).filter(
      (o) => o.name.startsWith("arch-upright") || o.name === "ise-central-arch",
    );
    const metal = meshes(m.iseModel.lid);
    const cups = meshes(m.groups.get("ise-cups"));
    const probe = meshes(m.groups.get("ise")!.getObjectByName("ise-sample-probe"));
    const bound = (o: any) => {
      o.geometry.computeBoundingBox();
      const obb = new OBB()
        .fromBox3(o.geometry.boundingBox)
        .applyMatrix4(o.matrixWorld);
      obb.halfSize.addScalar(-0.001);
      return obb;
    };
    const collisions: string[] = [];
    for (const metalAngle of [0, 45, 90])
      for (let a = 0; a <= 90; a += 5)
        for (let b = 0; b <= 90; b += 5) {
          front.rotation.x = (-a * Math.PI) / 180;
          rear.rotation.x = (b * Math.PI) / 180;
          m.iseModel.lid.rotation.z = (metalAngle * Math.PI) / 180;
          m.root.updateMatrixWorld(true);
          for (const [left, right] of [
            [panel, back],
            [panel, arch],
            [back, arch],
            [panel, metal],
            [back, metal],
            [panel, cups],
            [back, cups],
            [panel, probe],
            [back, probe],
          ])
            for (const x of left)
              for (const y of right)
                if (bound(x).intersectsOBB(bound(y))) {
                  if (collisions.length < 10)
                    collisions.push(
                      `${a}/${b}/${metalAngle}: ${x.name}/${y.name}`,
                    );
                }
        }
    return {
      collisions,
      frontIndependent: front !== rear,
      rearGroup: !!m.groups.get("rear-syringes"),
      frontDoorIndependent: !m.covers.some((o) => o.name === "front-door-0"),
    };
  });
  expect(result).toEqual({
    collisions: [],
    frontIndependent: true,
    rearGroup: true,
    frontDoorIndependent: true,
  });
});

test("v4 exploration preserves covers, rear cameras reveal DET and motor removal obeys plug order", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByTestId("part-ise").click();
  await page.getByTestId("door-ise-top").click();
  await page.getByTestId("door-ise-top-rear").click();
  await page
    .getByRole("button", { name: "打開 ISE 維護蓋", exact: true })
    .click();
  await page.getByTestId("part-ise-motor").click();
  await expect(
    page.getByRole("button", { name: "拆下選定部件", exact: true }),
  ).toBeDisabled();
  for (const id of ["ise-plug-a", "ise-plug-b"]) {
    await page.getByTestId(`part-${id}`).click();
    await page
      .getByRole("button", { name: "拆下選定部件", exact: true })
      .click();
  }
  await page.getByTestId("part-ise-motor").click();
  await page.getByRole("button", { name: "拆下選定部件", exact: true }).click();
  await page.getByTestId("part-ise-plug-a").click();
  await expect(
    page.getByRole("button", { name: "裝回選定部件", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "全部裝回", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已拆下 0／5");
  await page.getByTestId("part-ise-internal").click();
  await expect(
    page.getByRole("button", { name: "關閉 ISE 維護蓋", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-v4-ise-internal.png`,
  });
  await page
    .getByRole("button", { name: "ISE probe 後方", exact: true })
    .click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-v4-ise-rear.png`,
  });
  await page
    .getByRole("button", { name: "Sample probe 後方", exact: true })
    .click();
  await page.getByTestId("part-rear-syringes").click();
  await page
    .getByRole("button", { name: "開關 syringe 櫃門", exact: true })
    .click();
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `test-results/${info.project.name}-v4-rear-syringe.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
