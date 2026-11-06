import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Page } from "@playwright/test";
import { createApplication } from "../server/index.mjs";
import { seedAccount } from "../server/account-fixture.mjs";
let backend: ChildProcess | null = null,
  ready: Promise<void> | null = null;
const origin = "http://127.0.0.1:3005";
export async function practiceAccount(page: Page) {
  if (!ready)
    ready = (async () => {
      const path = join(
        mkdtempSync(join(tmpdir(), "practice-account-")),
        "test.sqlite",
      );
      const app = createApplication({ dbPath: path });
      await seedAccount(app.db, "practice-user", "learner");
      app.db.close();
      backend = spawn(process.execPath, [resolve("server/index.mjs")], {
        env: { ...process.env, AU5800_PORT: "3005", AU5800_DB: path },
        windowsHide: true,
        stdio: "pipe",
      });
      process.once("exit", () => {
        backend?.kill();
      });
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(origin + "/api/health")).ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error("Practice account test backend failed to start");
    })();
  await ready;
  const r = await page.request.post(origin + "/api/auth/login", {
    data: { username: "practice-user", password: "Testing123!" },
  });
  if (!r.ok()) throw Error("Practice fixture login failed");
  await page.route("**/api/**", async (route) => {
    const r = await route.fetch({
      url: route.request().url().replace("http://127.0.0.1:5173", origin),
    });
    await route.fulfill({ response: r });
  });
}
