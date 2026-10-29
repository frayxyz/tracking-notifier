CREATE TABLE IF NOT EXISTS "configuraciones_webhook" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eventos_de_estado" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"guia_id" uuid NOT NULL,
	"estado" text NOT NULL,
	"fecha_evento" timestamp with time zone NOT NULL,
	"observacion" text,
	"fecha_registro" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"evento_id" uuid NOT NULL,
	"guia_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"estado" text DEFAULT 'PENDING' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"proximo_intento_en" timestamp with time zone NOT NULL,
	"entregado_en" timestamp with time zone,
	"ultimo_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"webhook_url" text,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eventos_idempotencia_idx" ON "eventos_de_estado" USING btree ("tenant_id","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eventos_historial_idx" ON "eventos_de_estado" USING btree ("tenant_id","guia_id","fecha_evento");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "noti_evento_idx" ON "notificaciones" USING btree ("tenant_id","evento_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "noti_pendientes_idx" ON "notificaciones" USING btree ("estado","proximo_intento_en");