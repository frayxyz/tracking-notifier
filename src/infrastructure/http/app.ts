import express, { Express, NextFunction, Request, Response, Router } from "express";
import type { Logger } from "../../config/logger.js";
import { ErrorNegocio } from "../../domain/errors.js";
import type { DependenciasHttp } from "./dependencias.js";
import { middlewareDeTenant } from "./middleware/tenant.middleware.js";
import { construirError } from "./error-body.js";
import { montarRutas } from "./rutas.js";

export function createApp(logger: Logger, deps: DependenciasHttp): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  const rutas = Router();
  rutas.use(middlewareDeTenant);
  montarRutas(rutas, deps);

  app.use("/v1", rutas);

  app.use((req, res) => {
    res.status(404).json(construirError("NOT_FOUND", "Route not found"));
    void req;
  });

  app.use(errorHandler(logger));
  return app;
}

function errorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ErrorNegocio) {
      res
        .status(err.httpStatus)
        .json(construirError(err.codigo, err.message, err.detalles));
      return;
    }
    if (esErrorDeBodyJson(err)) {
      res.status(400).json(construirError("INVALID_BODY", "Request body must be valid JSON"));
      return;
    }
    logInternal(logger, err);
    res.status(500).json(construirError("INTERNAL_ERROR", "Unexpected internal error"));
  };
}

function esErrorDeBodyJson(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: string }).type === "entity.parse.failed"
  );
}

function logInternal(logger: Logger, err: unknown): void {
  if (err instanceof Error) {
    logger.error(
      { err: { name: err.name, message: err.message, stack: err.stack } },
      "unhandled error",
    );
    return;
  }
  logger.error({ err: String(err) }, "unhandled non-error thrown");
}
