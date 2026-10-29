import { z } from "zod";
import { ErrorNegocio } from "../../../domain/errors.js";

export const TenantHeadeRSChema = z.string().uuid();

export const EventoSchema = z.object({
  eventId: z.string().uuid(),
  guiaId: z.string().uuid(),
  estado: z.string().min(1),
  fechaEvento: z.string().datetime({ offset: true }),
  observacion: z.string().max(500).optional(),
});

export const ConfigWebhookSchema = z.object({
  url: z.string().max(2048),
});

export const GuiaParamsSchema = z.object({
  guiaId: z.string().uuid(),
});

export const FiltrosNotificacionesSchema = z.object({
  status: z.enum(["PENDING", "DELIVERED", "FAILED"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export function validar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const parsed = schema.safeParse(entrada);
  if (!parsed.success) {
    throw new ErrorNegocio(
      "INVALID_PAYLOAD",
      400,
      "Payload not valid",
      parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
    );
  }
  return parsed.data;
}

export type EventoPayload = z.infer<typeof EventoSchema>;
