import { test, expect } from "@playwright/test";
import { practiceAccount } from "./practice-account";
import { instrument, startDaily } from "./ui";

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(12000);
  await practiceAccount(page);
});

test("preparation cameras recover after reset, cups can be picked, and three racks can wait together", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "備料工作台", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "校正與品管備料",
    exact: true,
  });
  const b = (name: string) => panel.getByRole("button", { name, exact: true });
  const host = page.locator(".viewer-host");
  const canvas = page.getByTestId("model-canvas");
  await expect
    .poll(
      async () =>
        (await canvas.getAttribute("data-camera"))?.split(",").map(Number)[2],
    )
    .toBeCloseTo(6.4, 1);
  const pick = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module
    const T = await import("/node_modules/.vite/deps/three.js");
    // @ts-expect-error Vite browser module
    const { createPreparationModel } = await import("/src/preparationModel.ts");
    // @ts-expect-error Vite browser module
    const { initialPreparation } = await import("/shared/preparation.ts");
    const model = createPreparationModel();
    model.update(initialPreparation(), { ready: true, token: "test" }, false);
    model.root.updateMatrixWorld(true);
    const el = document.querySelector<HTMLCanvasElement>(
      '[data-testid="model-canvas"]',
    )!;
    const rect = el.getBoundingClientRect();
    const camera = new T.PerspectiveCamera(
      37,
      rect.width / rect.height,
      0.025,
      60,
    );
    camera.position.fromArray(el.dataset.camera!.split(",").map(Number));
    camera.lookAt(new T.Vector3(...el.dataset.target!.split(",").map(Number)));
    camera.setViewOffset(
      rect.width,
      rect.height,
      Math.min(innerWidth * 0.25, 360) / 2,
      0,
      rect.width,
      rect.height,
    );
    camera.updateMatrixWorld(true);
    const point = model.targets
      .get("cup:cup-2")
      .getWorldPosition(new T.Vector3());
    point.y += 0.07;
    point.project(camera);
    return {
      x: rect.left + ((point.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - point.y) * rect.height) / 2,
    };
  });
  await page.mouse.click(pick.x, pick.y);
  await expect(panel.getByLabel("備料容器", { exact: true })).toHaveValue(
    "cup-2",
  );
  await expect(panel.locator(".prep-cup-status")).toContainText(
    "目前選取：杯 2",
  );
  for (const view of ["查看儀器", "備料工作台", "查看進樣區", "備料工作台"]) {
    await b(view).click();
    await page.getByRole("button", { name: "重設視角", exact: true }).click();
  }
  await expect(host).toHaveAttribute("data-preparation-view", "bench");
  await expect
    .poll(
      async () =>
        (await canvas.getAttribute("data-camera"))?.split(",").map(Number)[2],
    )
    .toBeCloseTo(6.4, 1);
  for (const [i, source, rack] of [
    [1, "water", "RB"],
    [2, "lcc1", "CALI"],
    [3, "crp-b", "QC"],
  ] as const) {
    await panel.getByTestId(`prep-source-${source}`).click();
    await panel
      .getByLabel("備料容器", { exact: true })
      .selectOption(`cup-${i}`);
    await b("吸取來源液").click();
    await b("加入容器").click();
    await b("03 裝架").click();
    await panel.getByLabel("備料檢體架", { exact: true }).selectOption(rack);
    await b("放入架位").click();
    await b("04 上機").click();
    await b("放至進樣區").click();
    await expect(panel.locator(".prep-controls")).toContainText("進樣區");
  }
  await expect(panel.locator(".prep-counts b")).toHaveText(["3", "3", "0"]);
  await page.screenshot({
    path: `test-results/${info.project.name}-multiple-entry-racks.png`,
  });
  for (const rack of ["RB", "CALI", "QC"]) {
    await panel.getByLabel("備料檢體架", { exact: true }).selectOption(rack);
    await b("推入儀器").click();
  }
  await expect(host).toHaveAttribute("data-preparation-motion", "false", { timeout: 10000 });
  await page.screenshot({ path: `test-results/${info.project.name}-right-side-rack-exit.png` });
  await expect(panel.locator(".prep-counts b")).toHaveText(["3", "3", "3"]);
  await panel.getByLabel("備料容器", { exact: true }).selectOption("cup-3");
  await expect(panel.locator(".prep-cup-status")).toContainText("CRPH-2");
  await expect(panel.locator(".prep-cup-status")).toContainText("已推入儀器");
});

test("every cup remains clickable through its mouth before and after filling", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "備料工作台", exact: true }).click();
  const panel = page.getByRole("region", { name: "校正與品管備料", exact: true });
  const b = (name: string) => panel.getByRole("button", { name, exact: true });
  const canvas = page.getByTestId("model-canvas");
  await expect.poll(async () => (await canvas.getAttribute("data-camera"))?.split(",").map(Number)[2]).toBeCloseTo(6.4, 1);
  const positions = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module
    const T = await import("/node_modules/.vite/deps/three.js");
    const el = document.querySelector<HTMLCanvasElement>('[data-testid="model-canvas"]')!;
    const rect = el.getBoundingClientRect();
    const camera = new T.PerspectiveCamera(37, rect.width / rect.height, 0.025, 60);
    camera.position.fromArray(el.dataset.camera!.split(",").map(Number));
    camera.lookAt(new T.Vector3(...el.dataset.target!.split(",").map(Number)));
    camera.setViewOffset(rect.width, rect.height, Math.min(innerWidth * 0.25, 360) / 2, 0, rect.width, rect.height);
    camera.updateMatrixWorld(true);
    return Array.from({ length: 16 }, (_, i) => {
      const v = new T.Vector3(0.4 + (i % 4) * 0.19, 1.03, 3.47 + Math.floor(i / 4) * 0.19).project(camera);
      return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 };
    });
  });
  const container = panel.getByLabel("備料容器", { exact: true });
  for (const filled of [false, true]) {
    if (filled) {
      await panel.getByTestId("prep-source-water").click();
      for (let i = 1; i <= 16; i++) {
        await container.selectOption(`cup-${i}`);
        await b("吸取來源液").click();
        await b("加入容器").click();
      }
    }
    for (let i = 0; i < 16; i++) {
      await page.mouse.click(positions[i].x, positions[i].y);
      await expect(container, `${filled ? "filled" : "empty"} cup ${i + 1}`).toHaveValue(`cup-${i + 1}`);
      await expect(panel.locator(".prep-cup-status")).toContainText(filled ? "ddH2O" : "空杯");
    }
  }
});

test("ISE bottle guidance advances from covers to inspection and replacement; calibration explains Maintenance", async ({ page }, info) => {
  await page.goto("/");
  await startDaily(page);
  const ws = page.locator(".workstation");
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  await b("退出螢幕 ×").click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await log.getByRole("button", { name: /檢查 ISE Standard/ }).click();
  await log.getByRole("button", { name: "操作電腦", exact: true }).click();
  const tasks = ws.getByRole("region", { name: "日保養補充與檢查", exact: true });
  await expect(tasks.getByLabel("Standard／Buffer 罩").locator("..")).toHaveClass(/hud-control-target/);
  await tasks.getByLabel("Standard／Buffer 罩").check();
  await tasks.getByLabel("Reference 櫃門").check();
  for (const name of ["ISE Standard", "ISE Buffer", "ISE Reference"]) {
    await expect(b(`檢查 ${name}`)).toHaveClass(/hud-control-target/);
    await b(`檢查 ${name}`).click();
    await expect(b(`更換 ${name}`)).toHaveClass(/hud-control-target/);
    await b(`更換 ${name}`).click();
    await expect(b(`更換 ${name}`)).not.toHaveClass(/hud-control-target/);
    await expect(tasks.getByRole("article", { name: `${name} 操作` })).toContainText("已更換完成");
  }
  await b("Home 主選單").click();
  await b("Analyzer Maintenance").click();
  await b("ISE Maintenance").click();
  await instrument(ws, "ISE Maintenance", true);
  await b("Calibration").click();
  await expect(ws.getByRole("status").filter({ hasText: "請關閉 ISE Maintenance" })).toBeVisible();
  await expect(b("Serum/Urine Start")).toBeDisabled();
  await page.screenshot({ path: `test-results/${info.project.name}-ise-calibration-reminder.png` });
  await instrument(ws, "ISE Maintenance", false);
  await expect(ws.locator(".daily-interlock")).toHaveCount(0);
});

test("daily guidance includes Maintenance entry and exit, supply order and per-rack material lists", async ({
  page,
}, info) => {
  await page.goto("/");
  await startDaily(page);
  const ws = page.locator(".workstation");
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  const choose = async (name: RegExp) => {
    await b("退出螢幕 ×").click();
    await log.getByRole("button", { name }).click();
    await log.getByRole("button", { name: "操作電腦", exact: true }).click();
  };
  await expect(
    ws
      .locator(".ws-toolbar")
      .getByRole("button", { name: "日保養", exact: true }),
  ).toHaveCount(0);
  await choose(/擦拭 6 支探針/);
  await expect(b("Cleaning Probe")).toBeDisabled();
  await expect(b("Inspect Probe & Mixing Bar")).toBeDisabled();
  await expect(ws.locator(".ws-enable")).toHaveClass(/hud-control-target/);
  await instrument(ws, "主蓋開啟");
  await instrument(ws, "Analyzer Maintenance");
  await b("Cleaning Probe").click();
  for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
    await b(`酒精棉擦拭 ${id}`).click();
  await choose(/排水與攪拌檢查/);
  await b("Inspect Probe & Mixing Bar").click();
  for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
    await ws.getByLabel(`${id} 排水`, { exact: true }).selectOption("正常");
  for (const side of ["左側", "右側"])
    await ws.getByLabel(`${side} mixing bars`).selectOption("正常");
  await expect(ws.locator(".ws-enable")).toHaveClass(/hud-control-target/);
  await page.screenshot({
    path: `test-results/${info.project.name}-analyzer-exit-guidance.png`,
  });
  await instrument(ws, "Analyzer Maintenance", false);
  await expect(b("Inspect Probe & Mixing Bar")).toBeDisabled();
  await b("退出螢幕 ×").click();
  const labels = await log.locator("ol button span").allTextContents();
  expect(labels.findIndex((s) => s.includes("補充 CLN"))).toBeLessThan(
    labels.findIndex((s) => s.includes("試劑更換")),
  );
  await page.getByRole("button", { name: "備料工作台", exact: true }).click();
  const checklist = page.locator(".prep-requirements");
  await expect(checklist).toContainText("3 架／16 杯");
  await checklist.locator('[data-rack="CALI"]').click();
  await expect(
    checklist.getByLabel("所選檢體架需求").locator("li"),
  ).toHaveCount(5);
  await checklist.locator('[data-rack="QC"]').click();
  await expect(
    checklist.getByLabel("所選檢體架需求").locator("li"),
  ).toHaveCount(10);
  await expect(checklist).toContainText("CRPH-2");
  await page.screenshot({
    path: `test-results/${info.project.name}-preparation-requirements.png`,
  });
});
