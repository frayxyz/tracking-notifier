import { loadEnv } from "../../config/env.js";
import { crearBaseDeDatos, extraerPool, type BaseDeDatos } from "./db-postgres.js";
import { migrar } from "./migrar.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const base = crearBaseDeDatos(env.DATABASE_URL, env.DATABASE_SSL);
  await migrar(base);
  console.log("migraciones aplicadas");
  await extraerPool(base).end();
}

main().catch((err) => {
  console.error(`danger, migración falló: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
