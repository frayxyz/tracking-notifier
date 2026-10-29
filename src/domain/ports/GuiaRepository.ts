import type { EventoDeEstado } from "../guia/EventoDeEstado.js";

export interface GuiaRepository {
  eventosDeGuia(tenantId: string, guiaId: string): Promise<EventoDeEstado[]>;
  buscarEvento(tenantId: string, eventId: string): Promise<EventoDeEstado | null>;
  guardar(evento: EventoDeEstado): Promise<void>;
}
