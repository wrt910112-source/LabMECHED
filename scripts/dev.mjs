import { createServer } from "vite";
import { createApplication } from "../server/index.mjs";
const requestedPort = process.argv.indexOf("--port");
const port =
  requestedPort >= 0 ? Number(process.argv[requestedPort + 1]) : 5173;
const app = createApplication();
await new Promise((resolve, reject) => {
  app.server.once("error", reject);
  app.server.listen(
    Number(process.env.AU5800_PORT || 3001),
    "127.0.0.1",
    resolve,
  );
});
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.AU5800_PORT || 3001}` },
  },
});
await vite.listen();
vite.printUrls();
const shutdown = async () => {
  await vite.close();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
