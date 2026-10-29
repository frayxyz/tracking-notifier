import { ErrorNegocio } from "../errors.js";
import { EstadoGuia } from "./EstadoGuia.js";
import { EventoDeEstado } from "./EventoDeEstado.js";
import { ordenarEventosCronologicamente } from "./orden-cronologico.js";

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
    private historialEventos: EventoDeEstado[],
  ) {}

  static vacia(tenantId: string, guiaId: string): Guia {
    return new Guia(tenantId, guiaId, []);
  }

  static reconstruir(tenantId: string, guiaId: string, eventos: EventoDeEstado[]): Guia {
    return new Guia(tenantId, guiaId, ordenarEventosCronologicamente(eventos));
  }

  eventos(): readonly EventoDeEstado[] {
    return this.historialEventos;
  }

  /**
   * Estado vigente = el del evento con mayor fechaEvento
   * (desempate por fechaRegistro), no el último recibido.
   */
  estadoActual(): EstadoGuia | null {
    const ultimo = this.historialEventos[this.historialEventos.length - 1];
    return ultimo ? ultimo.estado : null;
  }

  contieneEventoId(eventId: string): boolean {
    return this.historialEventos.some((e) => e.eventId === eventId);
  }

  registrarEvento(solicitud: SolicitudDeEvento): EventoDeEstado {
    const vigenteEvento = this.historialEventos[this.historialEventos.length - 1] ?? null;

    if (vigenteEvento?.estado.esTerminal()) {
      throw new TransicionInvalidaParaGuia(vigenteEvento.estado.valor, solicitud.estado.valor);
    }

    const fechaEntrante = new Date(solicitud.fechaEvento);
    if (vigenteEvento) {
      if (fechaEntrante.getTime() < vigenteEvento.fechaEvento.getTime()) {
        this.validarInsercionHistorica(solicitud, this.historialEventos);
      } else if (!vigenteEvento.estado.puedeTransicionarA(solicitud.estado)) {
        throw new RegresionInvalidaParaGuia(vigenteEvento.estado.valor, solicitud.estado.valor);
      }
    }

    const evento = EventoDeEstado.crear({
      eventId: solicitud.eventId,
      tenantId: this.tenantId,
      guiaId: this.guiaId,
      estado: solicitud.estado,
      fechaEvento: fechaEntrante,
      observacion: solicitud.observacion,
      fechaRegistro: solicitud.fechaRegistro,
    });
    this.historialEventos = ordenarEventosCronologicamente([...this.historialEventos, evento]);
    return evento;
  }

  private validarInsercionHistorica(solicitud: SolicitudDeEvento, ordenados: EventoDeEstado[]): void {
    const fechaEntrante = new Date(solicitud.fechaEvento).getTime();
    const siguiente = ordenados.find((e) => e.fechaEvento.getTime() > fechaEntrante);
    if (siguiente && !solicitud.estado.puedeTransicionarA(siguiente.estado)) {
      throw new EventoTardioIncoherente(
        solicitud.estado.valor,
        siguiente.estado.valor,
        siguiente.fechaEvento,
      );
    }
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

class RegresionInvalidaParaGuia extends ErrorNegocio {
  constructor(estadoActual: string, estadoSolicitado: string) {
    super(
      "INVALID_TRANSITION",
      409,
      `Guide in state '${estadoActual}' cannot go back to '${estadoSolicitado}'`,
    );
  }
}

class EventoTardioIncoherente extends ErrorNegocio {
  constructor(estadoTardio: string, estadoSiguiente: string, fechaSiguiente: Date) {
    super(
      "INVALID_TRANSITION",
      409,
      `Late event is not coherent: state '${estadoTardio}' cannot precede '${estadoSiguiente}' (fechaEvento ${fechaSiguiente.toISOString()})`,
    );
  }
}
