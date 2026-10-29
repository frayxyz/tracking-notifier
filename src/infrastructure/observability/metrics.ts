import { Counter, collectDefaultMetrics, Registry } from "prom-client";

export class MetricasDelServicio {
  readonly registro = new Registry();
  readonly peticionesHttp: Counter;
  readonly notificacionesEntregadas: Counter;
  readonly notificacionesFallidas: Counter;
  readonly intentosWebhook: Counter;

  constructor() {
    this.peticionesHttp = new Counter({
      name: "http_requests_total",
      help: "Peticiones HTTP atendidas",
      labelNames: ["method", "route", "status"] as const,
      registers: [this.registro],
    });
    this.notificacionesEntregadas = new Counter({
      name: "notificaciones_entregadas_total",
      help: "Notificaciones webhooks entregadas",
      registers: [this.registro],
    });
    this.notificacionesFallidas = new Counter({
      name: "notificaciones_fallidas_total",
      help: "Notificaciones agotadas en FAILED",
      registers: [this.registro],
    });
    this.intentosWebhook = new Counter({
      name: "webhook_attempts_total",
      help: "Intentos de despacho a webhooks",
      labelNames: ["resultado"] as const,
      registers: [this.registro],
    });
    collectDefaultMetrics({ register: this.registro });
  }

  async render(): Promise<string> {
    return this.registro.metrics();
  }
}
