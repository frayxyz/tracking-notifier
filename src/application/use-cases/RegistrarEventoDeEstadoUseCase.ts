import { EstadoGuia } from "../../domain/guia/EstadoGuia.js";
import type { EventoDeEstado } from "../../domain/guia/EventoDeEstado.js";
import { Guia } from "../../domain/guia/Guia.js";
import { Notificacion } from "../../domain/notificacion/Notificacion.js";
import type { GuiaRepository } from "../../domain/ports/GuiaRepository.js";
import type { NotificacionRepository } from "../../domain/ports/NotificacionRepository.js";
import type { Reloj } from "../../domain/ports/Reloj.js";
import type { Transaccion } from "../../domain/ports/Transaccion.js";

export interface ComandoRegistrarEvento {
  tenantId: string;
  eventId: string;
  guiaId: string;
  estado: string;
  fechaEvento: string;
  observacion?: string;
}

export type ResultadoRegistro = {
  estado: "ACEPTADO" | "DUPLICADO";
  eventoId: string;
  guiaId: string;
  estadoActual: string | null;
  resourceId: string;
};

export class RegistrarEventoDeEstadoUseCase {
  constructor(
    private readonly guiaRepository: GuiaRepository,
    private readonly notificacionRepository: NotificacionRepository,
    private readonly transaccion: Transaccion,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: ComandoRegistrarEvento): Promise<ResultadoRegistro> {
    const existente = await this.guiaRepository.buscarEvento(comando.tenantId, comando.eventId);
    if (existente) {
      return resultado("DUPLICADO", existente);
    }

    const eventosPrevios = await this.guiaRepository.eventosDeGuia(
      comando.tenantId,
      comando.guiaId,
    );
    const guia = Guia.reconstruir(comando.tenantId, comando.guiaId, eventosPrevios);
    const evento = guia.registrarEvento({
      eventId: comando.eventId,
      estado: EstadoGuia.desde(comando.estado),
      fechaEvento: new Date(comando.fechaEvento),
      observacion: comando.observacion,
      fechaRegistro: this.reloj.ahora(),
    });

    await this.transaccion.ejecutar(async () => {
      await this.guiaRepository.guardar(evento);
      await this.notificacionRepository.guardar(Notificacion.registrada(evento, evento.fechaRegistro));
    });

    return resultado("ACEPTADO", evento);
  }
}

function resultado(estado: "ACEPTADO" | "DUPLICADO", evento: EventoDeEstado): ResultadoRegistro {
  return {
    estado,
    eventoId: evento.eventId,
    guiaId: evento.guiaId,
    estadoActual: evento.estado.valor,
    resourceId: evento.eventId,
  };
}
