import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { selectPart } from "./ui";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function photo(page: Page, filename: string) {
  await button(page, "實機照片").click();
  const img = page.locator(".hud-part-info figure img");
  await expect(img).toHaveAttribute(
    "src",
    `/references/real-photos/${filename}`,
  );
  await expect
    .poll(() =>
      img.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.locator(".hud-part-info figcaption")).toContainText(
    filename,
  );
}
async function target(page: Page, id: string) {
  await button(page, "部件目錄").click();
  const targets = page.locator(".directory-targets");
  if (!(await targets.evaluate((el) => el.hasAttribute("open"))))
    await targets.locator("summary").click();
  await page.getByTestId(`target-${id}`).click();
}

test("all twenty-three supplied photographs load in their component albums with original filenames", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const albums: [string, string[]][] = [
    ["ise", ["ISE module.jpg", "ISE probe.jpg", "ISE module (上方開啟).jpg"]],
    [
      "ise-internal",
      [
        "ISE module (上方開啟).jpg",
        "ISE module mixing cup, T型管.jpg",
        "ISE module 馬達 (拆卸).jpg",
        "ISE module.jpg",
      ],
    ],
    ["ise-mixing-cup", ["ISE module mixing cup, T型管.jpg"]],
    ["ise-t-tube", ["ISE module mixing cup, T型管.jpg"]],
    ["ise-motor", ["ISE module 馬達 (拆卸).jpg"]],
    ["ise-plug-a", ["ISE module 馬達 (拆卸).jpg"]],
    ["ise-plug-b", ["ISE module 馬達 (拆卸).jpg"]],
    ["ise-cups", ["ISE cups.jpg"]],
    ["ise-reagents", ["ISE standard, buffer.jpg", "ISE reference.jpg"]],
    ["r1", ["R1左側.jpg", "R1右側.jpg", "試劑冰箱 (分析單元).jpg"]],
    ["r2", ["R2左側.jpg", "R2右側.jpg", "試劑冰箱 (分析單元).jpg"]],
    ["sample", ["Sample probes.jpg", "Sample probe DET1, DET2.jpg"]],
    [
      "mixing",
      [
        "mixer bar (右側).jpg",
        "mixer bar (右側)_2.jpg",
        "mixer bar (右側) mixing well.jpg",
        "mixer bar (左側).jpg",
        "mixer bar (左側) mixing well.jpg",
      ],
    ],
    ["syringes", ["前方syringe.jpg"]],
    ["clean-solution", ["wash solution櫃子.jpg", "wash solution.jpg"]],
  ];
  const seen = new Set<string>();
  for (const [id, filenames] of albums) {
    await selectPart(page, id);
    for (const [i, filename] of filenames.entries()) {
      await button(page, "實機照片").click();
      if (i) await button(page, `切換參考照片 ${i + 1}`).click();
      await photo(page, filename);
      if (
        ["clean-solution", "ise-internal", "syringes"].includes(id) &&
        i === 0
      ) {
        await page.locator(".hud-part-info figure").scrollIntoViewIfNeeded();
        mkdirSync("artifacts/real-photos", { recursive: true });
        await page.screenshot({
          path: `artifacts/real-photos/${info.project.name}-${id}-updated.png`,
        });
        if (id === "ise-internal") {
          await button(page, "放大實機照片").click();
          await page.screenshot({
            path: `artifacts/real-photos/${info.project.name}-ise-internal-photo.png`,
          });
          await page.keyboard.press("Escape");
        }
      }
      seen.add(filename);
    }
    await expect(page.locator(".hud-part-info")).not.toContainText("尚未提供");
  }
  expect(seen.size).toBe(23);
  await selectPart(page, "clean-solution");
  await photo(page, "wash solution櫃子.jpg");
  await expect(page.locator(".hud-part-info h2")).toHaveText(
    "Wash Solution 櫃",
  );
  await button(page, "操作").click();
  await expect(page.getByTestId("context-loader-door")).toContainText(
    "Wash Solution 櫃門",
  );
  for (const side of ["左側", "右側"]) {
    await target(page, side);
    await photo(page, `mixer bar (${side}).jpg`);
    await page.locator(".hud-part-info figure").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/real-photos/${info.project.name}-mixer-${side}-updated.png`,
    });
  }
  await selectPart(page, "ise-cups");
  await photo(page, "ISE cups.jpg");
  await button(page, "放大實機照片").click();
  const dialog = page.getByRole("dialog", { name: "實機照片", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("ISE cups.jpg");
  mkdirSync("artifacts/real-photos", { recursive: true });
  await page.screenshot({
    path: `artifacts/real-photos/${info.project.name}-ise-cups.png`,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await selectPart(page, "rear-syringes");
  await button(page, "實機照片").click();
  await expect(page.locator(".hud-part-info")).toContainText(
    "尚未提供實機照片（此零件特寫）",
  );
  expect(errors).toEqual([]);
});

test("precise selections reset albums and match printed bank numbers without advancing practice", async ({
  page,
}, info) => {
  await page.goto("/");
  await button(page, "任務中心").click();
  await button(page, "開始練習").click();
  const log = page.getByRole("region", { name: "練習任務紀錄" });
  await target(page, "右側");
  await photo(page, "mixer bar (右側).jpg");
  await button(page, "切換參考照片 3").click();
  await photo(page, "mixer bar (右側) mixing well.jpg");
  await target(page, "左側");
  await photo(page, "mixer bar (左側).jpg");
  await target(page, "ISE");
  await photo(page, "ISE probe.jpg");
  await button(page, "操作").click();
  await button(page, "結束模型操作視圖").click();
  for (const [slot, file] of [
    ["r1-inner-1", "R1左側.jpg"],
    ["r1-outer-1", "R1右側.jpg"],
    ["r2-inner-1", "R2右側.jpg"],
    ["r2-outer-1", "R2左側.jpg"],
  ]) {
    await selectPart(page, slot.startsWith("r1") ? "r1" : "r2", true);
    await page.getByTestId(`slot-${slot}`).click();
    await photo(page, file);
  }
  await expect(log).toContainText("0／12");
  mkdirSync("artifacts/real-photos", { recursive: true });
  await page.screenshot({
    path: `artifacts/real-photos/${info.project.name}-r2-slot.png`,
  });
  await button(page, "返回探索（保留練習）").click();
  await button(page, "任務中心").click();
  await page.locator(".mission-tile").nth(1).click();
  await button(page, "開始練習").click();
  await selectPart(page, "mixing");
  const panel = page.locator("aside .weekly-panel");
  await panel.getByRole("button", { name: "攪拌棒", exact: true }).click();
  await panel
    .getByRole("button", { name: "聚焦右側攪拌單元", exact: true })
    .click();
  await photo(page, "mixer bar (右側).jpg");
  await expect(log).toContainText("0／9");
});
