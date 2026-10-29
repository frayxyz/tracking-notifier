import type { Notificacion } from "../notificacion/Notificacion.js";

export interface NotificacionRepository {
  guardar(notificacion: Notificacion): Promise<void>;
}
