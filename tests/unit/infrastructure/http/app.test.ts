import { describe, expect, it } from "vitest";
import { createApp } from "../../../../src/infrastructure/http/app.js";
import { createLoggerStub } from "../../../support/logger-stub.js";
import request from "supertest";

describe("healthz", () => {
  it("responde 200 con estado ok", async () => {
    const app = createApp(createLoggerStub());
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("formato de error único", () => {
  it("ruta inexistente responde 404 con { error: { code, message, details } }", async () => {
    const app = createApp(createLoggerStub());
    const res = await request(app).get("/inexistente");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found", details: [] },
    });
  });

  it("body JSON inválido responde 400 INVALID_BODY", async () => {
    const app = createApp(createLoggerStub());
    const res = await request(app)
      .post("/loquesea")
      .set("Content-Type", "application/json")
      .send("{malformado");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
  });
});
