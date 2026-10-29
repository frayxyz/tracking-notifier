import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { arrancarPostgresDePrueba, type PostgresDePrueba } from "../support/postgres.js";
import { GuiaRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/GuiaRepositoryDrizzle.js";
import { NotificacionRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/NotificacionRepositoryDrizzle.js";
import { ConfiguracionWebhookRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/ConfiguracionWebhookRepositoryDrizzle.js";
import { EventoDeEstado } from "../../../src/domain/guia/EventoDeEstado.js";
import { EstadoGuia } from "../../../src/domain/guia/EstadoGuia.js";
import { Notificacion } from "../../../src/domain/notificacion/Notificacion.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 120000 });

const TENANT = "11111111-1111-1111-1111-111111111111";
const GUIA = "22222222-2222-2222-2222-222222222222";
const EVENTO = "44444444-4444-4444-4444-444444444444";

function construirEvento(
  overrides: { tenantId?: string; eventId?: string; guiaId?: string; estado?: string } = {},
): EventoDeEstado {
  return EventoDeEstado.crear({
    tenantId: overrides.tenantId ?? TENANT,
    eventId: overrides.eventId ?? EVENTO,
    guiaId: overrides.guiaId ?? GUIA,
    estado: EstadoGuia.desde(overrides.estado ?? "CREADA"),
    fechaEvento: new Date("2026-01-01T08:00:00.000Z"),
    observacion: "recibida en bodega xalapa",
    fechaRegistro: new Date("2026-01-01T12:00:00.000Z"),
  });
}

let postgres: PostgresDePrueba;
let guiaRepo: GuiaRepositoryDrizzle;
let notificacionesRepo: NotificacionRepositoryDrizzle;
let webhooksRepo: ConfiguracionWebhookRepositoryDrizzle;

beforeAll(async () => {
  postgres = await arrancarPostgresDePrueba();
  guiaRepo = new GuiaRepositoryDrizzle(postgres.proveedor);
  notificacionesRepo = new NotificacionRepositoryDrizzle(postgres.proveedor);
  webhooksRepo = new ConfiguracionWebhookRepositoryDrizzle(postgres.proveedor);
});

afterAll(async () => {
  await postgres.cerrar();
});

describe("GuiaRepositoryDrizzle (PostgreSQL real)", () => {
  it("guarda y recupera el evento con sus datos de negocio intactos", async () => {
    await guiaRepo.guardar(construirEvento());

    const buscado = await guiaRepo.buscarEvento(TENANT, EVENTO);
    expect(buscado?.eventId).toBe(EVENTO);
    expect(buscado?.estado.valor).toBe("CREADA");
    expect(buscado?.observacion).toBe("recibida en bodega xalapa");

    const deGuia = await guiaRepo.eventosDeGuia(TENANT, GUIA);
    expect(deGuia).toHaveLength(1);
    expect(deGuia[0]!.fechaEvento.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("doble envío concurrente del mismo eventId persiste un solo evento (idempotencia en BD)", async () => {
    const evento = construirEvento({ eventId: "55555555-5555-4444-4444-555555555555" });
    await Promise.all([
      guiaRepo.guardar(evento),
      guiaRepo.guardar(evento),
      guiaRepo.guardar(evento),
    ]);

    const deGuia = await guiaRepo.eventosDeGuia(TENANT, GUIA);
    const duplicados = deGuia.filter(
      (e) => e.eventId === "55555555-5555-4444-4444-555555555555",
    );
    expect(duplicados).toHaveLength(1);
  });

  it("aislamiento por tenant: la misma guiaId vive separada por tenant", async () => {
    const tenantB = "99999999-9999-4444-4444-999999999999";
    await guiaRepo.guardar(construirEvento({ tenantId: tenantB, estado: "EN_RUTA" }));

    const delTenantA = await guiaRepo.eventosDeGuia(TENANT, GUIA);
    const delTenantB = await guiaRepo.eventosDeGuia(tenantB, GUIA);

    expect(delTenantA.every((e) => e.tenantId === TENANT)).toBe(true);
    expect(delTenantB).toHaveLength(1);
    expect(delTenantB[0]!.tenantId).toBe(tenantB);
  });
});

describe("NotificacionRepositoryDrizzle (PostgreSQL real)", () => {
  it("guarda la notificación PENDING con payload y la consulta por evento", async () => {
    const evento = construirEvento({ eventId: "66666666-6666-4444-4444-666666666666" });
    const noti = Notificacion.registrada(evento, new Date("2026-01-01T12:00:00.000Z"));
    await notificacionesRepo.guardar(noti);

    const leida = await notificacionesRepo.porEventoId(TENANT, "66666666-6666-4444-4444-666666666666");
    expect(leida?.estado).toBe("PENDING");
    expect(leida?.payload.estado).toBe("CREADA");
    expect(leida?.payload.observacion).toBe("recibida en bodega xalapa");
  });

  it("pendientes() devuelve solo notificaciones vencidas y en estado PENDING", async () => {
    const ahora = new Date("2026-01-01T13:00:00.000Z");
    const eventoVencida = construirEvento({ eventId: "77777777-7777-4444-4444-777777777777" });
    const vencida = Notificacion.registrada(eventoVencida, new Date("2026-01-01T12:00:00.000Z"));
    await notificacionesRepo.guardar(vencida);

    const pendientes = await notificacionesRepo.pendientes(50, ahora);
    expect(pendientes.some((n) => n.eventoId === "77777777-7777-4444-4444-777777777777")).toBe(true);
  });

  it("actualizar() persiste el nuevo estado y el error del último intento", async () => {
    const evento = construirEvento({ eventId: "88888888-8888-4444-4444-888888888888" });
    const noti = Notificacion.registrada(evento, new Date("2026-01-01T12:00:00.000Z"));
    await notificacionesRepo.guardar(noti);

    const fallida = noti.conEstado(
      "FAILED",
      5,
      new Date("2026-01-01T13:00:00.000Z"),
      "El webhook no respondió dentro del tiempo límite de 5000 ms",
    );
    await notificacionesRepo.actualizar(fallida);

    const leida = await notificacionesRepo.porEventoId(TENANT, "88888888-8888-4444-4444-888888888888");
    expect(leida?.estado).toBe("FAILED");
    expect(leida?.intentos).toBe(5);
    expect(leida?.ultimoError).toMatch(/5000 ms/);
  });
});

describe("ConfiguracionWebhookRepositoryDrizzle (PostgreSQL real)", () => {
  it("upsert: crea y reconfigura el webhook del tenant (rota secreto y URL)", async () => {
    await webhooksRepo.guardar({ tenantId: TENANT, url: "https://a.ejemplo.com/hook", secret: "s1" });
    await webhooksRepo.guardar({ tenantId: TENANT, url: "https://b.ejemplo.com/hook", secret: "s2" });

    const leida = await webhooksRepo.buscar(TENANT);
    expect(leida).toEqual({ tenantId: TENANT, url: "https://b.ejemplo.com/hook", secret: "s2" });
  });

  it("webhooks por tenant son independientes", async () => {
    const tenantC = "aaaa9999-9999-4444-4444-999999999999";
    await webhooksRepo.guardar({ tenantId: tenantC, url: "https://c.ejemplo.com/hook", secret: "s3" });
    const a = await webhooksRepo.buscar(TENANT);
    const c = await webhooksRepo.buscar(tenantC);
    expect(a?.url).toBe("https://b.ejemplo.com/hook");
    expect(c?.url).toBe("https://c.ejemplo.com/hook");
  });
});
