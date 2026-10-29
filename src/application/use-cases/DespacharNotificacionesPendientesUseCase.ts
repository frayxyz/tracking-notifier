import type { ResultadoDespacho, DespachadorDeWebhook } from "../../domain/ports/DespachadorDeWebhook.js";
import type { NotificacionRepository } from "../../domain/ports/NotificacionRepository.js";
import type { ConfiguracionWebhookRepository } from "../../domain/ports/ConfiguracionWebhookRepository.js";
import type { Reloj } from "../../domain/ports/Reloj.js";
import { PoliticaDeReintentos } from "../../domain/notificacion/PoliticaDeReintentos.js";

export interface ConfiguracionDelWorker {
  tamanoLote: number;
  maxIntentos: number;
  backoffBaseMs: number;
}

export interface ResumenDeCiclo {
  procesadas: number;
  entregadas: number;
  reintentando: number;
  fallidas: number;
  sinWebhook: number;
}

export class DespacharNotificacionesPendientesUseCase {
  private readonly politica: PoliticaDeReintentos;

  constructor(
    private readonly notificacionRepository: NotificacionRepository,
    private readonly webhookConfigRepository: ConfiguracionWebhookRepository,
    private readonly despachador: DespachadorDeWebhook,
    private readonly reloj: Reloj,
    config: ConfiguracionDelWorker,
  ) {
    this.politica = new PoliticaDeReintentos(config.maxIntentos, config.backoffBaseMs);
    this.tamanoLote = config.tamanoLote;
  }

  private readonly tamanoLote: number;

  async ejecutar(): Promise<ResumenDeCiclo> {
    const ahora = this.reloj.ahora();
    const pendientes = await this.notificacionRepository.pendientes(this.tamanoLote, ahora);
    const resumen: ResumenDeCiclo = { procesadas: 0, entregadas: 0, reintentando: 0, fallidas: 0, sinWebhook: 0 };

    for (const notificacion of pendientes) {
      resumen.procesadas++;
      const config = await this.webhookConfigRepository.buscar(notificacion.tenantId);

      if (!config) {
        await this.notificacionRepository.actualizar(
          notificacion.conEstado(
            "FAILED",
            this.politica.maxIntentos,
            ahora,
            "El tenant no tiene webhook configurado",
          ),
        );
        resumen.fallidas++;
        resumen.sinWebhook++;
        continue;
      }

      const intento = notificacion.intentos + 1;
      const resultado = await this.despacharSeguro(
        config.url,
        notificacion.payload,
        config.secret,
      );

      if (resultado.exito) {
        await this.notificacionRepository.actualizar(notificacion.conEstado("DELIVERED", intento, ahora));
        resumen.entregadas++;
        continue;
      }

      if (this.politica.agotados(intento)) {
        await this.notificacionRepository.actualizar(
          notificacion.conEstado("FAILED", intento, ahora, errorDe(resultado)),
        );
        resumen.fallidas++;
        continue;
      }

      const proxima = new Date(ahora.getTime() + this.politica.espera(intento));
      await this.notificacionRepository.actualizar(
        notificacion.conEstado("PENDING", intento, proxima, errorDe(resultado)),
      );
      resumen.reintentando++;
    }

    return resumen;
  }

  private async despacharSeguro(
    url: string,
    payload: unknown,
    secret: string,
  ): Promise<ResultadoDespacho> {
    try {
      return await this.despachador.despachar(url, payload as never, secret);
    } catch (err) {
      return {
        exito: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function errorDe(resultado: ResultadoDespacho): string {
  if (resultado.error) return resultado.error;
  if (resultado.httpStatus) return `Respuesta HTTP ${resultado.httpStatus} no exitosa`;
  return "Fallo desconocido al notificar";
}
