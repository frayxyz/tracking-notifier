import type { ConfiguracionWebhook } from "../../src/domain/webhook/ConfiguracionWebhook.js";

export class RepositorioDeConfiguracionWebhookEnMemoria {
  private readonly configuraciones = new Map<string, ConfiguracionWebhook>();

  async buscar(tenantId: string): Promise<ConfiguracionWebhook | null> {
    return this.configuraciones.get(tenantId) ?? null;
  }

  async guardar(configuracion: ConfiguracionWebhook): Promise<void> {
    this.configuraciones.set(configuracion.tenantId, configuracion);
  }

  contiene(tenantId: string): boolean {
    return this.configuraciones.has(tenantId);
  }
}
