import { and, asc, eq } from "drizzle-orm";
import { EstadoGuia } from "../../../domain/guia/EstadoGuia.js";
import { EventoDeEstado } from "../../../domain/guia/EventoDeEstado.js";
import type { GuiaRepository } from "../../../domain/ports/GuiaRepository.js";
import { eventosDeEstado } from "../schema.js";
import type { ProveedorDeDb } from "../proveedor-db.js";

export class GuiaRepositoryDrizzle implements GuiaRepository {
  constructor(private readonly proveedor: ProveedorDeDb) {}

  async eventosDeGuia(tenantId: string, guiaId: string): Promise<EventoDeEstado[]> {
    const rows = await this.proveedor.obtener()
      .select()
      .from(eventosDeEstado)
      .where(and(eq(eventosDeEstado.tenantId, tenantId), eq(eventosDeEstado.guiaId, guiaId)))
      .orderBy(asc(eventosDeEstado.fechaEvento));
    return rows.map(mapearEvento);
  }

  async buscarEvento(tenantId: string, eventId: string): Promise<EventoDeEstado | null> {
    const rows = await this.proveedor.obtener()
      .select()
      .from(eventosDeEstado)
      .where(and(eq(eventosDeEstado.tenantId, tenantId), eq(eventosDeEstado.eventId, eventId)))
      .limit(1);
    const row = rows[0];
    return row ? mapearEvento(row) : null;
  }

  async guardar(evento: EventoDeEstado): Promise<void> {
    await this.proveedor.obtener()
      .insert(eventosDeEstado)
      .values({
        tenantId: evento.tenantId,
        eventId: evento.eventId,
        guiaId: evento.guiaId,
        estado: evento.estado.valor,
        fechaEvento: evento.fechaEvento,
        observacion: evento.observacion ?? null,
        fechaRegistro: evento.fechaRegistro,
      })
      .onConflictDoNothing();
  }
}

function mapearEvento(row: {
  tenantId: string;
  eventId: string;
  guiaId: string;
  estado: string;
  fechaEvento: Date;
  observacion: string | null;
  fechaRegistro: Date;
}): EventoDeEstado {
  return EventoDeEstado.crear({
    tenantId: row.tenantId,
    eventId: row.eventId,
    guiaId: row.guiaId,
    estado: EstadoGuia.desde(row.estado),
    fechaEvento: row.fechaEvento,
    observacion: row.observacion ?? undefined,
    fechaRegistro: row.fechaRegistro,
  });
}
