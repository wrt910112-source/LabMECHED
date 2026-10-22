import { test, expect } from "@playwright/test";

test("ISE cup camera has clear rays with either module-lid state and analyzer main cover closed", async ({
  page,
}) => {
  await page.goto("/");
  const hits = await page.evaluate(async () => {
    // Inspect actual scene geometry, including the two raised black cover panels.
    const { createInstrument } = await import("/src/model.ts");
    const { partById } = await import("/src/data.ts");
    const T = await import("/node_modules/.vite/deps/three.js");
    const m = createInstrument();
    m.enclosures.setState({
      "ise-top": true,
      "ise-top-rear": true,
      "ise-middle": false,
      "ise-bottom": false,
      "loader-door": false,
    });
    for (let i = 0; i < 150; i++) m.enclosures.animate();
    const eye = new T.Vector3(...partById["ise-cups"].eye);
    const meshes: any[] = [];
    m.root.traverse((o: any) => {
      if (o.isMesh) meshes.push(o);
    });
    return [false, true].map((open) => {
      m.iseModel.setState({ open, removed: [] });
      for (let i = 0; i < 150; i++) m.iseModel.animate();
      m.root.updateMatrixWorld(true);
      return Array.from({ length: 4 }, (_, i) => {
        const target = new T.Vector3(
          0.128 + i * 0.029,
          0.945,
          -0.181 - i * 0.007,
        );
        const ray = new T.Raycaster(
          eye,
          target.clone().sub(eye).normalize(),
          0,
          eye.distanceTo(target) - 0.014,
        );
        return ray
          .intersectObjects(meshes, false)
          .filter((hit: any) => {
            let object = hit.object;
            while (object) {
              if (!object.visible) return false;
              object = object.parent;
            }
            return true;
          })
          .map((hit: any) => hit.object.name);
      });
    });
  });
  expect(hits).toEqual([
    [[], [], [], []],
    [[], [], [], []],
  ]);
});

test("ISE cup view preserves independent covers and spreads all four labels", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "01 日保養 開始練習", exact: true })
    .click();
  const ws = page.locator(".workstation");
  const button = (name: string) =>
    ws.getByRole("button", { name, exact: true });
  await button("開始日保養").click();
  await button("Home 主選單").click();
  await button("Analyzer Maintenance").click();
  await button("ISE Maintenance").click();
  await button("到模型操作").click();
  const panel = page.locator(".model-practice"),
    viewer = page.locator(".viewer-host");
  const modelButton = (name: string) =>
    panel.getByRole("button", { name, exact: true });
  await panel.getByLabel("ISE 上蓋開啟", { exact: true }).check();
  await expect(viewer).toHaveAttribute("data-internal", "false");
  await expect(viewer).toHaveAttribute("data-ise-module", "false");
  await modelButton("放入裝滿 Cleaning Solution 的 CLEAN 杯").click();
  await modelButton("取出並丟棄 CLEAN 杯").click();
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) {
    await modelButton(id).click();
    await modelButton(`放入 ${id} 校正杯`).click();
  }
  await page.waitForTimeout(1000);
  const boxes = [];
  for (const id of ["S-H", "S-L", "U-H", "U-L"]) {
    const label = page.getByRole("button", {
      name: `模型操作 ${id}`,
      exact: true,
    });
    await expect(label).toBeVisible();
    boxes.push((await label.boundingBox())!);
  }
  boxes.sort((a, b) => a.x - b.x);
  for (let i = 1; i < boxes.length; i++)
    expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x + boxes[i - 1].width);
  await page.screenshot({
    path: `test-results/${info.project.name}-ise-cups-clear.png`,
  });
  await panel.getByLabel("ISE module 蓋開啟", { exact: true }).check();
  await expect(viewer).toHaveAttribute("data-internal", "false");
  await expect(viewer).toHaveAttribute("data-ise-top", "true");
  await expect(viewer).toHaveAttribute("data-ise-module", "true");
});
