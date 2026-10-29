import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { BaseDeDatos } from "./db-postgres.js";

const dirActual = path.dirname(fileURLToPath(import.meta.url));

export async function migrar(base: BaseDeDatos): Promise<void> {
  await migrate(base, { migrationsFolder: path.join(dirActual, "migrations") });
}
