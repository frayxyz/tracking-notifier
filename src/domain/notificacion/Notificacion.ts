import type { EventoDeEstado } from "../guia/EventoDeEstado.js";

export type EstadoNotificacion = "PENDING" | "DELIVERED" | "FAILED";

export interface PayloadWebhook {
  eventId: string;
  guiaId: string;
  estado: string;
  fechaEvento: string;
  observacion?: string;
}

export class Notificacion {
  private constructor(
    readonly eventoId: string,
    readonly tenantId: string,
    readonly guiaId: string,
    readonly payload: PayloadWebhook,
    readonly estado: EstadoNotificacion,
    readonly intentos: number,
    readonly proximoIntentoEn: Date,
    readonly entregadoEn: Date | null,
    readonly ultimoError: string | null,
  ) {}

  static registrada(evento: EventoDeEstado, ahora: Date): Notificacion {
    return Notificacion.reconstruir(
      evento.eventId,
      evento.tenantId,
      evento.guiaId,
      construirPayload(evento),
      "PENDING",
      0,
      ahora,
      null,
      null,
    );
  }

  static reconstruir(
    eventoId: string,
    tenantId: string,
    guiaId: string,
    payload: PayloadWebhook,
    estado: EstadoNotificacion,
    intentos: number,
    proximoIntentoEn: Date,
    entregadoEn: Date | null,
    ultimoError: string | null,
  ): Notificacion {
    return new Notificacion(
      eventoId,
      tenantId,
      guiaId,
      payload,
      estado,
      intentos,
      proximoIntentoEn,
      entregadoEn,
      ultimoError,
    );
  }

  conEstado(
    estado: EstadoNotificacion,
    intentos: number,
    proximoIntentoEn: Date,
    error: string | null = this.ultimoError,
  ): Notificacion {
    return new Notificacion(
      this.eventoId,
      this.tenantId,
      this.guiaId,
      this.payload,
      estado,
      intentos,
      proximoIntentoEn,
      estado === "DELIVERED" ? new Date() : this.entregadoEn,
      error,
    );
  }
}

function construirPayload(evento: EventoDeEstado): PayloadWebhook {
  const payload: PayloadWebhook = {
    eventId: evento.eventId,
    guiaId: evento.guiaId,
    estado: evento.estado.valor,
    fechaEvento: evento.fechaEvento.toISOString(),
  };
  if (evento.observacion !== undefined) {
    payload.observacion = evento.observacion;
  }
  return payload;
}
