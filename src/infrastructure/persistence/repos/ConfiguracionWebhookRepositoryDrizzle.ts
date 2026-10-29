import { eq } from "drizzle-orm";
import type { ConfiguracionWebhook } from "../../../domain/webhook/ConfiguracionWebhook.js";
import type { ConfiguracionWebhookRepository } from "../../../domain/ports/ConfiguracionWebhookRepository.js";
import { configuracionesWebhook } from "../schema.js";
import type { ProveedorDeDb } from "../proveedor-db.js";

export class ConfiguracionWebhookRepositoryDrizzle implements ConfiguracionWebhookRepository {
  constructor(private readonly proveedor: ProveedorDeDb) {}

  async buscar(tenantId: string): Promise<ConfiguracionWebhook | null> {
    const rows = await this.proveedor.obtener()
      .select()
      .from(configuracionesWebhook)
      .where(eq(configuracionesWebhook.tenantId, tenantId))
      .limit(1);
    const row = rows[0];
    return row ? { tenantId: row.tenantId, url: row.url, secret: row.secret } : null;
  }  async guardar(configuracion: ConfiguracionWebhook): Promise<void> {
    await this.proveedor.obtener()
      .insert(configuracionesWebhook)
      .values({
        tenantId: configuracion.tenantId,
        url: configuracion.url,
        secret: configuracion.secret,
      })
      .onConflictDoUpdate({
        target: configuracionesWebhook.tenantId,
        set: { url: configuracion.url, secret: configuracion.secret },
      });
  }
}

