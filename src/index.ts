import { getConfig, closeDatabase } from "../../packages/auth/dist/index.js";
import { initializeDatabase } from "./database.js";
import { createApp } from "./app.js";
try {
  const config = getConfig();
  await initializeDatabase();
  const server = createApp().listen(config.PORT, () =>
    console.log(`BookNook API listening on http://localhost:${config.PORT}`),
  );
  const shutdown = () => {
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.on("error", (error) => {
    console.error("Server could not start:", error.message);
    void closeDatabase().finally(() => process.exit(1));
  });
} catch (error) {
  console.error(
    "Startup failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  await closeDatabase().catch(() => {});
  process.exitCode = 1;
}
