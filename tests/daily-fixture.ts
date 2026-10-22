import type { Page, Locator } from "@playwright/test";
import {
  supplyIds,
  supplyLabel,
  dailySyringes,
  iseReagentIds,
  iseReagentNames,
} from "../shared/dailyTasks";

export async function prepareDailyTasks(page: Page, ws: Locator) {
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  await b("日保養").click();
  await ws.getByRole("button", { name: /^9\. 補充/ }).click();
  for (const label of [
    "主蓋開啟",
    "Analyzer Maintenance",
    "ISE 上蓋開啟",
    "ISE Maintenance",
  ])
    await ws.getByLabel(label, { exact: true }).check();
  for (const id of supplyIds) await b(`補充 ${supplyLabel(id)}`).click();
  for (const label of [
    "前方 syringe 櫃門",
    "後方 syringe 櫃門",
    "Standard／Buffer 罩",
    "Reference 櫃門",
  ])
    await ws.getByLabel(label, { exact: true }).check();
  for (const id of dailySyringes)
    for (const finding of ["水氣", "漏水"])
      await ws
        .getByLabel(`${id} ${finding}檢查`, { exact: true })
        .selectOption("正常");
  for (const id of iseReagentIds)
    await b(`檢查 ${iseReagentNames[id]}`).click();
  for (const id of ["standard", "buffer"] as const)
    await b(`更換 ${iseReagentNames[id]}`).click();
  await ws.getByLabel("ISE Maintenance", { exact: true }).uncheck();
  await b("日保養").click();
}
