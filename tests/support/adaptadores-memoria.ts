import type { EventoDeEstado } from "../../src/domain/guia/EventoDeEstado.js";
import {
  Notificacion,
  type EstadoNotificacion,
} from "../../src/domain/notificacion/Notificacion.js";

export class RepositorioDeEventosEnMemoria {
  private readonly eventos: EventoDeEstado[] = [];

  async eventosDeGuia(tenantId: string, guiaId: string): Promise<EventoDeEstado[]> {
    return this.eventos.filter((e) => e.tenantId === tenantId && e.guiaId === guiaId);
  }

  async buscarEvento(tenantId: string, eventId: string): Promise<EventoDeEstado | null> {
    const encontrado = this.eventos.find((e) => e.tenantId === tenantId && e.eventId === eventId);
    return encontrado ?? null;
  }

  async guardar(evento: EventoDeEstado): Promise<void> {
    const duplicado = this.eventos.some(
      (e) => e.tenantId === evento.tenantId && e.eventId === evento.eventId,
    );
    if (!duplicado) this.eventos.push(evento);
  }

  cantidad(): number {
    return this.eventos.length;
  }
}

export class RepositorioDeNotificacionesEnMemoria {
  private readonly notificaciones: Notificacion[] = [];

  async guardar(notificacion: Notificacion): Promise<void> {
    const existente = this.buscar(notificacion.tenantId, notificacion.eventoId);
    if (!existente) this.notificaciones.push(notificacion);
  }

  async actualizar(notificacion: Notificacion): Promise<void> {
    const indice = this.notificaciones.findIndex(
      (n) => n.tenantId === notificacion.tenantId && n.eventoId === notificacion.eventoId,
    );
    if (indice >= 0) this.notificaciones[indice] = notificacion;
  }

  async porEventoId(tenantId: string, eventoId: string): Promise<Notificacion | null> {
    return this.buscar(tenantId, eventoId);
  }

  async pendientes(limite: number, ahora: Date): Promise<Notificacion[]> {
    return this.notificaciones
      .filter((n) => n.estado === "PENDING" && n.proximoIntentoEn.getTime() <= ahora.getTime())
      .slice(0, limite);
  }

  async listar(filtro: {
    tenantId?: string;
    estado?: EstadoNotificacion;
    limite: number;
    offset: number;
  }): Promise<Notificacion[]> {
    return this.notificaciones
      .filter(
        (n) =>
          (!filtro.tenantId || n.tenantId === filtro.tenantId) &&
          (!filtro.estado || n.estado === filtro.estado),
      )
      .slice(filtro.offset, filtro.offset + filtro.limite);
  }

  cantidad(): number {
    return this.notificaciones.length;
  }

  private buscar(tenantId: string, eventoId: string): Notificacion | null {
    return (
      this.notificaciones.find((n) => n.tenantId === tenantId && n.eventoId === eventoId) ?? null
    );
  }
}

export const RelojFijo = {
  ahora(): Date {
    return new Date("2026-01-01T12:00:00.000Z");
  },
};

export const TransaccionEnMemoria = {
  async ejecutar<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  },
};
