import type { Pool } from "pg";
import { crearBaseDeDatos, type BaseDeDatos } from "./db-postgres.js";

export interface ProveedorDeDb {
  obtener(): BaseDeDatos;
  transaccion<T>(fn: () => Promise<T>): Promise<T>;
}

export class ProveedorDeBaseDeDatos implements ProveedorDeDb {
  private base: BaseDeDatos;
  private actual: BaseDeDatos | null = null;

  constructor(connectionString: string, sslEnabled: boolean) {
    this.base = crearBaseDeDatos(connectionString, sslEnabled);
  }

  obtener(): BaseDeDatos {
    return this.actual ?? this.base;
  }

  async transaccion<T>(fn: () => Promise<T>): Promise<T> {
    return this.base.transaction(async (tx) => {
      const anterior = this.actual;
      this.actual = tx as unknown as BaseDeDatos;
      try {
        return await fn();
      } finally {
        this.actual = anterior;
      }
    });
  }

  async cerrar(): Promise<void> {
    const pool = (this.base as unknown as { $client: Pool }).$client as Pool;
    await pool.end();
  }
}
