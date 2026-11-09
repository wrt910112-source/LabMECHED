import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function databasePath(env = process.env) {
  const path = env.AU5800_DB ||
    (env.RENDER === "true"
      ? "/var/data/au5800.sqlite"
      : fileURLToPath(new URL("../data/au5800.sqlite", import.meta.url)));
  if (env.RENDER === "true" && !isAbsolute(path)) {
    throw new Error("On Render, AU5800_DB must be an absolute path inside the persistent disk, for example /var/data/au5800.sqlite.");
  }
  return path === ":memory:" ? path : resolve(path);
}
