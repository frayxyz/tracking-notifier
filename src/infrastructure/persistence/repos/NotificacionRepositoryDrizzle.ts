import { and, asc, eq, lte } from "drizzle-orm";
import {
  Notificacion,
  type EstadoNotificacion,
  type PayloadWebhook,
} from "../../../domain/notificacion/Notificacion.js";
import type { NotificacionRepository } from "../../../domain/ports/NotificacionRepository.js";
import { notificaciones } from "../schema.js";
import type { ProveedorDeDb } from "../proveedor-db.js";

export class NotificacionRepositoryDrizzle implements NotificacionRepository {
  constructor(private readonly proveedor: ProveedorDeDb) {}

  async guardar(notificacion: Notificacion): Promise<void> {
    await this.proveedor.obtener().insert(notificaciones).values(mapearFila(notificacion)).onConflictDoNothing();
  }

  async actualizar(notificacion: Notificacion): Promise<void> {
    await this.proveedor.obtener()
      .update(notificaciones)
      .set(mapearFila(notificacion))
      .where(
        and(
          eq(notificaciones.tenantId, notificacion.tenantId),
          eq(notificaciones.eventoId, notificacion.eventoId),
        ),
      );
  }

  async porEventoId(tenantId: string, eventoId: string): Promise<Notificacion | null> {
    const rows = await this.proveedor.obtener()
      .select()
      .from(notificaciones)
      .where(and(eq(notificaciones.tenantId, tenantId), eq(notificaciones.eventoId, eventoId)))
      .limit(1);
    return rows[0] ? mapearEntidad(rows[0]) : null;
  }

  async pendientes(limite: number, ahora: Date): Promise<Notificacion[]> {
    const rows = await this.proveedor.obtener()
      .select()
      .from(notificaciones)
      .where(and(eq(notificaciones.estado, "PENDING"), lte(notificaciones.proximoIntentoEn, ahora)))
      .limit(limite);
    return rows.map(mapearEntidad);
  }

  async listar(filtro: {
    tenantId?: string;
    estado?: EstadoNotificacion;
    limite: number;
    offset: number;
  }): Promise<Notificacion[]> {
    const condiciones = [];
    if (filtro.tenantId) condiciones.push(eq(notificaciones.tenantId, filtro.tenantId));
    if (filtro.estado) condiciones.push(eq(notificaciones.estado, filtro.estado));
    const rows = await this.proveedor.obtener()
      .select()
      .from(notificaciones)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(asc(notificaciones.eventoId))
      .limit(filtro.limite)
      .offset(filtro.offset);
    return rows.map(mapearEntidad);
  }
}

function mapearFila(n: Notificacion) {
  return {
    tenantId: n.tenantId,
    eventoId: n.eventoId,
    guiaId: n.guiaId,
    payload: n.payload,
    estado: n.estado,
    intentos: n.intentos,
    proximoIntentoEn: n.proximoIntentoEn,
    entregadoEn: n.entregadoEn,
    ultimoError: n.ultimoError,
  };
}

function mapearEntidad(row: {
  tenantId: string;
  eventoId: string;
  guiaId: string;
  payload: unknown;
  estado: string;
  intentos: number;
  proximoIntentoEn: Date;
  entregadoEn: Date | null;
  ultimoError: string | null;
}): Notificacion {
  return Notificacion.reconstruir(
    row.eventoId,
    row.tenantId,
    row.guiaId,
    row.payload as PayloadWebhook,
    row.estado as EstadoNotificacion,
    row.intentos,
    new Date(row.proximoIntentoEn),
    row.entregadoEn ? new Date(row.entregadoEn) : null,
    row.ultimoError,
  );
}
