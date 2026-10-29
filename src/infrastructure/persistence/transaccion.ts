import type { Transaccion } from "../../domain/ports/Transaccion.js";
import type { ProveedorDeDb } from "./proveedor-db.js";

export class TransaccionPostgres implements Transaccion {
  constructor(private readonly proveedor: ProveedorDeDb) {}

  ejecutar<T>(fn: () => Promise<T>): Promise<T> {
    return this.proveedor.transaccion(fn);
  }
}
