import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { createApp } from "./infrastructure/http/app.js";

function main(): void {
  const env = loadEnv();
  const logger = createLogger(env);
  const app = createApp(logger);

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "tracking-notifier started");
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      logger.info({ signal }, "shutting down");
      server.close(() => process.exit(0));
    });
  }
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason: String(reason) }, "unhandled rejection");
  });
}

try {
  main();
} catch (err) {
  console.error(`Boot failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
