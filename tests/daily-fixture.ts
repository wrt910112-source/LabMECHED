import { instrument, closeProgram } from "./ui";
import type { Page, Locator } from "@playwright/test";
import {
  supplyIds,
  supplyLabel,
  dailySyringes,
  iseReagentIds,
  iseReagentNames,
} from "../shared/dailyTasks";

export async function prepareDailyTasks(page: Page, ws: Locator) {
  await closeProgram(ws);
  const b = (name: string) => ws.getByRole("button", { name, exact: true });
  await b("退出螢幕 ×").click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await log.getByRole("button", { name: /補充 CLN-1/ }).click();
  await log.getByRole("button", { name: "操作電腦", exact: true }).click();
  for (const label of [
    "主蓋開啟",
    "ISE 上蓋開啟",
    "ISE Maintenance",
  ])
    await instrument(ws, label);
  for (const id of supplyIds) await b(`補充 ${supplyLabel(id)}`).click();
  for (const label of [
    "前方 syringe 櫃門",
    "後方 syringe 櫃門",
    "Standard／Buffer 罩",
    "Reference 櫃門",
  ])
    await instrument(ws, label);
  for (const id of dailySyringes)
    for (const finding of ["水氣", "漏水"])
      await ws
        .getByLabel(`${id} ${finding}檢查`, { exact: true })
        .selectOption("正常");
  for (const id of iseReagentIds)
    await b(`檢查 ${iseReagentNames[id]}`).click();
  for (const id of ["standard", "buffer"] as const)
    await b(`更換 ${iseReagentNames[id]}`).click();
  await instrument(ws, "ISE Maintenance", false);
  await b("Home 主選單").click();
}
