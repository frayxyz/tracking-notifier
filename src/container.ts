import { randomBytes } from "node:crypto";
import type { Env } from "./config/env.js";
import { createLogger, type Logger } from "./config/logger.js";import { ProveedorDeBaseDeDatos } from "./infrastructure/persistence/proveedor-db.js";
import { migrar } from "./infrastructure/persistence/migrar.js";
import { GuiaRepositoryDrizzle } from "./infrastructure/persistence/repos/GuiaRepositoryDrizzle.js";
import { NotificacionRepositoryDrizzle } from "./infrastructure/persistence/repos/NotificacionRepositoryDrizzle.js";
import { ConfiguracionWebhookRepositoryDrizzle } from "./infrastructure/persistence/repos/ConfiguracionWebhookRepositoryDrizzle.js";
import { TransaccionPostgres } from "./infrastructure/persistence/transaccion.js";
import { RegistrarEventoDeEstadoUseCase } from "./application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import { ConsultarHistorialDeGuiaUseCase } from "./application/use-cases/ConsultarHistorialDeGuiaUseCase.js";
import { ConfigurarWebhookUseCase } from "./application/use-cases/ConfigurarWebhookUseCase.js";
import { ListarNotificacionesUseCase } from "./application/use-cases/ListarNotificacionesUseCase.js";
import type { Reloj } from "./domain/ports/Reloj.js";
import { createApp } from "./infrastructure/http/app.js";
import type { DependenciasHttp } from "./infrastructure/http/dependencias.js";

const RelojSistema: Reloj = {
  ahora(): Date {
    return new Date();
  },
};

const GeneradorDeSecretosReal = {
  generar(): string {
    return randomBytes(32).toString("hex");
  },
};

export interface Container {
  env: Env;
  logger: Logger;
  app: ReturnType<typeof createApp>;
  dependenciasHttp: DependenciasHttp;
  proveedor: ProveedorDeBaseDeDatos;
}

export async function construirContainer(env: Env): Promise<Container> {
  const logger: Logger = createLogger(env);

  const proveedor = new ProveedorDeBaseDeDatos(env.DATABASE_URL, env.DATABASE_SSL);
  await migrar(proveedor.obtener());
  logger.info("migraciones aplicadas al arranque");

  const guiaRepository = new GuiaRepositoryDrizzle(proveedor);
  const notificacionRepository = new NotificacionRepositoryDrizzle(proveedor);
  const webhookRepository = new ConfiguracionWebhookRepositoryDrizzle(proveedor);

  const dependenciasHttp: DependenciasHttp = {
    registrarEvento: new RegistrarEventoDeEstadoUseCase(
      guiaRepository,
      notificacionRepository,
      new TransaccionPostgres(proveedor),
      RelojSistema,
    ),
    consultarHistorial: new ConsultarHistorialDeGuiaUseCase(guiaRepository),
    configurarWebhook: new ConfigurarWebhookUseCase(webhookRepository, GeneradorDeSecretosReal),
    listarNotificaciones: new ListarNotificacionesUseCase(notificacionRepository),
  };

  return {
    env,
    logger,
    app: createApp(logger, dependenciasHttp),
    dependenciasHttp,
    proveedor,
  };
}
