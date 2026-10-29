import { describe, expect, it } from "vitest";
import { DespacharNotificacionesPendientesUseCase } from "../../../../src/application/use-cases/DespacharNotificacionesPendientesUseCase.js";
import { RelojControlado, DespachadorFalso } from "../../../support/despachador-falso.js";
import {
  RelojFijo,
  RepositorioDeEventosEnMemoria,
  RepositorioDeNotificacionesEnMemoria,
  TransaccionEnMemoria,
} from "../../../support/adaptadores-memoria.js";
import { RegistrarEventoDeEstadoUseCase } from "../../../../src/application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import { RepositorioDeConfiguracionWebhookEnMemoria } from "../../../support/repositorio-webhook-memoria.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const GUIA = "22222222-2222-2222-2222-222222222222";
const CONFIG_WORKER = { tamanoLote: 10, maxIntentos: 5, backoffBaseMs: 1000 };

let contadorEventos = 0;
function siguienteEventoId(): string {
  contadorEventos++;
  return `00000000-0000-4000-8000-${String(contadorEventos).padStart(12, "0")}`;
}

async function casoBase(estado: string) {
  const webhooks = new RepositorioDeConfiguracionWebhookEnMemoria();
  await webhooks.guardar({
    tenantId: TENANT,
    url: "https://clientes.ejemplo.com/webhooks",
    secret: "secreto-compartido",
  });
  const notificaciones = new RepositorioDeNotificacionesEnMemoria();
  const registrar = new RegistrarEventoDeEstadoUseCase(
    new RepositorioDeEventosEnMemoria(),
    notificaciones,
    TransaccionEnMemoria,
    RelojFijo,
  );
  const resultado = await registrar.ejecutar({
    tenantId: TENANT,
    eventId: siguienteEventoId(),
    guiaId: GUIA,
    estado,
    fechaEvento: "2026-01-01T09:00:00.000Z",
  });
  return { webhooks, notificaciones, resultado };
}

describe("DespacharNotificacionesPendientesUseCase", () => {
  it("entrega al webhook del tenant y marca DELIVERED", async () => {
    const { webhooks, notificaciones, resultado } = await casoBase("CREADA");
    const despachador = new DespachadorFalso([{ exito: true, httpStatus: 200 }]);
    const worker = new DespacharNotificacionesPendientesUseCase(
      notificaciones,
      webhooks,
      despachador,
      new RelojControlado(),
      CONFIG_WORKER,
    );

    const resumen = await worker.ejecutar();

    expect(resumen).toEqual({ procesadas: 1, entregadas: 1, reintentando: 0, fallidas: 0, sinWebhook: 0 });
    const noti = await notificaciones.porEventoId(TENANT, resultado.eventoId);
    expect(noti?.estado).toBe("DELIVERED");
    expect(noti?.intentos).toBe(1);
    expect(despachador.llamadas[0]!.url).toBe("https://clientes.ejemplo.com/webhooks");
  });

  it("fallo del webhook: reprograma con espera creciente (1s) y guarda el error", async () => {
    const { webhooks, notificaciones, resultado } = await casoBase("EN_RUTA");
    const reloj = new RelojControlado();
    const despachador = new DespachadorFalso([{ exito: false, error: "Conexión rechazada" }]);
    const worker = new DespacharNotificacionesPendientesUseCase(
      notificaciones,
      webhooks,
      despachador,
      reloj,
      CONFIG_WORKER,
    );

    const resumen = await worker.ejecutar();

    expect(resumen.reintentando).toBe(1);
    const noti = await notificaciones.porEventoId(TENANT, resultado.eventoId);
    expect(noti?.estado).toBe("PENDING");
    expect(noti?.intentos).toBe(1);
    expect(noti?.ultimoError).toBe("Conexión rechazada");
    expect(noti?.proximoIntentoEn.getTime()).toBe(reloj.ahora().getTime() + 1000);
  });

  it("tras 5 intentos fallidos marca FAILED y queda consultable sin volver a intentar", async () => {
    const { webhooks, notificaciones, resultado } = await casoBase("CREADA");
    const reloj = new RelojControlado();
    const despachador = new DespachadorFalso(
      Array.from({ length: 5 }, () => ({ exito: false, error: "Sin respuesta en 5000 ms" })),
    );
    const worker = new DespacharNotificacionesPendientesUseCase(
      notificaciones,
      webhooks,
      despachador,
      reloj,
      CONFIG_WORKER,
    );

    for (let i = 0; i < 5; i++) {
      await worker.ejecutar();
      reloj.avanzar(32000);
    }

    const noti = await notificaciones.porEventoId(TENANT, resultado.eventoId);
    expect(noti?.estado).toBe("FAILED");
    expect(noti?.intentos).toBe(5);

    const despachadorPostUmbral = new DespachadorFalso([{ exito: true }]);
    const workerPostUmbral = new DespacharNotificacionesPendientesUseCase(
      notificaciones,
      webhooks,
      despachadorPostUmbral,
      reloj,
      CONFIG_WORKER,
    );
    const resumenFinal = await workerPostUmbral.ejecutar();
    expect(resumenFinal.procesadas).toBe(0);
    expect(despachadorPostUmbral.cantidad()).toBe(0);
  });

  it("tenant sin webhook configurado: FAILED consultable con error descriptivo", async () => {
    const tenantSinWebhook = "99999999-9999-4999-8999-999999999999";
    const webhooks = new RepositorioDeConfiguracionWebhookEnMemoria();
    await webhooks.guardar({
      tenantId: TENANT,
      url: "https://clientes.ejemplo.com/webhooks",
      secret: "secreto-compartido",
    });
    const notificaciones = new RepositorioDeNotificacionesEnMemoria();
    const registrar = new RegistrarEventoDeEstadoUseCase(
      new RepositorioDeEventosEnMemoria(),
      notificaciones,
      TransaccionEnMemoria,
      RelojFijo,
    );
    const resultado = await registrar.ejecutar({
      tenantId: tenantSinWebhook,
      eventId: siguienteEventoId(),
      guiaId: GUIA,
      estado: "CREADA",
      fechaEvento: "2026-01-01T09:00:00.000Z",
    });

    const despachador = new DespachadorFalso();
    const worker = new DespacharNotificacionesPendientesUseCase(
      notificaciones,
      webhooks,
      despachador,
      new RelojControlado(),
      CONFIG_WORKER,
    );

    await worker.ejecutar();

    const noti = await notificaciones.porEventoId(tenantSinWebhook, resultado.eventoId);
    expect(noti?.estado).toBe("FAILED");
    expect(noti?.ultimoError).toMatch(/webhook/i);
    expect(despachador.cantidad()).toBe(0);
  });
});
