import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
const rows = [
  ["water", "RB"],
  ["lcc1", "CALI"],
  ["lcc2", "CALI"],
  ["co2-1", "CALI"],
  ["co2-2", "CALI"],
  ["ucre", "CALI"],
  ["mas-1", "QC"],
  ["mas-3", "QC"],
  ["ae-1", "QC"],
  ["ae-2", "QC"],
  ["ita-1", "QC"],
  ["ita-3", "QC"],
  ["crp-a", "QC"],
  ["crp-b", "QC"],
  ["urine-qc-1", "QC"],
  ["urine-qc-2", "QC"],
];
export async function fillPreparationUI(
  page: Page,
  exam = false,
  afterRow?: (i: number) => Promise<void>,
  start = 0,
  afterDispense?: (i: number) => Promise<void>,
) {
  const panel = page.getByRole("region", {
    name: "校正與品管備料",
    exact: true,
  });
  const slots: Record<string, number> = { RB: 10, CALI: 10, QC: 10 };
  for (let i = 0; i < start; i++) slots[rows[i][1]]--;
  async function action(fn: () => Promise<unknown>) {
    const response = exam
      ? page.waitForResponse(
          (r) => r.url().includes("/events") && r.request().method() === "POST",
        )
      : null;
    await expect(panel).toHaveAttribute("data-saving", "false");
    await fn();
    if (response) expect((await response).status()).toBe(200);
    await expect(panel).toHaveAttribute("data-saving", "false");
  }
  const b = (name: string) => panel.getByRole("button", { name, exact: true });
  for (let i = start; i < rows.length; i++) {
    const [id, rack] = rows[i];
    await action(() => panel.getByTestId(`prep-source-${id}`).click());
    const container = panel.getByLabel("備料容器", { exact: true });
    if ((await container.inputValue()) !== `cup-${i + 1}`)
      await action(() => container.selectOption(`cup-${i + 1}`));
    if (i === 1) {
      await b("01 選取來源").click();
      await action(() => page.keyboard.press("e"));
    } else await action(() => b("吸取來源液").click());
    for (let n = 0; n < (id.startsWith("ae-") ? 2 : 1); n++)
      await action(() =>
        b(id.startsWith("ae-") ? "加入一滴" : "加入容器").click(),
      );
    await afterDispense?.(i);
    await b("03 裝架").click();
    await panel.getByLabel("備料檢體架", { exact: true }).selectOption(rack);
    await panel
      .getByLabel("備料孔位", { exact: true })
      .selectOption(String(slots[rack]--));
    await action(() => b("放入架位").click());
    await afterRow?.(i);
  }
  await b("04 上機").click();
  for (const rack of ["QC", "RB", "CALI"]) {
    await panel.getByLabel("備料檢體架", { exact: true }).selectOption(rack);
    await action(() => b("放至進樣區").click());
    await action(() => b("推入儀器").click());
  }
}
export async function preparationShot(
  page: Page,
  name: string,
  project: string,
) {
  mkdirSync("artifacts/preparation", { recursive: true });
  await page.mouse.move(2, 2);
  await page.screenshot({
    path: `artifacts/preparation/${project}-${name}.png`,
  });
}
