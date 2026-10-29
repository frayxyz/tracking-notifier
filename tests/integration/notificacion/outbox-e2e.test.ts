import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { arrancarPostgresDePrueba, type PostgresDePrueba } from "../support/postgres.js";
import { GuiaRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/GuiaRepositoryDrizzle.js";
import { NotificacionRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/NotificacionRepositoryDrizzle.js";
import { ConfiguracionWebhookRepositoryDrizzle } from "../../../src/infrastructure/persistence/repos/ConfiguracionWebhookRepositoryDrizzle.js";
import { RegistrarEventoDeEstadoUseCase } from "../../../src/application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import { DespacharNotificacionesPendientesUseCase } from "../../../src/application/use-cases/DespacharNotificacionesPendientesUseCase.js";
import { HttpWebhookDispatcher } from "../../../src/infrastructure/webhooks/HttpWebhookDispatcher.js";
import { TransaccionPostgres } from "../../../src/infrastructure/persistence/transaccion.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { RelojControlado } from "../../support/despachador-falso.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 120000 });

const TENANT = "11111111-1111-1111-1111-111111111111";
const GUIA = "22222222-4444-4222-8222-222222222222";

let postgres: PostgresDePrueba;
let registrar: RegistrarEventoDeEstadoUseCase;
let notificacionesRepo: NotificacionRepositoryDrizzle;
let webhooksRepo: ConfiguracionWebhookRepositoryDrizzle;
let servidor: Server;
let puerto = 0;
let ultimoCuerpo = "";
let ultimaFirma: string | null = null;

type Comportamiento = "ok" | "fallar" | "lento";
let comportamiento: Comportamiento = "ok";

beforeAll(async () => {
  postgres = await arrancarPostgresDePrueba();
  const guiaRepo = new GuiaRepositoryDrizzle(postgres.proveedor);
  notificacionesRepo = new NotificacionRepositoryDrizzle(postgres.proveedor);
  webhooksRepo = new ConfiguracionWebhookRepositoryDrizzle(postgres.proveedor);
  registrar = new RegistrarEventoDeEstadoUseCase(
    guiaRepo,
    notificacionesRepo,
    new TransaccionPostgres(postgres.proveedor),
    relojE2e,
  );

  servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    const trozos: Buffer[] = [];
    req.on("data", (t: Buffer) => trozos.push(t));
    req.on("end", () => {
      ultimoCuerpo = Buffer.concat(trozos).toString("utf8");
      ultimaFirma = (req.headers["x-signature"] as string | undefined) ?? null;
      if (comportamiento === "ok") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      if (comportamiento === "fallar") {
        res.writeHead(500);
        res.end("explode");
        return;
      }
      setTimeout(() => {
        res.writeHead(200);
        res.end("ok");
      }, 400);
    });
  });
  await new Promise<void>((resolver) => servidor.listen(0, () => resolver()));
  const dir = servidor.address();
  puerto = typeof dir === "object" && dir ? dir.port : 0;
});

let contadorEventos = 0;
const relojE2e = new RelojControlado();

async function registrarEventoPendiente(estado: string): Promise<string> {
  contadorEventos++;
  const resultado = await registrar.ejecutar({
    tenantId: TENANT,
    eventId: `00000000-0000-4000-8000-${String(contadorEventos).padStart(12, "0")}`,
    guiaId: crypto.randomUUID(),
    estado,
    fechaEvento: "2026-01-01T08:00:00.000Z",
    observacion: "flujo outbox e2e",
  });
  return resultado.eventoId;
}

afterAll(async () => {
  await new Promise<void>((resolver) => servidor.close(() => resolver()));
  await postgres.cerrar();
});

describe("RF3+RF4: ciclo de vida completo del outbox (PostgreSQL real + HTTP real)", () => {
  it("RF3 webhook configurado: el caso de uso la encuentra como la guardó", async () => {
    const url = `http://127.0.0.1:${puerto}/webhooks`;
    await webhooksRepo.guardar({ tenantId: TENANT, url, secret: "secreto-e2e" });

    const config = await webhooksRepo.buscar(TENANT);
    expect(config?.url).toBe(url);
    expect(config?.secret).toBe("secreto-e2e");
  });

  it("RF4 entrega feliz: evento aceptado → PENDING en BD → worker → POST firmado → DELIVERED consultable", async () => {
    const eventoId = await registrarEventoPendiente("CREADA");

    const pendiente = await notificacionesRepo.porEventoId(TENANT, eventoId);
    expect(pendiente?.estado).toBe("PENDING");

    const worker = new DespacharNotificacionesPendientesUseCase(
      notificacionesRepo,
      webhooksRepo,
      new HttpWebhookDispatcher({ timeoutMs: 5000, firmaHmacActiva: true }),
      relojE2e,
      { tamanoLote: 10, maxIntentos: 5, backoffBaseMs: 1000 },
    );
    const resumen = await worker.ejecutar();

    expect(resumen.entregadas).toBe(1);
    const entregada = await notificacionesRepo.porEventoId(TENANT, eventoId);
    expect(entregada?.estado).toBe("DELIVERED");
    expect(entregada?.intentos).toBe(1);
    expect(entregada?.entregadoEn).toBeTruthy();

    expect(ultimoCuerpo).toContain(eventoId);
    expect(ultimoCuerpo).toContain("CREADA");
    const firmaEsperada = `sha256=${createHmac("sha256", "secreto-e2e").update(ultimoCuerpo).digest("hex")}`;
    expect(ultimaFirma).toBe(firmaEsperada);

    const entregadas = await notificacionesRepo.listar({
      tenantId: TENANT,
      estado: "DELIVERED",
      limite: 50,
      offset: 0,
    });
    expect(entregadas.some((n) => n.eventoId === eventoId)).toBe(true);
  });

  it("RF4 fallo del webhook: 5 intentos con backoff en BD real → FAILED consultable", async () => {
    comportamiento = "fallar";
    await webhooksRepo.guardar({
      tenantId: TENANT,
      url: `http://127.0.0.1:${puerto}/fail`,
      secret: "secreto-e2e",
    });
    const eventoId = await registrarEventoPendiente("EN_RUTA");

    const worker = new DespacharNotificacionesPendientesUseCase(
      notificacionesRepo,
      webhooksRepo,
      new HttpWebhookDispatcher({ timeoutMs: 5000, firmaHmacActiva: true }),
      relojE2e,
      { tamanoLote: 10, maxIntentos: 5, backoffBaseMs: 1000 },
    );

    for (let i = 0; i < 5; i++) {
      await worker.ejecutar();
      relojE2e.avanzar(32000);
    }

    const fallida = await notificacionesRepo.porEventoId(TENANT, eventoId);
    expect(fallida?.estado).toBe("FAILED");
    expect(fallida?.intentos).toBe(5);
    expect(fallida?.ultimoError).toContain("500");

    const consultable = await notificacionesRepo.listar({
      tenantId: TENANT,
      estado: "FAILED",
      limite: 50,
      offset: 0,
    });
    expect(consultable.some((n) => n.eventoId === eventoId)).toBe(true);

    comportamiento = "ok";
  });

  it("RF4 timeout del webhook (no responde en tiempo configurado) cuesta un intento", async () => {
    comportamiento = "lento";
    const eventoId = await registrarEventoPendiente("CREADA");

    const worker = new DespacharNotificacionesPendientesUseCase(
      notificacionesRepo,
      webhooksRepo,
      new HttpWebhookDispatcher({ timeoutMs: 100, firmaHmacActiva: true }),
      relojE2e,
      { tamanoLote: 10, maxIntentos: 5, backoffBaseMs: 1000 },
    );
    const resumen = await worker.ejecutar();

    expect(resumen.reintentando).toBe(1);
    const reprogramada = await notificacionesRepo.porEventoId(TENANT, eventoId);
    expect(reprogramada?.estado).toBe("PENDING");
    expect(reprogramada?.intentos).toBe(1);
    expect(reprogramada?.ultimoError).toMatch(/tiempo límite/i);

    comportamiento = "ok";
  });

  it("RF4 tenant sin webhook: FAILED con error descriptivo", async () => {
    const tenantHuerfano = "99999999-9999-4999-8999-999999999999";
    const resultado = await registrar.ejecutar({
      tenantId: tenantHuerfano,
      eventId: "00000000-0000-4000-8000-999999999001",
      guiaId: GUIA,
      estado: "CREADA",
      fechaEvento: "2026-01-01T08:00:00.000Z",
    });

    const worker = new DespacharNotificacionesPendientesUseCase(
      notificacionesRepo,
      webhooksRepo,
      new HttpWebhookDispatcher({ timeoutMs: 5000, firmaHmacActiva: true }),
      relojE2e,
      { tamanoLote: 10, maxIntentos: 5, backoffBaseMs: 1000 },
    );
    await worker.ejecutar();

    const fallida = await notificacionesRepo.porEventoId(tenantHuerfano, resultado.eventoId);
    expect(fallida?.estado).toBe("FAILED");
    expect(fallida?.ultimoError).toMatch(/webhook/i);
  });
});
