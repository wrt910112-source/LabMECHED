// Playwright's frontend host uses a disposable database, never the learner database.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.AU5800_DB = join(mkdtempSync(join(tmpdir(), "au5800-test-frontend-")), "test.sqlite");
await import("./dev.mjs");
