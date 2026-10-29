import type { EventoDeEstado } from "./EventoDeEstado.js";

export function ordenarEventosCronologicamente(eventos: EventoDeEstado[]): EventoDeEstado[] {
  return [...eventos].sort((a, b) => {
    const diferencia = a.fechaEvento.getTime() - b.fechaEvento.getTime();
    if (diferencia !== 0) return diferencia;
    return a.fechaRegistro.getTime() - b.fechaRegistro.getTime();
  });
}
