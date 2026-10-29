import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { construirAppDePrueba } from "../../../support/app-de-prueba.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "33333333-3333-3333-3333-333333333333";
const GUIA = "22222222-2222-4444-8222-222222222222";

let app: Express;

beforeAll(() => {
  app = construirAppDePrueba().app;
});

describe("GET /v1/guides/:guiaId", () => {
  it("historial vacío para guía nunca vista: 404 GUIDE_NOT_FOUND", async () => {
    const res = await request(app).get(`/v1/guides/${GUIA}`).set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("GUIDE_NOT_FOUND");
  });

  it("devuelve estadoActual y eventos en cronológico tras dos estados (sin observación vacía)", async () => {
    const creada = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "0e0b0001-0000-4000-8000-000000000001",
        guiaId: GUIA,
        estado: "CREADA",
        fechaEvento: "2026-01-01T08:00:00.000Z",
      });
    const enRuta = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "0e0b0002-0000-4000-8000-000000000002",
        guiaId: GUIA,
        estado: "EN_RUTA",
        fechaEvento: "2026-01-02T09:00:00.000Z",
        observacion: "escaneo en cedi",
      });
    expect(creada.status).toBe(201);
    expect(enRuta.status).toBe(201);

    const res = await request(app).get(`/v1/guides/${GUIA}`).set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      guiaId: GUIA,
      estadoActual: "EN_RUTA",
      eventos: [
        { eventId: "0e0b0001-0000-4000-8000-000000000001", estado: "CREADA", fechaEvento: "2026-01-01T08:00:00.000Z" },
        { eventId: "0e0b0002-0000-4000-8000-000000000002", estado: "EN_RUTA", fechaEvento: "2026-01-02T09:00:00.000Z", observacion: "escaneo en cedi" },
      ],
    });
  });

  it("aislamiento estricto: otro tenant ve 404 para la misma guía", async () => {
    const res = await request(app).get(`/v1/guides/${GUIA}`).set("X-Tenant-Id", TENANT_B);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("GUIDE_NOT_FOUND");
  });

  it("guiaId no uuid: 400", async () => {
    const res = await request(app).get("/v1/guides/no-uuid").set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PAYLOAD");
  });
});

describe("PUT /v1/webhook", () => {
  it("configura el webhook y devuelve el secreto", async () => {
    const res = await request(app)
      .put("/v1/webhook")
      .set("X-Tenant-Id", TENANT)
      .send({ url: "https://clientes.ejemplo.com/hooks" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tenantId: TENANT,
      url: "https://clientes.ejemplo.com/hooks",
      webhookSecret: "secreto-de-prueba",
    });
  });

  it("URL no http(s): 400 INVALID_WEBHOOK_URL", async () => {
    const res = await request(app)
      .put("/v1/webhook")
      .set("X-Tenant-Id", TENANT)
      .send({ url: "ftp://mal.ejemplo.com/hook" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_WEBHOOK_URL");
  });
});

describe("GET /v1/notifications", () => {
  it("lista notificaciones del tenant con estados del outbox", async () => {
    await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "0e0b0003-0000-4000-8000-000000000003",
        guiaId: "55555555-5555-4444-8555-555555555555",
        estado: "EN_RUTA",
        fechaEvento: "2026-01-03T09:00:00.000Z",
      });

    const res = await request(app).get("/v1/notifications").set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      limite: 50,
      offset: 0,
      items: expect.arrayContaining([
        expect.objectContaining({
          eventoId: "0e0b0003-0000-4000-8000-000000000003",
          estado: "PENDING",
          intentos: 0,
          payload: expect.objectContaining({ estado: "EN_RUTA" }),
        }),
      ]),
    });
  });

  it("isolation: el listado del tenant B no contiene nada del tenant A", async () => {
    const resB = await request(app).get("/v1/notifications").set("X-Tenant-Id", TENANT_B);
    const resA = await request(app).get("/v1/notifications").set("X-Tenant-Id", TENANT);

    expect(resB.status).toBe(200);
    expect(resB.body.items.length).toBe(0);
    expect(resA.body.items.length).toBeGreaterThan(0);
  });
});
