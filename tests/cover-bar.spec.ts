import { selectPart, startDaily } from "./ui";
import { test, expect } from "@playwright/test";

test("front syringe leaf swings outside the cabinet and the right panel stays fixed", async ({
  page,
}) => {
  await page.goto("/");
  const geometry = await page.evaluate(async () => {
    const { createInstrument } = await import("/src/model.ts");
    const T = await import("/node_modules/.vite/deps/three.js");
    const m = createInstrument();
    const leaf = m.root.getObjectByName("front-door-0")!;
    const right = m.root.getObjectByName("front-door-1")!;
    const bounds = (o: any) => new T.Box3().setFromObject(o);
    m.root.updateMatrixWorld(true);
    const rightClosed = bounds(right);
    m.enclosures.setState({
      "ise-top": false,
      "ise-top-rear": false,
      "ise-middle": false,
      "ise-bottom": false,
      "loader-door": false,
      "syringe-front": true,
      "syringe-rear": false,
    });
    let outside = true;
    for (let i = 0; i < 140; i++) {
      m.enclosures.animate();
      m.root.updateMatrixWorld(true);
      // The closed front plane is z=.792. A reversed hinge enters the cabinet.
      outside &&= bounds(leaf).min.z >= 0.78;
    }
    return {
      outside,
      fullyOpenOutside: bounds(leaf).getCenter(new T.Vector3()).z > 1,
      rightFixed: bounds(right).equals(rightClosed),
    };
  });
  expect(geometry).toEqual({
    outside: true,
    fullyOpenOutside: true,
    rightFixed: true,
  });
});

test("contextual covers remain reachable from the directory and preserve daily cover states", async ({
  page,
}, info) => {
  await page.goto("/");
  const viewer = page.locator(".viewer-host");
  for (const [part, id, attribute] of [
    ["ise", "ise-top", "data-ise-top"],
    ["ise", "ise-top-rear", "data-ise-top-rear"],
    ["ise", "ise-module", "data-ise-module"],
    ["ise-reagents", "ise-middle", "data-ise-middle"],
    ["ise-reference", "ise-bottom", "data-ise-bottom"],
    ["loader", "loader-door", "data-loader-door"],
    ["syringes", "syringe-front", "data-syringe-front"],
    ["rear-syringes", "syringe-rear", "data-syringe-rear"],
  ]) {
    await selectPart(page, part);
    const control = page.getByTestId(`context-${id}`);
    await control.click();
    await expect(viewer).toHaveAttribute(attribute, "true");
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await control.click();
    await expect(viewer).toHaveAttribute(attribute, "false");
  }
  await startDaily(page);
  await page.getByRole("button", { name: "退出螢幕 ×", exact: true }).click();
  await selectPart(page, "ise");
  for (const id of ["ise-module", "ise-top", "ise-middle", "ise-bottom"])
    await page.getByTestId(`context-${id}`).click();
  await expect(viewer).toHaveAttribute("data-ise-top-rear", "true");
  await page.getByTestId("context-ise-middle").click();
  await expect(viewer).toHaveAttribute("data-ise-middle", "false");
  await expect(viewer).toHaveAttribute("data-ise-module", "true");
  await expect(viewer).toHaveAttribute("data-ise-bottom", "true");
  await expect(viewer).toHaveAttribute("data-internal", "false");
  await page.screenshot({
    path: `test-results/${info.project.name}-daily-context-covers.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
