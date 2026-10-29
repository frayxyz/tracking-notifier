import type { EventoDeEstado } from "../../domain/guia/EventoDeEstado.js";
import type { GuiaRepository } from "../../domain/ports/GuiaRepository.js";
import { GuiaNoEncontrada } from "../../domain/errors.js";

export interface ConsultaHistorial {
  tenantId: string;
  guiaId: string;
}

export interface EventoHistorial {
  eventId: string;
  estado: string;
  fechaEvento: string;
  observacion?: string;
}

export interface HistorialDeGuia {
  guiaId: string;
  estadoActual: string | null;
  eventos: EventoHistorial[];
}

export class ConsultarHistorialDeGuiaUseCase {
  constructor(private readonly guiaRepository: GuiaRepository) {}

  async ejecutar(consulta: ConsultaHistorial): Promise<HistorialDeGuia> {
    const eventos = await this.guiaRepository.eventosDeGuia(consulta.tenantId, consulta.guiaId);
    if (eventos.length === 0) {
      throw new GuiaNoEncontrada(consulta.guiaId);
    }
    const ordenados = ordenarCronologicamente(eventos);
    const ultimo = ordenados[ordenados.length - 1]!;
    return {
      guiaId: consulta.guiaId,
      estadoActual: ultimo.estado.valor,
      eventos: ordenados.map((e) => ({
        eventId: e.eventId,
        estado: e.estado.valor,
        fechaEvento: e.fechaEvento.toISOString(),
        ...(e.observacion !== undefined ? { observacion: e.observacion } : {}),
      })),
    };
  }
}

function ordenarCronologicamente(eventos: EventoDeEstado[]): EventoDeEstado[] {
  return [...eventos].sort((a, b) => {
    const diferencia = a.fechaEvento.getTime() - b.fechaEvento.getTime();
    if (diferencia !== 0) return diferencia;
    return a.fechaRegistro.getTime() - b.fechaRegistro.getTime();
  });
}
