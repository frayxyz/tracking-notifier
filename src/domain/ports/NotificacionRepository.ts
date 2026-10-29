import type { EstadoNotificacion, Notificacion } from "../notificacion/Notificacion.js";

export interface NotificacionRepository {
  guardar(notificacion: Notificacion): Promise<void>;
  actualizar(notificacion: Notificacion): Promise<void>;
  porEventoId(tenantId: string, eventoId: string): Promise<Notificacion | null>;
  pendientes(limite: number, ahora: Date): Promise<Notificacion[]>;
  listar(filtro: {
    tenantId?: string;
    estado?: EstadoNotificacion;
    limite: number;
    offset: number;
  }): Promise<Notificacion[]>;
}
