import type { Logger } from "../../config/logger.js";
import type { DespacharNotificacionesPendientesUseCase } from "../../application/use-cases/DespacharNotificacionesPendientesUseCase.js";
import type { MetricasDelServicio } from "../observability/metrics.js";
import { trace } from "@opentelemetry/api";

export class CicloDelWorker {
  private timer: NodeJS.Timeout | null = null;
  private enVuelo = false;

  constructor(
    private readonly casoUso: DespacharNotificacionesPendientesUseCase,
    private readonly intervaloMs: number,
    private readonly logger: Logger,
    private readonly metricas?: MetricasDelServicio,
  ) {}

  iniciar(): void {
    this.timer = setInterval(() => this.paso(), this.intervaloMs);
  }

  private async paso(): Promise<void> {
    if (this.enVuelo) return;
    this.enVuelo = true;
    try {
      const tracer = trace.getTracer("tracking-notifier/outbox");
      await tracer.startActiveSpan("outbox.ciclo", async (span) => {
        const resumen = await this.casoUso.ejecutar();
        const intentos = resumen.entregadas + resumen.reintentando + resumen.fallidas;
        span.setAttribute("outbox.procesadas", resumen.procesadas);
        span.setAttribute("outbox.entregadas", resumen.entregadas);
        span.setAttribute("outbox.reintentando", resumen.reintentando);
        span.setAttribute("outbox.fallidas", resumen.fallidas);
        if (this.metricas) {
          for (let i = 0; i < resumen.entregadas; i++) this.metricas.intentosWebhook.inc({ resultado: "exito" });
          for (let i = 0; i < resumen.reintentando + resumen.fallidas; i++) {
            this.metricas.intentosWebhook.inc({ resultado: "fallo" });
          }
          this.metricas.notificacionesEntregadas.inc(resumen.entregadas);
          this.metricas.notificacionesFallidas.inc(resumen.fallidas);
        }
        if (resumen.procesadas > 0) {
          this.logger.info(
            {
              procesadas: resumen.procesadas,
              entregadas: resumen.entregadas,
              reintentando: resumen.reintentando,
              fallidas: resumen.fallidas,
              intentos,
            },
            "outbox processed",
          );
        }
        span.end();
      });
    } catch (err) {
      this.logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "outbox worker failed",
      );
    } finally {
      this.enVuelo = false;
    }
  }

  detener(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
