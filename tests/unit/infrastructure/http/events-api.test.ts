import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { construirAppDePrueba } from "../../../support/app-de-prueba.js";
import type {
  RepositorioDeEventosEnMemoria,
  RepositorioDeNotificacionesEnMemoria,
} from "../../../support/adaptadores-memoria.js";

const TENANT = "11111111-1111-1111-1111-111111111111";

let app: Express;
let notificaciones: RepositorioDeNotificacionesEnMemoria;
let eventos: RepositorioDeEventosEnMemoria;

beforeAll(() => {
  const construida = construirAppDePrueba();
  app = construida.app;
  notificaciones = construida.notificaciones;
  eventos = construida.eventos;
});

describe("POST /v1/events", () => {
  it("201 con evento nuevo, formato { estado: 'ACEPTADO', eventoId }", async () => {
    const res = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "11119999-0001-4b2b-8ccc-dddddddddddd",
        guiaId: "22222222-2222-2222-2222-222222222222",
        estado: "CREADA",
        fechaEvento: "2026-01-01T08:00:00.000Z",
        observacion: "en bodega",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      estado: "ACEPTADO",
      eventoId: "11119999-0001-4b2b-8ccc-dddddddddddd",
      guiaId: "22222222-2222-2222-2222-222222222222",
      estadoActual: "CREADA",
      resourceId: "11119999-0001-4b2b-8ccc-dddddddddddd",
    });
  });

  it("200 idempotente si el mismo eventId se reenvía (no duplica ni notifica doble)", async () => {
    const payload = {
      eventId: "11119999-0002-4b2b-8ccc-dddddddddddd",
      guiaId: "22222222-2222-2222-2222-222222222222",
      estado: "EN_RUTA",
      fechaEvento: "2026-01-01T09:00:00.000Z",
    };
    const primera = await request(app).post("/v1/events").set("X-Tenant-Id", TENANT).send(payload);
    const segunda = await request(app).post("/v1/events").set("X-Tenant-Id", TENANT).send(payload);

    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.body.estado).toBe("DUPLICADO");
    expect(notificaciones.cantidad()).toBe(2);
  });

  it("409 transición inválida con formato de error único", async () => {
    const entrega = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "11119999-0003-4b2b-8ccc-dddddddddddd",
        guiaId: "44444444-4444-4444-4444-444444444444",
        estado: "ENTREGADA",
        fechaEvento: "2026-01-01T10:00:00.000Z",
      });
    expect(entrega.status).toBe(201);

    const reenviado = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "11119999-0004-4b2b-8ccc-dddddddddddd",
        guiaId: "44444444-4444-4444-4444-444444444444",
        estado: "EN_RUTA",
        fechaEvento: "2026-01-01T10:30:00.000Z",
      });
    expect(reenviado.status).toBe(409);
    expect(reenviado.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("400 cuando falta X-Tenant-Id o no es UUID", async () => {
    const sinHeader = await request(app).post("/v1/events").send({ eventId: "x" });
    expect(sinHeader.status).toBe(400);
    expect(sinHeader.body.error.code).toBe("INVALID_TENANT");

    const headerFeo = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", "no-es-uuid")
      .send({ eventId: "x" });
    expect(headerFeo.status).toBe(400);
    expect(headerFeo.body.error.code).toBe("INVALID_TENANT");
  });

  it("400 cuando el payload no cumple el contrato (evento incompleto)", async () => {
    const res = await request(app).post("/v1/events").set("X-Tenant-Id", TENANT).send({
      eventId: "11119999-0005-4b2b-8ccc-dddddddddddd",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PAYLOAD");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("400 cuando estado no pertenece al negocio", async () => {
    const res = await request(app)
      .post("/v1/events")
      .set("X-Tenant-Id", TENANT)
      .send({
        eventId: "11119999-0006-4b2b-8ccc-dddddddddddd",
        guiaId: "22222222-2222-2222-2222-222222222222",
        estado: "VOLADA",
        fechaEvento: "2026-01-01T11:00:00.000Z",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS");
  });
});
