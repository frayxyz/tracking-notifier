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
  ) {}

  static registrada(evento: EventoDeEstado, ahora: Date): Notificacion {
    return new Notificacion(
      evento.eventId,
      evento.tenantId,
      evento.guiaId,
      construirPayload(evento),
      "PENDING",
      0,
      ahora,
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
  ): Notificacion {
    return new Notificacion(eventoId, tenantId, guiaId, payload, estado, intentos, proximoIntentoEn);
  }

  conEstado(estado: EstadoNotificacion, intentos: number, proximoIntentoEn: Date): Notificacion {
    return new Notificacion(
      this.eventoId,
      this.tenantId,
      this.guiaId,
      this.payload,
      estado,
      intentos,
      proximoIntentoEn,
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
