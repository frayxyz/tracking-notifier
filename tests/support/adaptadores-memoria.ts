import type { EventoDeEstado } from "../../src/domain/guia/EventoDeEstado.js";
import type { Notificacion } from "../../src/domain/notificacion/Notificacion.js";

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
    this.notificaciones.push(notificacion);
  }

  async porEventoId(eventoId: string): Promise<Notificacion | null> {
    return this.notificaciones.find((n) => n.eventoId === eventoId) ?? null;
  }

  cantidad(): number {
    return this.notificaciones.length;
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
