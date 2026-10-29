import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigserial,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventosDeEstado = pgTable(
  "eventos_de_estado",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    eventId: uuid("event_id").notNull(),
    guiaId: uuid("guia_id").notNull(),
    estado: text("estado").notNull(),
    fechaEvento: timestamp("fecha_evento", { withTimezone: true }).notNull(),
    observacion: text("observacion"),
    fechaRegistro: timestamp("fecha_registro", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("eventos_idempotencia_idx").on(t.tenantId, t.eventId),
    index("eventos_historial_idx").on(t.tenantId, t.guiaId, t.fechaEvento),
  ],
);

export const notificaciones = pgTable(
  "notificaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    eventoId: uuid("evento_id").notNull(),
    guiaId: uuid("guia_id").notNull(),
    payload: jsonb("payload").notNull(),
    estado: text("estado").notNull().default("PENDING"),
    intentos: integer("intentos").notNull().default(0),
    proximoIntentoEn: timestamp("proximo_intento_en", { withTimezone: true }).notNull(),
    entregadoEn: timestamp("entregado_en", { withTimezone: true }),
    ultimoError: text("ultimo_error"),
  },
  (t) => [
    uniqueIndex("noti_evento_idx").on(t.tenantId, t.eventoId),
    index("noti_pendientes_idx").on(t.estado, t.proximoIntentoEn),
  ],
);

export const configuracionesWebhook = pgTable("configuraciones_webhook", {
  tenantId: uuid("tenant_id").primaryKey(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
