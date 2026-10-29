import { Counter, Gauge, Histogram, collectDefaultMetrics, Registry } from "prom-client";

export interface ResumenParaMetricas {
  procesadas: number;
  entregadas: number;
  reintentando: number;
  fallidas: number;
}

/**
 * Métricas Prometheus con vocabulario de negocio.
 * Cada métrica se auto-documenta en GET /metrics (HELP en español).
 */
export class MetricasDelServicio {
  readonly registro = new Registry();

  readonly eventosAceptados: Counter;
  readonly eventosDuplicados: Counter;
  readonly eventosRechazados: Counter;
  readonly notificacionesEntregadas: Counter;
  readonly notificacionesFallidas: Counter;
  readonly notificacionesEnBandeja: Gauge;
  readonly intentosWebhook: Counter;
  readonly latenciaWebhook: Histogram;
  readonly peticionesHttp: Counter;

  constructor() {
    this.eventosAceptados = new Counter({
      name: "tracking_eventos_aceptados_total",
      help: "Eventos de cambio de estado de guías aceptados y persistidos",
      registers: [this.registro],
    });
    this.eventosDuplicados = new Counter({
      name: "tracking_eventos_duplicados_total",
      help: "Eventos ignorados por idempotencia (eventId ya registrado o contenido idéntico al vigente)",
      registers: [this.registro],
    });
    this.eventosRechazados = new Counter({
      name: "tracking_eventos_rechazados_total",
      help: "Eventos rechazados por reglas de negocio o validación",
      labelNames: ["motivo"] as const,
      registers: [this.registro],
    });
    this.notificacionesEntregadas = new Counter({
      name: "tracking_notificaciones_entregadas_total",
      help: "Notificaciones entregadas al webhook del cliente (después del outbox)",
      registers: [this.registro],
    });
    this.notificacionesFallidas = new Counter({
      name: "tracking_notificaciones_fallidas_total",
      help: "Notificaciones agotadas tras el máximo de intentos (estado FAILED, consultable)",
      registers: [this.registro],
    });
    this.notificacionesEnBandeja = new Gauge({
      name: "tracking_notificaciones_en_bandeja",
      help: "Backlog del outbox: notificaciones pendientes de entrega ahora mismo",
      registers: [this.registro],
    });
    this.intentosWebhook = new Counter({
      name: "tracking_webhook_intentos_total",
      help: "Intentos de despacho del worker hacia el webhook del cliente",
      labelNames: ["resultado"] as const,
      registers: [this.registro],
    });
    this.latenciaWebhook = new Histogram({
      name: "tracking_webhook_latencia_segundos",
      help: "Latencia del POST al webhook del cliente (por intento)",
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registro],
    });
    this.peticionesHttp = new Counter({
      name: "http_requests_total",
      help: "Peticiones HTTP atendidas por la API",
      labelNames: ["method", "route", "status"] as const,
      registers: [this.registro],
    });
    collectDefaultMetrics({ register: this.registro });
  }

  registrarEventoAceptado(): void {
    this.eventosAceptados.inc();
  }

  registrarEventoDuplicado(): void {
    this.eventosDuplicados.inc();
  }

  registrarEventoRechazado(motivo: string): void {
    this.eventosRechazados.inc({ motivo });
  }

  registrarCicloDelWorker(resumen: ResumenParaMetricas): void {
    for (let i = 0; i < resumen.entregadas; i++) {
      this.intentosWebhook.inc({ resultado: "exito" });
    }
    for (let i = 0; i < resumen.reintentando + resumen.fallidas; i++) {
      this.intentosWebhook.inc({ resultado: "fallo" });
    }
    this.notificacionesEntregadas.inc(resumen.entregadas);
    this.notificacionesFallidas.inc(resumen.fallidas);
  }

  registrarIntentoWebhook(resultado: "exito" | "fallo", duracionMs: number): void {
    this.intentosWebhook.inc({ resultado });
    this.latenciaWebhook.observe(duracionMs / 1000);
  }

  async registrarBacklog(totalPendientes: number): Promise<void> {
    this.notificacionesEnBandeja.set(totalPendientes);
  }

  async render(): Promise<string> {
    return this.registro.metrics();
  }
}
