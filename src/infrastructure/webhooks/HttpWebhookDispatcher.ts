import { createHmac } from "node:crypto";
import { trace } from "@opentelemetry/api";
import type {
  DespachadorDeWebhook,
  ResultadoDespacho,
} from "../../domain/ports/DespachadorDeWebhook.js";
import type { PayloadWebhook } from "../../domain/notificacion/Notificacion.js";

const ALGORITMO_HMAC = "sha256";

export interface ConfiguracionDelDespachador {
  timeoutMs: number;
  firmaHmacActiva: boolean;
}

export class HttpWebhookDispatcher implements DespachadorDeWebhook {
  constructor(private readonly config: ConfiguracionDelDespachador) {}

  async despachar(
    url: string,
    payload: PayloadWebhook,
    secret: string,
  ): Promise<ResultadoDespacho> {
    const cuerpo = JSON.stringify(payload);
    const tracer = trace.getTracer("tracking-notifier/webhooks");
    return tracer.startActiveSpan("webhook.despachar", async (span) => {
      span.setAttribute("webhook.url", url);
      span.setAttribute("webhook.eventoId", payload.eventId);
      try {
        const respuesta = await fetch(url, {
          method: "POST",
          headers: construirEncabezados(cuerpo, secret, this.config),
          body: cuerpo,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
        span.setAttribute("webhook.httpStatus", respuesta.status);
        if (respuesta.ok) {
          span.setStatus({ code: 1 });
          return { exito: true, httpStatus: respuesta.status };
        }
        span.setStatus({ code: 2, message: `HTTP ${respuesta.status}` });
        return {
          exito: false,
          httpStatus: respuesta.status,
          error: `Respuesta HTTP ${respuesta.status} del webhook`,
        };
      } catch (err) {
        const mensaje = err instanceof Error ? describeFallo(err) : String(err);
        span.setStatus({ code: 2, message: mensaje });
        span.recordException(err instanceof Error ? err : String(err));
        return { exito: false, error: mensaje };
      } finally {
        span.end();
      }
    });
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
