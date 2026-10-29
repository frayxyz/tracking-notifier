import type { NextFunction, Request, RequestHandler, Response, Router } from "express";
import type { DependenciasHttp } from "./dependencias.js";
import {
  validar,
  EventoSchema,
  FiltrosNotificacionesSchema,
  GuiaParamsSchema,
  ConfigWebhookSchema,
} from "./dtos/esquemas.js";
import type { ResultadoRegistro } from "../../application/use-cases/RegistrarEventoDeEstadoUseCase.js";

function wrapAsync(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export function montarRutas(rutas: Router, deps: DependenciasHttp): void {
  rutas.post("/events", wrapAsync((req, res) => registrarEvento(req, res, deps)));
  rutas.get("/guides/:guiaId", wrapAsync((req, res) => consultarGuia(req, res, deps)));
  rutas.put("/webhook", wrapAsync((req, res) => configurarWebhook(req, res, deps)));
  rutas.get("/notifications", wrapAsync((req, res) => listarNotificaciones(req, res, deps)));
}

async function registrarEvento(req: Request, res: Response, deps: DependenciasHttp): Promise<void> {
  const payload = validar(EventoSchema, req.body);
  const resultado = await deps.registrarEvento.ejecutar({
    tenantId: req.tenantId!,
    eventId: payload.eventId,
    guiaId: payload.guiaId,
    estado: payload.estado,
    fechaEvento: payload.fechaEvento,
    observacion: payload.observacion,
  });
  res.status(resultado.estado === "ACEPTADO" ? 201 : 200).json(respuestaRegistro(resultado));
}

function respuestaRegistro(r: ResultadoRegistro) {
  return {
    estado: r.estado,
    eventoId: r.eventoId,
    guiaId: r.guiaId,
    estadoActual: r.estadoActual,
    resourceId: r.resourceId,
  };
}

async function consultarGuia(req: Request, res: Response, deps: DependenciasHttp): Promise<void> {
  const { guiaId } = validar(GuiaParamsSchema, req.params);
  const historial = await deps.consultarHistorial.ejecutar({ tenantId: req.tenantId!, guiaId });
  res.status(200).json(historial);
}

async function configurarWebhook(req: Request, res: Response, deps: DependenciasHttp): Promise<void> {
  const { url } = validar(ConfigWebhookSchema, req.body);
  const resultado = await deps.configurarWebhook.ejecutar({ tenantId: req.tenantId!, url });
  res.status(200).json(resultado);
}

async function listarNotificaciones(req: Request, res: Response, deps: DependenciasHttp): Promise<void> {
  const filtros = validar(FiltrosNotificacionesSchema, req.query);
  const resultado = await deps.listarNotificaciones.ejecutar({
    tenantId: req.tenantId!,
    estado: filtros.status,
    limite: filtros.limit ?? 50,
    offset: filtros.offset ?? 0,
  });
  res.status(200).json(resultado);
}
