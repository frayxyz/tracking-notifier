import type { OpenAPIV3 } from "openapi-types";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EventoSchema, ConfigWebhookSchema, FiltrosNotificacionesSchema } from "../dtos/esquemas.js";

type DocumentoOpenApi = OpenAPIV3.Document;

const SCHEMA_EVENTO = zodToJsonSchema(EventoSchema, { target: "openApi3" }) as never;
const SCHEMA_WEBHOOK = zodToJsonSchema(ConfigWebhookSchema, { target: "openApi3" }) as never;
const SCHEMA_NOTIS = zodToJsonSchema(FiltrosNotificacionesSchema, {
  target: "openApi3",
}) as never;

export function construirOpenApiDocument(): DocumentoOpenApi {
  return {
    openapi: "3.0.3",
    info: {
      title: "tracking-notifier",
      version: "0.1.0",
      description:
        "Microservicio multi-tenant que registra cambios de estado de guías y notifica a los webhooks de cada cliente con reintentos idempotentes.",
    },
    servers: [{ url: "/", description: "root" }],
    tags: [
      { name: "eventos" },
      { name: "guias" },
      { name: "webhooks" },
      { name: "notificaciones" },
      { name: "operaciones" },
    ],
    components: {
      securitySchemes: {
        TenantHeader: { type: "apiKey", in: "header", name: "X-Tenant-Id" },
      },
      schemas: {
        EventoDeEstadoEntrada: SCHEMA_EVENTO as never,
        ConfiguracionWebhookEntrada: SCHEMA_WEBHOOK as never,
        ResultadoRegistro: respuestaRegistroSchema() as never,
        HistorialDeGuia: historialSchema() as never,
        NotificacionListado: listadoNotificacionesSchema() as never,
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "INVALID_TRANSITION" },
                message: { type: "string" },
                details: { type: "array", items: {} },
              },
            },
          },
        },
      },
    },
    paths: {
      "/healthz": {
        get: {
          tags: ["operaciones"],
          summary: "Health check del servicio",
          responses: { "200": { description: "Servicio operativo" } },
        },
      },
      "/metrics": {
        get: {
          tags: ["operaciones"],
          summary: "Métricas Prometheus (http_requests, notificaciones, intentos de webhook)",
          responses: {
            "200": {
              description: " exposition text/plain formato Prometheus",
              content: { "text/plain": { schema: { type: "string" } } },
            },
          },
        },
      },
      "/docs": {
        get: {
          tags: ["operaciones"],
          summary: "Swagger UI interactivo (esta misma especificación)",
          responses: { "200": { description: "HTML de Swagger UI" } },
        },
      },
      "/v1/events": {
        post: {
          tags: ["eventos"],
          summary: "Registra un evento de cambio de estado de una guía (idempotente por eventId)",
          security: [{ TenantHeader: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EventoDeEstadoEntrada" },
              },
            },
          },
          responses: {
            "201": {
              description: "Evento aceptado",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ResultadoRegistro" },
                },
              },
            },
            "200": {
              description: "Evento duplicado (idempotencia, sin nueva notificación)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ResultadoRegistro" },
                },
              },
            },
            "400": referenciaError("INVALID_PAYLOAD / INVALID_STATUS / INVALID_TENANT"),
            "409": referenciaError("INVALID_TRANSITION"),
          },
        },
      },
      "/v1/guides/{guiaId}": {
        get: {
          tags: ["guias"],
          summary: "Historial de la guía para el tenant de la cabecera",
          security: [{ TenantHeader: [] }],
          parameters: [
            {
              name: "guiaId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "Estado actual y eventos en orden cronológico",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/HistorialDeGuia" } },
              },
            },
            "404": referenciaError("GUIDE_NOT_FOUND"),
          },
        },
      },
      "/v1/webhook": {
        put: {
          tags: ["webhooks"],
          summary: "Configura (upsert) la URL del webhook del tenant; rota el secreto",
          security: [{ TenantHeader: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConfiguracionWebhookEntrada" },
              },
            },
          },
          responses: {
            "200": {
              description: "Configuración almacenada (devuelve el secreto para el cliente)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["tenantId", "url", "webhookSecret"],
                    properties: {
                      tenantId: { type: "string", format: "uuid" },
                      url: { type: "string", format: "uri" },
                      webhookSecret: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": referenciaError("INVALID_WEBHOOK_URL / INVALID_PAYLOAD"),
          },
        },
      },
      "/v1/notifications": {
        get: {
          tags: ["notificaciones"],
          summary: "Consulta el estado de las notificaciones del tenant (outbox)",
          security: [{ TenantHeader: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["PENDING", "DELIVERED", "FAILED"] },
            },
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Listado paginado de notificaciones",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NotificacionListado" },
                },
              },
            },
            "400": referenciaError("INVALID_PAYLOAD"),
          },
        },
      },
    },
  };
}

function referenciaError(codes: string): OpenAPIV3.ResponseObject {
  return {
    description: `Error del contrato (${codes})`,
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  };
}

function respuestaRegistroSchema(): unknown {
  return {
    type: "object",
    required: ["estado", "eventoId", "guiaId", "resourceId"],
    properties: {
      estado: { type: "string", enum: ["ACEPTADO", "DUPLICADO"] },
      eventoId: { type: "string", format: "uuid" },
      guiaId: { type: "string", format: "uuid" },
      estadoActual: { type: "string", maxLength: 20, nullable: true },
      resourceId: { type: "string" },
    },
  };
}

function historialSchema(): unknown {
  return {
    type: "object",
    required: ["guiaId", "estadoActual", "eventos"],
    properties: {
      guiaId: { type: "string", format: "uuid" },
      estadoActual: { type: "string", maxLength: 20 },
      eventos: {
        type: "array",
        items: {
          type: "object",
          required: ["eventId", "estado", "fechaEvento"],
          properties: {
            eventId: { type: "string", format: "uuid" },
            estado: {
              type: "string",
              enum: ["CREADA", "EN_RUTA", "ENTREGADA", "DEVUELTA"],
            },
            fechaEvento: { type: "string", format: "date-time" },
            observacion: { type: "string", nullable: true },
          },
        },
      },
    },
  };
}

function listadoNotificacionesSchema(): unknown {
  return {
    type: "object",
    required: ["items", "limite", "offset"],
    properties: {
      limite: { type: "integer" },
      offset: { type: "integer" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            eventoId: { type: "string", format: "uuid" },
            guiaId: { type: "string", format: "uuid" },
            estado: { type: "string", enum: ["PENDING", "DELIVERED", "FAILED"] },
            intentos: { type: "integer" },
            proximoIntentoEn: { type: "string", format: "date-time" },
            entregadoEn: { type: "string", format: "date-time", nullable: true },
            ultimoError: { type: "string", nullable: true },
          },
        },
      },
    },
  };
}
