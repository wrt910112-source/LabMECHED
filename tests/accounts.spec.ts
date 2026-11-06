import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApplication } from "../server/index.mjs";
import { bootstrapAdministrator } from "../server/accounts.mjs";
import { seedAccount } from "../server/account-fixture.mjs";
let backend: ChildProcess;
const origin = "http://127.0.0.1:3004";
test.beforeEach(async ({ page }) => {
  const path = join(
    mkdtempSync(join(tmpdir(), "account-browser-")),
    "test.sqlite",
  );
  const app = createApplication({ dbPath: path });
  await bootstrapAdministrator(app.db, {
    username: "000029220",
    password: "InitialAccount9",
  });
  await seedAccount(app.db, "learner-a", "learner", "LearnerPassword9", false);
  app.db.close();
  backend = spawn(process.execPath, [resolve("server/index.mjs")], {
    env: { ...process.env, AU5800_PORT: "3004", AU5800_DB: path },
    windowsHide: true,
    stdio: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.route("**/api/**", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("http://127.0.0.1:5173", origin),
    });
    await route.fulfill({ response });
  });
  page.setDefaultTimeout(15000);
});
test.afterEach(async () => {
  if (backend?.exitCode === null) {
    const closed = new Promise((r) => backend.once("exit", r));
    backend.kill();
    await closed;
  }
});
async function login(page: Page, admin = true) {
  await page.goto("/");
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  const form = page.locator(".exam-login");
  await form
    .getByLabel("帳號", { exact: true })
    .fill(admin ? "000029220" : "learner-a");
  await form
    .getByLabel("密碼", { exact: true })
    .fill(admin ? "InitialAccount9" : "LearnerPassword9");
  await form.getByRole("button", { name: "登入", exact: true }).click();
  if (admin) {
    const password = page.locator(".account-password");
    await expect(password).toContainText("首次登入");
    await password.getByLabel("目前／臨時密碼").fill("InitialAccount9");
    await password
      .getByLabel("新密碼", { exact: true })
      .fill("ChangedAccount9");
    await password.getByLabel("再次輸入新密碼").fill("ChangedAccount9");
    await password.getByRole("button", { name: "儲存新密碼" }).click();
    await expect(
      page.getByRole("heading", { name: "學員與帳號管理" }),
    ).toBeVisible();
  }
}
async function shot(page: Page, name: string, project: string) {
  mkdirSync("artifacts/accounts", { recursive: true });
  await page.screenshot({ path: `artifacts/accounts/${project}-${name}.png` });
}
test("administrator manages real account rows, cohorts, first-password changes, last-admin protection and reset credentials", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByLabel("新增班別名稱").fill("帳號驗證班");
  await page.getByRole("button", { name: "建立班別", exact: true }).click();
  await expect(
    page.getByLabel("選取帳號班別").getByRole("option", { name: "帳號驗證班" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "建立學員／帳號" }).click();
  const dialog = page.getByRole("dialog", { name: "建立帳號", exact: true });
  await dialog.getByLabel("登入帳號", { exact: true }).fill("00000101");
  await dialog.getByLabel(/顯示名稱/).fill("帳號功能測試學員");
  await dialog.getByLabel("班別").selectOption({ label: "帳號驗證班" });
  await dialog.getByRole("button", { name: "建立並顯示臨時密碼" }).click();
  const credentials = page.getByRole("dialog", {
    name: "臨時密碼，只顯示一次",
  });
  await expect(credentials).toContainText("00000101");
  const password = await credentials.locator("code").textContent();
  expect(password!.length).toBeGreaterThanOrEqual(8);
  expect(
    await page.evaluate(() => JSON.stringify([localStorage, sessionStorage])),
  ).not.toContain(password!);
  page.once("dialog", (d) => d.accept());
  await credentials.getByRole("button", { name: "已妥善交付，關閉" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "00000101" })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("complementary", { name: "選取帳號詳情" }),
  ).toContainText("須更換初始／臨時密碼");
  await page.getByLabel("帳號狀態", { exact: true }).selectOption("true");
  await shot(page, "management-test-database", info.project.name);
  await page
    .getByRole("row")
    .filter({ hasText: "000029220" })
    .getByRole("button")
    .click();
  await page.getByLabel("選取帳號系統權限").selectOption("learner");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "儲存權限／班別" }).click();
  await expect(page.getByRole("alert")).toContainText("最後一位");
  await page
    .getByRole("row")
    .filter({ hasText: "00000101" })
    .getByRole("button")
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "產生臨時密碼" }).click();
  await expect(credentials).toBeVisible();
  expect(await credentials.locator("code").textContent()).not.toBe(password);
  page.once("dialog", (d) => d.accept());
  await credentials.getByRole("button", { name: "已妥善交付，關閉" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "停用帳號", exact: true }).click();
  await expect(
    page
      .getByRole("complementary", { name: "選取帳號詳情" })
      .getByRole("button", { name: "啟用帳號" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("CSV validates and previews before committing a complete batch and preserves leading zeroes", async ({
  page,
}, info) => {
  await login(page);
  await page.getByRole("button", { name: "CSV 批次建立" }).click();
  const d = page.getByRole("dialog", { name: "CSV 批次建立", exact: true });
  await d.getByLabel("選取 CSV").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("username,password,role\n000003,foo,administrator"),
  });
  await expect(d.getByRole("alert")).toContainText("不可匯入密碼或權限");
  await d.getByLabel("選取 CSV").setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      '\uFEFFusername,name,cohort\r\n000003,"批次測試,甲",\r\n000004,批次測試乙,\r\n',
    ),
  });
  await expect(d).toContainText("已驗證 2 筆；尚未建立任何帳號");
  await expect(page.locator(".account-list")).not.toContainText("000003");
  await shot(page, "import-preview-test-database", info.project.name);
  await d.getByRole("button", { name: "確認整批建立" }).click();
  const c = page.getByRole("dialog", { name: "臨時密碼，只顯示一次" });
  await expect(c.locator("code")).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await c.getByRole("button", { name: "已妥善交付，關閉" }).click();
  await expect(page.locator(".account-list")).toContainText("000003");
  await expect(page.locator(".account-list")).toContainText("000004");
});
test("learner completes both five-level frequencies and a month-based background on a phone layout without admin access", async ({
  page,
}, info) => {
  await login(page, false);
  const form = page.getByRole("form", { name: "學員背景資料" });
  await expect(form).toBeVisible();
  await form.getByLabel("暱稱", { exact: true }).fill("手機背景填寫測試");
  await form.getByLabel("所屬組別").selectOption("血液");
  await form
    .getByLabel("主要身分（單選）")
    .selectOption("檢驗新進人員／PGY學員");
  await form.getByLabel("年", { exact: true }).fill("2");
  await form.getByLabel("月", { exact: true }).fill("4");
  await form.getByLabel("AU5800 使用經驗").selectOption("曾實際操作");
  await form.getByLabel("最近一年使用頻率").selectOption("每週1–4天");
  await form.getByLabel("日保養", { exact: true }).check();
  await form.getByLabel("最近一年保養操作頻率").selectOption("每月1–3次");
  await expect(
    form.getByLabel("最近一年使用頻率").locator("option"),
  ).toHaveCount(6);
  await expect(
    form.getByLabel("最近一年保養操作頻率").locator("option"),
  ).toHaveCount(6);
  await expect(form).toContainText("不含在學實習");
  await expect(form).toContainText("尚未啟用，依院內核定程序辦理");
  await shot(page, "desktop-background-test-database", info.project.name);
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await form.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  await form
    .getByRole("button", { name: "儲存學員資料" })
    .scrollIntoViewIfNeeded();
  await shot(page, "mobile-background-test-database", info.project.name);
  await form.getByRole("button", { name: "儲存學員資料" }).click();
  await expect(
    page.getByRole("button", { name: "帳號管理", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "學員資料", exact: true }).click();
  await expect(form.getByLabel("年", { exact: true })).toHaveValue("2");
  await expect(form.getByLabel("月", { exact: true })).toHaveValue("4");
  await page.reload();
  await page.getByRole("button", { name: "登入／考試", exact: true }).click();
  await page.getByRole("button", { name: "學員資料", exact: true }).click();
  await expect(form.getByLabel("暱稱", { exact: true })).toHaveValue(
    "手機背景填寫測試",
  );
});
test("practice requires login and background completion while closed task tiles cannot be opened", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "任務中心", exact: true }).click();
  await expect(page.locator(".mission-tile").nth(1)).toBeDisabled();
  await expect(page.locator(".mission-tile").nth(2)).toBeDisabled();
  await page.getByRole("button", { name: "開始練習", exact: true }).click();
  const loginForm = page.locator(".exam-login");
  await expect(loginForm).toBeVisible();
  await loginForm.getByLabel("帳號", { exact: true }).fill("learner-a");
  await loginForm.getByLabel("密碼", { exact: true }).fill("LearnerPassword9");
  await loginForm.getByRole("button", { name: "登入", exact: true }).click();
  const profile = page.getByRole("form", { name: "學員背景資料" });
  await profile.getByLabel("暱稱", { exact: true }).fill("登入門檻測試");
  await profile.getByLabel("所屬組別").selectOption("未分發／輪訓");
  await profile.getByLabel("主要身分（單選）").selectOption("檢驗實習生");
  await profile.getByLabel("AU5800 使用經驗").selectOption("從未");
  await profile.getByLabel("最近一年使用頻率").selectOption("從未");
  await profile.getByLabel("無親自保養經驗").check();
  await profile.getByLabel("最近一年保養操作頻率").selectOption("從未");
  await profile.getByRole("button", { name: "儲存學員資料" }).click();
  await expect(
    page.getByRole("region", { name: "練習任務紀錄" }),
  ).toBeVisible();
  await expect(page.locator(".simulator-shell")).toHaveAttribute(
    "data-mode",
    "daily",
  );
  const history = await page.evaluate(
    async () => (await (await fetch("/api/attempts")).json()).attempts,
  );
  expect(history).toEqual([]);
});
