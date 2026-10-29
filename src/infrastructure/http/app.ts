import express, { Express, NextFunction, Request, Response } from "express";
import type { Logger } from "../../config/logger.js";
import { ErrorNegocio } from "../../domain/errors.js";

export interface ErrorBody {
  error: { code: string; message: string; details: unknown[] };
}

function errorResponse(code: string, message: string, details: unknown[] = []): ErrorBody {
  return { error: { code, message, details } };
}

export function createApp(logger: Logger): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json(errorResponse("NOT_FOUND", "Route not found"));
  });

  app.use(errorHandler(logger));
  return app;
}

function errorHandler(logger: Logger) {
  return (err: unknown, _req: Request, _res: Response, _next: NextFunction): void => {
    if (err instanceof ErrorNegocio) {
      _res
        .status(err.httpStatus)
        .json(errorResponse(err.codigo, err.message, err.detalles));
      return;
    }
    if (esErrorDeBodyJson(err)) {
      _res
        .status(400)
        .json(errorResponse("INVALID_BODY", "Request body must be valid JSON"));
      return;
    }
    logInternal(logger, err);
    _res
      .status(500)
      .json(errorResponse("INTERNAL_ERROR", "Unexpected internal error"));
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
