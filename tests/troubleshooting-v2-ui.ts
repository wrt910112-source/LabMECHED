import { expect, type Page, type TestInfo } from "@playwright/test";
import { troubleShot } from "./troubleshooting-ui";
export async function completeTroubleUi(
  page: Page,
  info: TestInfo,
  exam = false,
  afterOriginal?: () => Promise<void>,
  confirmFinal?: () => Promise<void>,
) {
  const room = page.locator(".trouble-room"),
    b = (name: string) => room.getByRole("button", { name, exact: true }),
    g = (id: string) => room.locator(`[data-guide="${id}"]`);
  let manual = false,
    explicitQc = false,
    versionTag = "v2";
  async function idle() {
    await expect(room).toHaveAttribute("data-saving", "false");
    await expect(room).toHaveAttribute("data-running", "false");
  }
  async function action(fn: () => Promise<unknown>) {
    await idle();
    const res = exam
      ? page.waitForResponse(
          (r) => r.url().includes("/events") && r.request().method() === "POST",
        )
      : null;
    await fn();
    if (res) expect((await res).status()).toBe(200);
    await expect(room).toHaveAttribute("data-saving", "false");
  }
  async function go(id: string) {
    await action(() => g(`nav-${id}`).click());
  }
  async function glow(id: string) {
    if (exam) {
      await expect(room.locator(".trouble-next")).toHaveCount(0);
      return;
    }
    await expect(room).toHaveAttribute("data-next", id);
    await expect(g(id)).toHaveClass(/trouble-next/);
    await expect(room.locator(".trouble-next")).toHaveCount(1);
  }
  async function click(id: string, event = false) {
    await glow(id);
    if (event) await action(() => g(id).click());
    else await g(id).click();
  }
  async function shot(name: string) {
    if (!exam && (await room.locator(".trouble-next").count()))
      await room.locator(".trouble-next").scrollIntoViewIfNeeded();
    await troubleShot(
      page,
      exam ? `exam-${versionTag}-${name}` : `${versionTag}-${name}`,
      info.project.name,
    );
  }
  async function select(id: string, value: string, event = false) {
    await glow(id);
    if (event) await action(() => g(id).selectOption(value));
    else await g(id).selectOption(value);
  }
  await expect(room).toHaveAttribute(
    "data-version",
    /AU5800-UIBC-2026-10-(29-v2|30-v[34])/,
  );
  versionTag = (await room.getAttribute("data-version"))!.slice(-2);
  manual = versionTag !== "v2";
  explicitQc = versionTag === "v4";
  await expect(
    room.getByRole("table", { name: "品管標本清單" }).getByRole("row"),
  ).toHaveCount(2);
  await expect(b("執行選取作業")).toHaveCount(0);
  await expect(b("原杯重測身分核對")).toHaveCount(0);
  await glow("review-initial");
  await shot("approval-guide");
  await click("review-initial", true);
  await click("nav-chart", true);
  await click("point-initial", true);
  // A wrong draft choice must not move the guide past the rule selector.
  await g("rule").selectOption("1.2S");
  await glow("rule");
  await select("rule", "1.3S");
  await select("followup", "original");
  await shot("interpret-guide");
  await click("confirm-rule", true);
  await click("nav-factors", true);
  for (const id of ["qc", "reagent", "calibration"]) {
    await click(`factor-${id}`);
    if (id === "calibration") {
      await expect(room.locator(".lis-calibration-reminder")).toContainText(
        "試劑校正效期、校正液效期與開封／泡製時間",
      );
      if (!exam) await shot("calibration-check-reminder");
    }
    await click(`inspect-${id}`, true);
  }
  await click("nav-chart", true);
  await click("open-original", true);
  await expect(b("執行上機作業")).toHaveCount(0);
  await expect(room.getByLabel("備料後執行方式")).toHaveCount(0);
  if (!exam) {
    const before = await room.locator(".trouble-hud > h2").textContent();
    await b("備料小抄").click();
    await expect(
      room.getByRole("region", { name: "本次備料小抄" }),
    ).toContainText("將原杯 MAS-1 品管液重新上機");
    await shot("original-bench-note-gold");
    await b("收合備料小抄").click();
    await expect(room.locator("#uibc-bench-note")).toHaveCount(0);
    await expect(room.locator(".trouble-hud > h2")).toHaveText(before!);
    await glow("place");
  } else await expect(b("備料小抄")).not.toBeVisible();
  await click("place", true);
  await click("batch-stage", true);
  await shot("original-loading");
  await click("batch-push", true);
  await idle();
  await click("nav-chart", true);
  await click("point-original", true);
  await select("rule", "2.2S");
  await select("followup", "troubleshoot");
  await shot("two-abnormal");
  await click("confirm-rule", true);
  await afterOriginal?.();
  // Resume the same next-target guidance after reload (exam has no guide).
  await go("reagent");
  for (const id of ["main", "R1", "R2"]) await click(`cover-${id}`, true);
  for (const id of ["R1", "R2"]) {
    await click(`object-old-${id}`);
    await click("remove-old", true);
    if (manual && id === "R1") {
      await expect(room.locator(".viewer-host")).toHaveAttribute(
        "data-trouble-motion",
        "true",
      );
      await page.waitForFunction(
        () =>
          Number(
            (
              document.querySelector(
                ".trouble-room .viewer-host",
              ) as HTMLElement
            )?.dataset.troubleMotionProgress,
          ) >= 0.15,
      );
      await shot("old-R1-lift");
    }
  }
  for (const id of ["R1", "R2"]) {
    await click("reagent-view");
    await click(`object-${id}a`);
    await click(`pour-${id}`, true);
    await click(`object-new-${id}`);
    await click("mix", true);
    await click("install-open");
    if (id === "R2") await select("bank", "R2");
    await shot(`reagent-${id}`);
    await click("install-confirm", true);
    if (id === "R1") {
      // source for R2 is also on this bench; no view toggle needed
      break;
    }
  }
  await click("object-R2a");
  await click("pour-R2", true);
  await click("object-new-R2");
  await click("mix", true);
  await click("install-open");
  await select("bank", "R2");
  await click("install-confirm", true);
  if (manual) {
    await idle();
    await shot("new-bottles-seated");
    for (const id of ["R1", "R2", "main"]) await click(`cover-${id}`, true);
    await click("nav-management", true);
    await click("rm-details");
    await expect(room.getByTestId("uibc-rb-status").first()).toHaveText(
      "未檢查",
    );
    await click("rm-check");
    await b("取消").click();
    await glow("rm-check");
    await click("rm-check");
    await click("rm-check-confirm", true);
    await click("rm-uibc");
    await expect(room.getByTestId("uibc-rb-status")).toHaveText([
      "expired／需校正",
      "expired／需校正",
    ]);
    await expect(room.getByTestId("uibc-cal-status")).toHaveText([
      "expired／需校正",
      "expired／需校正",
    ]);
    await shot("reagent-check-updated");
    await click("rm-review", true);
  }
  await click("nav-calibration", true);
  await click("rr-start");
  await click("rr-tab-Calibration");
  await click("rr-rb-27.UIBC");
  await click("rr-cal-27.UIBC");
  await click("rr-tab-QC");
  await click("rr-qc-27.UIBC");
  if (!exam) {
    await b("Exit").click();
    await glow("rr-start");
    await click("rr-start");
    await click("rr-tab-Calibration");
    await click("rr-rb-27.UIBC");
    await click("rr-cal-27.UIBC");
    await click("rr-tab-QC");
    await click("rr-qc-27.UIBC");
  }
  await shot("rack-entry-guide");
  await click("rr-entry", true);
  await click("nav-bench", true);
  if (!exam) {
    await b("備料小抄").click();
    const note = room.getByRole("region", { name: "本次備料小抄" });
    await expect(note).toContainText("RB／ddH2O、LCC-1、MAS-1、MAS-3");
    await expect(note).not.toContainText("MAS-2");
  }
  // Original QC rack must be retrieved before placing fresh QC cups.
  for (const [id, cup, rack, slot] of [
    ["water", "cup-2", "RB", "2"],
    ["lcc1", "cup-3", "CALI", "3"],
    ["uibc-primary", "cup-4", "QC", "4"],
    ["uibc-second", "cup-5", "QC", "5"],
  ]) {
    await select("cup", cup, true);
    await click(`source-${id}`, true);
    await click("aspirate", true);
    await click("dispense", true);
    if ((await g("rack").inputValue()) !== rack) await select("rack", rack);
    if (rack === "QC" && cup === "cup-4") {
      await click("retrieve", true);
    }
    // Any empty slot is legal, and changing it must not complete placement.
    await g("slot").selectOption(slot);
    await click("place", true);
  }
  await click("batch-RB");
  await click("batch-CALI");
  await shot("racks-guide");
  if (!exam) {
    await shot("batch-bench-note-gold");
    await b("收合備料小抄").click();
  }
  await click("batch-stage", true);
  await click("batch-push", true);
  await idle();
  if (explicitQc) {
    await expect(g("nav-chart")).toHaveAttribute("aria-pressed", "true");
    await expect(room.locator(".trouble-hud h2")).toHaveText(
      exam ? "障礙排除作答中" : "步驟 7／12",
    );
    await expect(
      room.getByRole("table", { name: "兩濃度 QC 允收結果" }),
    ).toContainText("141.0～173.0");
    await expect(
      room.getByRole("table", { name: "兩濃度 QC 允收結果" }),
    ).toContainText("35.8～65.0");
    await expect(room.getByTestId("final-qc-interpretation")).toContainText(
      "155、50",
    );
    await expect(room.getByTestId("final-qc-interpretation")).toContainText(
      "均落在本情境允收範圍內",
    );
    await glow("confirm-qc");
    await shot("qc-awaiting-interpretation");
  }
  if (manual) {
    await go("management");
    await expect(room.getByTestId("uibc-rb-status")).toHaveText([
      "已完成校正（情境）",
      "已完成校正（情境）",
    ]);
    await expect(room.getByTestId("uibc-cal-status")).toHaveText([
      "已完成校正（情境）",
      "已完成校正（情境）",
    ]);
  }
  await go("chart");
  await expect(room.locator("[data-level=primary]")).toHaveAttribute(
    "data-values",
    /183,179,155\]$/,
  );
  await expect(room.locator("[data-level=second]")).toHaveAttribute(
    "data-values",
    /50\]$/,
  );
  await shot("recovered");
  if (explicitQc) {
    // Opening other results cannot replace the explicit confirmation.
    await glow("confirm-qc");
    if (confirmFinal) await confirmFinal();
    else await click("confirm-qc", true);
    await expect(g("nav-trace")).toHaveAttribute("aria-pressed", "true");
    await expect(room).toContainText("QC恢復，回溯／填報待完成。");
  } else await click("nav-trace", true);
  for (const id of ["P01", "P02"]) await click(`trace-${id}`, true);
  await click("report-browse");
  await click("report-file", true);
  await click("report-upload", true);
  await idle();
  await shot("trace");
  await click("nav-form", true);
  for (const [field, title, ids] of [
    ["cause", "原因探討", ["A3"]],
    ["actions", "矯正措施", ["B28", "B27", "B21", "B22"]],
    ["results", "矯正結果", ["C1", "C3"]],
  ] as [string, string, string[]][]) {
    await click(`form-${field}`);
    const dialog = page.getByRole("dialog", {
      name: title + "片語",
      exact: true,
    });
    if (exam) await expect(dialog.locator(".lis-phrase-help")).toHaveCount(0);
    else
      await expect(dialog.locator(".lis-phrase-help")).toHaveText(
        "請選取正確的片語以及操作順序，選取正確者會亮燈提示輸入",
      );
    if (!exam && field === "cause") {
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await glow("form-cause");
      await click("form-cause");
    }
    if (!exam) {
      await g("phrase-choice").selectOption(
        { cause: "A4", actions: "B23", results: "C2" }[field]!,
      );
      await glow("phrase-choice");
      await expect(g("phrase-add")).not.toHaveClass(/trouble-next/);
      await shot(`phrase-${field}-hint`);
    }
    for (const id of manual && field === "results" ? [...ids].reverse() : ids) {
      if (manual && field === "results") {
        await g("phrase-choice").selectOption(id);
        await g("phrase-add").click();
      } else {
        await select("phrase-choice", id);
        await click("phrase-add");
      }
    }
    await shot(`phrase-${field}`);
    await click("phrase-confirm", true);
    await expect(dialog).not.toBeVisible();
  }
  await click("form-submit", true);
  await idle();
  await expect(room).toContainText("本次訓練操作完成");
  await expect(room).toContainText("待主管審核／允收");
  await shot("submitted");
  return { room, b, go, action };
}
