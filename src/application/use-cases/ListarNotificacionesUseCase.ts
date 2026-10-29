import type {
  EstadoNotificacion,
  PayloadWebhook,
} from "../../domain/notificacion/Notificacion.js";
import type { NotificacionRepository } from "../../domain/ports/NotificacionRepository.js";

export interface ConsultaNotificaciones {
  tenantId: string;
  estado?: EstadoNotificacion;
  limite: number;
  offset: number;
}

export interface NotificacionResumen {
  eventoId: string;
  guiaId: string;
  estado: EstadoNotificacion;
  intentos: number;
  proximoIntentoEn: string;
  entregadoEn: string | null;
  ultimoError: string | null;
  payload: PayloadWebhook;
}

export interface ResultadoListadoNotificaciones {
  items: NotificacionResumen[];
  limite: number;
  offset: number;
}

export class ListarNotificacionesUseCase {
  constructor(private readonly notificacionRepository: NotificacionRepository) {}

  async ejecutar(consulta: ConsultaNotificaciones): Promise<ResultadoListadoNotificaciones> {
    const notificaciones = await this.notificacionRepository.listar({
      tenantId: consulta.tenantId,
      estado: consulta.estado,
      limite: consulta.limite,
      offset: consulta.offset,
    });
    return {
      limite: consulta.limite,
      offset: consulta.offset,
      items: notificaciones.map((n) => ({
        eventoId: n.eventoId,
        guiaId: n.guiaId,
        estado: n.estado,
        intentos: n.intentos,
        proximoIntentoEn: n.proximoIntentoEn.toISOString(),
        entregadoEn: n.entregadoEn ? n.entregadoEn.toISOString() : null,
        ultimoError: n.ultimoError,
        payload: n.payload,
      })),
    };
  }
}
