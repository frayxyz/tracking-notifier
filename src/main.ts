import { construirContainer } from "./container.js";
import { loadEnv } from "./config/env.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const container = await construirContainer(env);

  const server = container.app.listen(env.PORT, () => {
    container.logger.info({ port: env.PORT }, "tracking-notifier started");
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      container.logger.info({ signal }, "shutting down");
      server.close(() => process.exit(0));
    });
  }
  process.on("unhandledRejection", (reason) => {
    container.logger.error({ reason: String(reason) }, "unhandled rejection");
  });
}

main().catch((err) => {
  console.error(`Boot failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
