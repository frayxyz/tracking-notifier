import type { Express } from "express";
import { createApp } from "../../src/infrastructure/http/app.js";
import { RegistrarEventoDeEstadoUseCase } from "../../src/application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import { ConsultarHistorialDeGuiaUseCase } from "../../src/application/use-cases/ConsultarHistorialDeGuiaUseCase.js";
import { ConfigurarWebhookUseCase } from "../../src/application/use-cases/ConfigurarWebhookUseCase.js";
import { ListarNotificacionesUseCase } from "../../src/application/use-cases/ListarNotificacionesUseCase.js";
import { MetricasDelServicio } from "../../src/infrastructure/observability/metrics.js";
import { createLoggerStub } from "./logger-stub.js";
import {
  RelojFijo,
  RepositorioDeEventosEnMemoria,
  RepositorioDeNotificacionesEnMemoria,
  TransaccionEnMemoria,
} from "./adaptadores-memoria.js";
import { RepositorioDeConfiguracionWebhookEnMemoria } from "./repositorio-webhook-memoria.js";

export interface AppDePrueba {
  app: Express;
  eventos: RepositorioDeEventosEnMemoria;
  notificaciones: RepositorioDeNotificacionesEnMemoria;
}

export function construirAppDePrueba(): AppDePrueba {
  const eventos = new RepositorioDeEventosEnMemoria();
  const notificaciones = new RepositorioDeNotificacionesEnMemoria();
  const configuraciones = new RepositorioDeConfiguracionWebhookEnMemoria();
  const metricas = new MetricasDelServicio();

  const app = createApp(createLoggerStub(), {
    registrarEvento: new RegistrarEventoDeEstadoUseCase(
      eventos,
      notificaciones,
      TransaccionEnMemoria,
      RelojFijo,
    ),
    consultarHistorial: new ConsultarHistorialDeGuiaUseCase(eventos),
    configurarWebhook: new ConfigurarWebhookUseCase(configuraciones, {
      generar: () => "secreto-de-prueba",
    }),
    listarNotificaciones: new ListarNotificacionesUseCase(notificaciones),
    metricas,
  }, metricas);

  return { app, eventos, notificaciones };
}
