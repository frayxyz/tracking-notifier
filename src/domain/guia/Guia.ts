import { ErrorNegocio } from "../errors.js";
import { EstadoGuia } from "./EstadoGuia.js";
import { EventoDeEstado } from "./EventoDeEstado.js";

export interface SolicitudDeEvento {
  eventId: string;
  estado: EstadoGuia;
  fechaEvento: Date;
  observacion?: string;
  fechaRegistro: Date;
}

export class Guia {
  private constructor(
    readonly tenantId: string,
    readonly guiaId: string,
    private readonly historialEventos: EventoDeEstado[],
  ) {}

  static vacia(tenantId: string, guiaId: string): Guia {
    return new Guia(tenantId, guiaId, []);
  }

  static reconstruir(tenantId: string, guiaId: string, eventos: EventoDeEstado[]): Guia {
    return new Guia(tenantId, guiaId, [...eventos]);
  }

  eventos(): readonly EventoDeEstado[] {
    return this.historialEventos;
  }

  estadoActual(): EstadoGuia | null {
    const ultimo = this.historialEventos[this.historialEventos.length - 1];
    return ultimo ? ultimo.estado : null;
  }

  contieneEventoId(eventId: string): boolean {
    return this.historialEventos.some((e) => e.eventId === eventId);
  }

  registrarEvento(solicitud: SolicitudDeEvento): EventoDeEstado {
    const estadoActual = this.estadoActual();
    if (estadoActual !== null && !estadoActual.puedeTransicionarA(solicitud.estado)) {
      throw new TransicionInvalidaParaGuia(estadoActual.valor, solicitud.estado.valor);
    }
    const evento = EventoDeEstado.crear({
      eventId: solicitud.eventId,
      tenantId: this.tenantId,
      guiaId: this.guiaId,
      estado: solicitud.estado,
      fechaEvento: solicitud.fechaEvento,
      observacion: solicitud.observacion,
      fechaRegistro: solicitud.fechaRegistro,
    });
    this.historialEventos.push(evento);
    return evento;
  }
}

class TransicionInvalidaParaGuia extends ErrorNegocio {
  constructor(estadoActual: string, estadoSolicitado: string) {
    super(
      "INVALID_TRANSITION",
      409,
      `Guide in terminal status '${estadoActual}' cannot transition to '${estadoSolicitado}'`,
    );
  }
}
