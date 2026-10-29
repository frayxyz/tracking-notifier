import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type BaseDeDatos = NodePgDatabase<typeof schema>;

export function crearBaseDeDatos(connectionString: string, sslEnabled: boolean): BaseDeDatos {
  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  });
  return drizzle(pool, { schema });
}

export function extraerPool(base: BaseDeDatos): Pool {
  return (base as unknown as { $client: Pool }).$client as Pool;
}
