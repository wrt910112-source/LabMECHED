import { selectPart } from "./ui";
import { test, expect } from "@playwright/test";
import { stabilityWarning } from "../src/requisitionData";
test("reagent stability threshold and rack calibration/QC draft and entry lifecycle", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  expect(stabilityWarning(7.99)).toBe(true);
  expect(stabilityWarning(8)).toBe(false);
  expect(stabilityWarning(null)).toBe(false);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await selectPart(page,"console");
  const screen = page.locator(".workstation");
  const b = (n: string) => screen.getByRole("button", { name: n, exact: true });
  const home = async (n: string) => {
    await b("Home 主選單").click();
    await b(n).click();
  };
  await home("Reagent Management");
  await expect(screen.locator(".reagent-main-grid button")).toHaveCount(30);
  await page.screenshot({
    path: `test-results/${info.project.name}-reagent-main.png`,
  });
  await b("Details").click();
  const cre = screen.getByTestId("reagent-R1-27");
  await expect(cre.getByTestId("rb-stability")).toHaveClass(
    "stability-warning",
  );
  await expect(cre.getByTestId("cal-stability")).toHaveText("7H");
  await screen.getByLabel("CRE remaining hours").fill("8");
  await expect(cre.getByTestId("rb-stability")).not.toHaveClass(
    "stability-warning",
  );
  await screen.getByLabel("CRE remaining hours").fill("7");
  await cre.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/${info.project.name}-reagent-details.png`,
  });
  await home("Rack Requisition");
  await expect(b("Start Entry")).toBeVisible();
  await b("Calibration").click();
  await expect(b("9.CRE RB")).toBeDisabled();
  await b("Start Entry").click();
  await b("9.CRE RB").click();
  await b("9.CRE Cal.").click();
  await b("15.HDL Cal.").click();
  await expect(screen.getByLabel("RB count")).toHaveText("1");
  await expect(screen.getByLabel("Cal count")).toHaveText("2");
  await b("15.HDL Cal.").click();
  await page.screenshot({
    path: `test-results/${info.project.name}-rack-calibration.png`,
  });
  await b("Entry").click();
  await b("Start Entry").click();
  await b("9.CRE RB").click();
  await b("Exit").click();
  await expect(b("9.CRE RB")).toHaveAttribute("aria-pressed", "true");
  await b("QC").click();
  await expect(b("Profile")).toBeDisabled();
  await b("Start Entry").click();
  await b("Profile").click();
  const dialog = screen.getByRole("dialog", { name: "QC Profile" });
  await dialog.getByRole("button", { name: "1.MAS QC", exact: true }).click();
  await expect(dialog.locator(".profile-preview span")).toHaveCount(37);
  for (const group of ["2.AMM/ETOH QC", "4.hsCRP QC", "7.CO2"])
    await dialog.getByRole("button", { name: group, exact: true }).click();
  await expect(dialog.locator(".profile-preview span")).toHaveCount(41);
  await expect(
    dialog.getByRole("button", { name: "3.ITA QC（大夜不執行）", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/${info.project.name}-qc-profile.png`,
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(screen.getByLabel("Selected Tests")).toHaveText("0");
  await b("Profile").click();
  await dialog.getByRole("button", { name: "1.MAS QC", exact: true }).click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(screen.getByLabel("Selected Tests")).toHaveText("37");
  await b("Entry").click();
  await screen.getByLabel("Rack Type").selectOption("Urine");
  await expect(screen.getByLabel("Selected Tests")).toHaveText("0");
  await b("Start Entry").click();
  await b("Profile").click();
  await dialog.getByRole("button", { name: "5.URINE QC", exact: true }).click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(screen.getByLabel("Selected Tests")).toHaveText("13");
  await page.screenshot({
    path: `test-results/${info.project.name}-qc-urine.png`,
  });
  await b("Entry").click();
  await screen.getByLabel("Rack Type").selectOption("Serum");
  await expect(screen.getByLabel("Selected Tests")).toHaveText("37");
  await home("Rack Requisition");
  await b("QC").click();
  await expect(screen.getByLabel("Selected Tests")).toHaveText("37");
  expect(errors).toEqual([]);
});
