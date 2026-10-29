import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
export async function troubleShot(page: Page, name: string, project: string) {
  mkdirSync("artifacts/troubleshooting", { recursive: true });
  await page.mouse.move(2, 2);
  await page.screenshot({
    path: `artifacts/troubleshooting/${project}-${name}.png`,
  });
}
export async function completeTroubleUi(
  page: Page,
  info: TestInfo,
  exam = false,
  afterOriginal?: () => Promise<void>,
) {
  const room = page.locator(".trouble-room");
  const b = (name: string) => room.getByRole("button", { name, exact: true });
  async function action(fn: () => Promise<unknown>) {
    await expect(room).toHaveAttribute("data-saving", "false");
    const response = exam
      ? page.waitForResponse(
          (r) => r.url().includes("/events") && r.request().method() === "POST",
        )
      : null;
    await fn();
    if (response) expect((await response).status()).toBe(200);
    await expect(room).toHaveAttribute("data-saving", "false");
  }
  async function go(name: string) {
    await action(() =>
      room
        .getByRole("navigation", { name: "UIBC 作業切換" })
        .getByRole("button", { name, exact: true })
        .click(),
    );
  }
  async function run(kind: string) {
    await room.getByLabel("備料後執行方式").selectOption(kind);
    await action(() => b("執行上機作業").click());
    await expect(room).toHaveAttribute("data-running", "false", {
      timeout: 15000,
    });
  }
  async function fill(id: string, cup: string) {
    await action(() => room.getByTestId(`uibc-source-${id}`).click());
    const select = room.getByLabel("UIBC 備料容器");
    if ((await select.inputValue()) !== cup)
      await action(() => select.selectOption(cup));
    await action(() => b("吸取來源液").click());
    await action(() => b("加入容器").click());
  }
  async function place(cup: string, rack: string, slot: string) {
    const select = room.getByLabel("UIBC 備料容器");
    if ((await select.inputValue()) !== cup)
      await action(() => select.selectOption(cup));
    await room.getByLabel("UIBC 檢體架").selectOption(rack);
    await room.getByLabel("UIBC 架位").selectOption(slot);
    await action(() => b("放入架位").click());
  }
  async function load() {
    await action(() => b("放至進樣區").click());
    await action(() => b("推入儀器").click());
  }
  await expect(room).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("model-canvas")).toHaveCount(1);
  await expect(
    room.getByRole("table", { name: "UIBC 品管結果" }),
  ).toContainText("183");
  await expect(
    room.getByRole("table", { name: "UIBC 品管結果" }),
  ).not.toContainText("179");
  await troubleShot(
    page,
    exam ? "exam-approval" : "approval",
    info.project.name,
  );
  await action(() => b("查看結果 initial").click());
  await go("L-J 圖");
  await expect(room.locator("[data-level=primary]")).toHaveAttribute(
    "data-values",
    /183\]$/,
  );
  await room.getByRole("button", { name: "資料點 異常濃度 T13 183" }).click();
  await expect(room.locator(".lis-point-detail")).toContainText("3.25");
  await room.getByLabel("QC 規則判讀").selectOption("1.3S");
  await action(() => b("確認判讀").click());
  await go("相關因素");
  for (const [index, name] of ["品管液", "UIBC 試劑", "校正"].entries()) {
    const detail = room.locator(".lis-body details").nth(index);
    await detail.locator("summary").click();
    await action(() =>
      detail
        .getByRole("button", { name: `已查看${name}資料`, exact: true })
        .click(),
    );
  }
  await go("QC 審批");
  await b("原杯重測身分核對").click();
  await action(() =>
    page
      .getByRole("dialog", { name: "原杯身分核對" })
      .getByRole("button", { name: "核對並前往裝架" })
      .click(),
  );
  await place("cup-1", "QC", "9");
  await load();
  await troubleShot(
    page,
    exam ? "exam-original-loading" : "original-loading",
    info.project.name,
  );
  await run("original");
  await go("QC 審批");
  await action(() => b("查看結果 original").click());
  await go("L-J 圖");
  await room.getByLabel("QC 規則判讀").selectOption("2.2S");
  await action(() => b("確認判讀").click());
  await expect(room.locator("[data-level=primary]")).toHaveAttribute(
    "data-values",
    /183,179\]$/,
  );
  await troubleShot(
    page,
    exam ? "exam-two-abnormal" : "two-abnormal",
    info.project.name,
  );
  await afterOriginal?.();
  await go("UIBC 試劑");
  await action(() => b("更換品管液來源瓶").click());
  await go("備料工作台");
  await action(() => b("取回檢體架").click());
  await fill("uibc-primary", "cup-2");
  await place("cup-2", "QC", "8");
  await load();
  await run("fresh");
  await go("UIBC 試劑");
  for (const pair of ["R1", "R2"]) {
    await room.getByLabel("UIBC 操作瓶別").selectOption(pair);
    await room.getByLabel("UIBC 加入來源").selectOption(pair + "a");
    await room.getByLabel("UIBC 目標儲存槽").selectOption(pair);
    await action(() => b(`取出舊 UIBC ${pair}`).click());
    await action(() => b("加入選取來源至新瓶").click());
    await action(() => b(`混勻新 UIBC ${pair}`).click());
    await action(() => b(`放入新 UIBC ${pair}`).click());
  }
  await action(() => b("Reagent Check").click());
  await troubleShot(page, exam ? "exam-reagent" : "reagent", info.project.name);
  await go("Rack Requisition");
  await expect(room.locator(".lis-interlock")).toContainText(
    "UIBC 試劑已更換，請先完成校正。",
  );
  await b("Calibration").click();
  await b("Start Entry").click();
  await b("27.UIBC Cal.").click();
  await action(() => b("Entry").click());
  await go("備料工作台");
  await fill("lcc2", "cup-3");
  await troubleShot(page, exam ? "exam-aliquot" : "aliquot", info.project.name);
  await place("cup-3", "CALI", "4");
  await load();
  await run("calibration");
  await go("QC 審批");
  await expect(
    room.getByRole("table", { name: "UIBC 品管結果" }),
  ).not.toContainText("155");
  await go("Rack Requisition");
  await b("QC").click();
  await b("Start Entry").click();
  await b("27.UIBC").click();
  await action(() => b("Entry").click());
  await go("備料工作台");
  await room.getByLabel("UIBC 檢體架").selectOption("QC");
  await action(() => b("取回檢體架").click());
  await fill("uibc-primary", "cup-4");
  await fill("uibc-second", "cup-5");
  await place("cup-4", "QC", "6");
  await place("cup-5", "QC", "2");
  await troubleShot(page, exam ? "exam-racks" : "racks", info.project.name);
  await load();
  await run("final");
  await go("QC 審批");
  const first = room.getByRole("button", { name: /查看結果 final-primary/ });
  await action(() => first.click());
  await room
    .getByRole("table", { name: "品管標本清單" })
    .getByRole("button", { name: "第二濃度", exact: true })
    .click();
  await action(() =>
    room.getByRole("button", { name: /查看結果 final-second/ }).click(),
  );
  await go("L-J 圖");
  await expect(room.locator("[data-level=primary]")).toHaveAttribute(
    "data-values",
    /183,179,155\]$/,
  );
  await expect(room.locator("[data-level=second]")).toHaveAttribute(
    "data-values",
    /50\]$/,
  );
  await troubleShot(
    page,
    exam ? "exam-recovered" : "recovered",
    info.project.name,
  );
  await go("檢體回溯填報");
  await expect(room.getByRole("table", { name: "回溯兩支檢體" })).toContainText(
    "0.62%",
  );
  await expect(room.getByRole("table", { name: "回溯兩支檢體" })).toContainText(
    "1.20%",
  );
  for (const target of ["P01", "P02"])
    await action(() => b(`核對 ${target}`).click());
  await b("瀏覽…").click();
  await action(() => b("選取 UIBC_回溯報告.pdf").click());
  await action(() => b("回溯報告上傳").click());
  await expect(room).toHaveAttribute("data-running", "false", {
    timeout: 15000,
  });
  await expect(room.locator(".lis-trace")).toContainText("上傳成功（模擬）");
  await troubleShot(page, exam ? "exam-trace" : "trace", info.project.name);
  await go("品管異常處理表");
  for (const [name, ids] of [
    ["原因探討", ["A3"]],
    ["矯正措施", ["B28", "B27", "B21", "B22"]],
    ["矯正結果", ["C1", "C3"]],
  ] as [string, string[]][]) {
    await b(`開啟${name}片語`).click();
    const dialog = page.getByRole("dialog", {
      name: name + "片語",
      exact: true,
    });
    for (const id of ids) {
      await dialog.getByLabel(name + "輔助片語").selectOption(id);
      await dialog
        .getByRole("button", { name: "加入片語", exact: true })
        .click();
    }
    await action(() =>
      dialog.getByRole("button", { name: "確定", exact: true }).click(),
    );
  }
  await action(() => b("呈送").click());
  await expect(room).toHaveAttribute("data-running", "false", {
    timeout: 15000,
  });
  await expect(room).toContainText("已呈送，待審核");
  await expect(room).toContainText("待主管審核／允收");
  await expect(room).toContainText("本次訓練操作完成");
  await troubleShot(
    page,
    exam ? "exam-submitted" : "submitted",
    info.project.name,
  );
  return { room, go, b, action };
}
