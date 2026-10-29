import { describe, expect, it } from "vitest";
import request from "supertest";
import { construirAppDePrueba } from "../../../support/app-de-prueba.js";

describe("app base HTTP", () => {
  it("healthz responde 200 ok", async () => {
    const { app } = construirAppDePrueba();
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("ruta inexistente: 404 con formato de error único", async () => {
    const { app } = construirAppDePrueba();
    const res = await request(app).get("/inexistente");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found", details: [] },
    });
  });

  it("body JSON inválido: 400 INVALID_BODY", async () => {
    const { app } = construirAppDePrueba();
    const res = await request(app)
      .post("/v1/events")
      .set("Content-Type", "application/json")
      .send("{malformado");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
  });

  it("openapi.json expone el contrato de la API", async () => {
    const { app } = construirAppDePrueba();
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(["/v1/events", "/v1/guides/{guiaId}", "/v1/webhook", "/v1/notifications"]),
    );
  });

  it("Swagger UI montado en /docs sirve HTML interactivo", async () => {
    const { app } = construirAppDePrueba();
    const res = await request(app).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
