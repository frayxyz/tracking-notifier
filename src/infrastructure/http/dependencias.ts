import type { RegistrarEventoDeEstadoUseCase } from "../../application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import type { ConsultarHistorialDeGuiaUseCase } from "../../application/use-cases/ConsultarHistorialDeGuiaUseCase.js";
import type { ConfigurarWebhookUseCase } from "../../application/use-cases/ConfigurarWebhookUseCase.js";
import type { ListarNotificacionesUseCase } from "../../application/use-cases/ListarNotificacionesUseCase.js";
import type { MetricasDelServicio } from "../observability/metrics.js";

export interface DependenciasHttp {
  registrarEvento: RegistrarEventoDeEstadoUseCase;
  consultarHistorial: ConsultarHistorialDeGuiaUseCase;
  configurarWebhook: ConfigurarWebhookUseCase;
  listarNotificaciones: ListarNotificacionesUseCase;
  metricas: MetricasDelServicio;
}

export interface ResultadoRegistroResponse {
  estado: "ACEPTADO" | "DUPLICADO";
  eventoId: string;
  guiaId: string;
  estadoActual: string | null;
  resourceId: string;
}
