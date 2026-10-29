import { createHmac } from "node:crypto";
import type {
  DespachadorDeWebhook,
  ResultadoDespacho,
} from "../../domain/ports/DespachadorDeWebhook.js";
import type { PayloadWebhook } from "../../domain/notificacion/Notificacion.js";
import type { MetricasDelServicio } from "../observability/metrics.js";

const ALGORITMO_HMAC = "sha256";

export interface ConfiguracionDelDespachador {
  timeoutMs: number;
  firmaHmacActiva: boolean;
}

export class HttpWebhookDispatcher implements DespachadorDeWebhook {
  constructor(
    private readonly config: ConfiguracionDelDespachador,
    private readonly metricas?: MetricasDelServicio,
  ) {}

  async despachar(
    url: string,
    payload: PayloadWebhook,
    secret: string,
  ): Promise<ResultadoDespacho> {
    const cuerpo = JSON.stringify(payload);
    const inicio = Date.now();
    try {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: construirEncabezados(cuerpo, secret, this.config),
        body: cuerpo,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (respuesta.ok) {
        this.metricas?.registrarIntentoWebhook("exito", Date.now() - inicio);
        return { exito: true, httpStatus: respuesta.status };
      }
      this.metricas?.registrarIntentoWebhook("fallo", Date.now() - inicio);
      return {
        exito: false,
        httpStatus: respuesta.status,
        error: `Respuesta HTTP ${respuesta.status} del webhook`,
      };
    } catch (err) {
      this.metricas?.registrarIntentoWebhook("fallo", Date.now() - inicio);
      return {
        exito: false,
        error: err instanceof Error ? describeFallo(err) : String(err),
      };
    }
  }
}

function construirEncabezados(
  cuerpo: string,
  secret: string,
  config: ConfiguracionDelDespachador,
): Record<string, string> {
  const encabezados: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "tracking-notifier/0.1",
  };
  if (config.firmaHmacActiva) {
    encabezados["X-Signature"] = `sha256=${createHmac(ALGORITMO_HMAC, secret)
      .update(cuerpo)
      .digest("hex")}`;
  }
  return encabezados;
}

function describeFallo(err: Error): string {
  if (err.name === "TimeoutError") {
    return `El webhook no respondió dentro del tiempo límite`;
  }
  return err.message;
}
