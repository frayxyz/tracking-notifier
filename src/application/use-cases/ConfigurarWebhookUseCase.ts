import { UrlWebhookInvalida } from "../../domain/errors.js";
import type { ConfiguracionWebhookRepository, GeneradorDeSecretos } from "../../domain/ports/ConfiguracionWebhookRepository.js";

export interface ComandoConfigurarWebhook {
  tenantId: string;
  url: string;
}

export interface ResultadoConfiguracion {
  tenantId: string;
  url: string;
  webhookSecret: string;
}

const PUERTOS_VALIDOS = new Set(["http:", "https:"]);

export class ConfigurarWebhookUseCase {
  constructor(
    private readonly configuracionRepository: ConfiguracionWebhookRepository,
    private readonly generadorDeSecretos: GeneradorDeSecretos,
  ) {}

  async ejecutar(comando: ComandoConfigurarWebhook): Promise<ResultadoConfiguracion> {
    let destino: URL;
    try {
      destino = new URL(comando.url);
    } catch {
      throw new UrlWebhookInvalida(comando.url);
    }
    if (!PUERTOS_VALIDOS.has(destino.protocol)) {
      throw new UrlWebhookInvalida(comando.url);
    }

    const configuracion = {
      tenantId: comando.tenantId,
      url: comando.url,
      secret: this.generadorDeSecretos.generar(),
    };
    await this.configuracionRepository.guardar(configuracion);
    return {
      tenantId: configuracion.tenantId,
      url: configuracion.url,
      webhookSecret: configuracion.secret,
    };
  }
}
