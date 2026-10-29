import type { ConfiguracionWebhook } from "../webhook/ConfiguracionWebhook.js";

export interface ConfiguracionWebhookRepository {
  buscar(tenantId: string): Promise<ConfiguracionWebhook | null>;
  guardar(configuracion: ConfiguracionWebhook): Promise<void>;
}

export interface GeneradorDeSecretos {
  generar(): string;
}
