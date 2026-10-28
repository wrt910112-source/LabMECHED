import { test, expect, type Page } from "@playwright/test";
async function part(page: Page, id: string) {
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.getByTestId(`part-${id}`).click();
}
test("scene HUD starts in exploration and selection is separate from camera and contextual doors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("model-canvas")).toBeVisible();
  await expect(page.locator(".simulator-shell")).toHaveAttribute(
    "data-mode",
    "explore",
  );
  await expect(page.getByRole("region", { name: "練習任務紀錄" })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-exploration.png`,
  });
  const canvas = page.getByTestId("model-canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds!.height).toBeGreaterThan(
    info.project.use.viewport!.height * 0.95,
  );
  await part(page, "ise-reagents");
  await expect(
    page.getByRole("complementary", { name: "部件說明" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "操作", exact: true }).click();
  await expect(page.getByTestId("context-ise-middle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByTestId("context-ise-middle").click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-ise-middle",
    "true",
  );
  await page.getByRole("button", { name: /聚焦部件/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-context.png`,
  });
  await page.getByRole("button", { name: "實機照片", exact: true }).click();
  await expect(page.locator(".hud-part-info figure img")).toBeVisible();
  await page.getByRole("button", { name: "取消選取", exact: true }).click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-selected",
    "overview",
  );
  expect(errors).toEqual([]);
});
test("task center and practice retain true progress and isolate exploration", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await expect(page.locator(".mission-tile")).toHaveCount(4);
  await expect(page.locator(".mission-tile").nth(2)).toBeDisabled();
  await expect(page.locator(".mission-tile").nth(3)).toBeDisabled();
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-task-center.png`,
  });
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await expect(log).toContainText("0／12");
  await log.getByRole("button", { name: "定位目前目標", exact: true }).click();
  const ws = page.locator(".workstation");
  await expect(ws).toBeVisible();
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws
    .getByRole("button", { name: "Analyzer Status", exact: true })
    .click();
  await ws.getByLabel("Bath Temp. 登記").fill("37");
  await ws.getByLabel("Coolant Temp. 登記").fill("22");
  await ws.getByRole("button", { name: "儲存溫度紀錄", exact: true }).click();
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await expect(log).toContainText("1／12");
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-practice.png`,
  });
  await page
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await part(page, "ise-reagents");
  await page.getByRole("button", { name: "操作", exact: true }).click();
  await page.getByTestId("context-ise-middle").click();
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "繼續練習", exact: true }).click();
  await expect(log).toContainText("1／12");
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-ise-middle",
    "false",
  );
  await log.getByRole("button", { name: "操作電腦", exact: true }).click();
  await expect(ws).toBeVisible();
  await ws.getByRole("button", { name: "Home 主選單", exact: true }).click();
  await ws
    .getByRole("button", { name: "Start Condition", exact: true })
    .click();
  await ws.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await part(page, "console");
  await expect(ws.locator(".ws-title")).toContainText("Start Condition");
  await page.screenshot({
    path: `test-results/${info.project.name}-hud-workstation.png`,
  });
  expect(errors).toEqual([]);
});

test("selection, panel wheel and drag do not move the camera or advance tasks", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.getByTestId("model-canvas"),
    host = page.locator(".viewer-host");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(900);
  const request = await host.getAttribute("data-camera-request");
  await part(page, "ise-cups");
  await expect(host).toHaveAttribute("data-camera-request", request!);
  await page.getByRole("button", { name: /聚焦部件/ }).click();
  await expect(host).not.toHaveAttribute("data-camera-request", request!);
  await page.waitForTimeout(1200);
  const camera = await canvas.getAttribute("data-camera");
  const panel = page.getByRole("complementary", { name: "部件說明" });
  const box = (await panel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute("data-camera", camera!);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 20,
    box.y + box.height / 2 + 35,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-camera", camera!);
  await page.getByRole("button", { name: "收合部件資訊", exact: true }).click();
  await expect(panel).not.toBeVisible();
  await page.getByRole("button", { name: "展開部件資訊", exact: true }).click();
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "重設視角", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.mouse.click(15, 200);
  await expect(host).toHaveAttribute("data-selected", "overview");
  await page.keyboard.press("q");
  await expect(
    page.getByRole("dialog", { name: "任務中心", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await expect(log).toContainText("0／12");
  await page.getByRole("button", { name: "部件目錄", exact: true }).click();
  await page.locator(".directory-targets summary").click();
  await page.getByTestId("target-R1-1").click();
  await expect(log).toContainText("0／12");
  await expect(
    page.getByRole("button", { name: "用酒精棉擦拭 R1-1", exact: true }),
  ).toBeDisabled();
});

test("weekly guidance respects parallel tasks, prerequisites and separate practice sessions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.locator(".mission-tile").nth(1).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await expect(log).toContainText("0／9");
  await expect(
    log.getByRole("button", { name: /Sample／ISE 三支探針/ }),
  ).toBeDisabled();
  await log.getByRole("button", { name: /準備七瓶 W2/ }).click();
  await log.getByRole("button", { name: "定位目前目標", exact: true }).click();
  await expect(page.locator(".weekly-panel")).toContainText("W2 準備");
  await expect(log).toContainText("0／9");
  await log.getByRole("button", { name: /準備與櫃內四支 syringe/ }).click();
  await log.getByRole("button", { name: "定位目前目標", exact: true }).click();
  const panel = page.locator("aside .weekly-panel");
  await panel
    .getByLabel("確認預熱／待機，備妥 70% 異丙醇、無絨軟布、通針鐵絲")
    .check();
  for (const id of ["R2-2", "R2-1", "R1-1", "R1-2"])
    await panel.getByLabel(`${id} 水氣檢查`).selectOption("正常");
  await expect(log).toContainText("1／9");
  await expect(
    log.getByRole("button", { name: /Sample／ISE 三支探針/ }),
  ).toBeEnabled();
  await expect(
    log.getByRole("button", { name: /左右两組 mixer/ }),
  ).toBeEnabled();
  await panel.getByLabel("主蓋開啟").check();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-internal",
    "true",
  );
  await page
    .getByRole("button", { name: "返回探索（保留練習）", exact: true })
    .click();
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-internal",
    "false",
  );
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  await expect(log).toContainText("0／12");
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-internal",
    "false",
  );
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await page.locator(".mission-tile").nth(1).click();
  await page.getByRole("button", { name: "繼續練習", exact: true }).click();
  await expect(log).toContainText("1／9");
  await expect(page.locator(".viewer-host")).toHaveAttribute(
    "data-internal",
    "true",
  );
});
