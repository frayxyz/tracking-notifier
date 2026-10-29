import { describe, expect, it } from "vitest";
import { RegistrarEventoDeEstadoUseCase } from "../../../../src/application/use-cases/RegistrarEventoDeEstadoUseCase.js";
import {
  RelojFijo,
  RepositorioDeEventosEnMemoria,
  RepositorioDeNotificacionesEnMemoria,
  TransaccionEnMemoria,
} from "../../../support/adaptadores-memoria.js";
import { ErrorNegocio } from "../../../../src/domain/errors.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "33333333-3333-3333-3333-333333333333";
const GUIA = "22222222-2222-2222-2222-222222222222";

function caso() {
  const eventos = new RepositorioDeEventosEnMemoria();
  const notificaciones = new RepositorioDeNotificacionesEnMemoria();
  const casoDeUso = new RegistrarEventoDeEstadoUseCase(
    eventos,
    notificaciones,
    TransaccionEnMemoria,
    RelojFijo,
  );
  return { casoDeUso, eventos, notificaciones };
}

function comando(overrides: Partial<Parameters<RegistrarEventoDeEstadoUseCase["ejecutar"]>[0]> = {}) {
  return {
    tenantId: TENANT_A,
    eventId: "11119999-aaaa-4b2b-8ccc-dddddddddddd",
    guiaId: GUIA,
    estado: "CREADA",
    fechaEvento: "2026-01-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("RegistrarEventoDeEstadoUseCase", () => {
  it("primer evento: ACEPTADO, persiste evento y crea su notificación PENDING", async () => {
    const { casoDeUso, eventos, notificaciones } = caso();
    const resultado = await casoDeUso.ejecutar(comando());

    expect(resultado.estado).toBe("ACEPTADO");
    expect(eventos.cantidad()).toBe(1);
    const notificacion = await notificaciones.porEventoId(resultado.eventoId);
    expect(notificacion?.estado).toBe("PENDING");
  });

  it("evento con eventId ya registrado: DUPLICADO sin duplicar evento ni notificación", async () => {
    const { casoDeUso, eventos, notificaciones } = caso();
    const mismoEvento = { eventId: "11119999-bbbb-4b2b-8ccc-dddddddddddd", estado: "EN_RUTA" as const };

    const primera = await casoDeUso.ejecutar(comando(mismoEvento));
    const repetida = await casoDeUso.ejecutar(comando({ ...mismoEvento, estado: "TOTALLY_NOT_A_STATE" }));

    expect(primera.estado).toBe("ACEPTADO");
    expect(repetida.estado).toBe("DUPLICADO");
    expect(eventos.cantidad()).toBe(1);
    expect(notificaciones.cantidad()).toBe(1);
  });

  it("guía ENTREGADA con nuevo eventId: rechaza transición (409) sin persistir nada", async () => {
    const { casoDeUso, eventos, notificaciones } = caso();
    await casoDeUso.ejecutar(comando({ eventId: "11119999-cccc-4b2b-8ccc-dddddddddddd", estado: "ENTREGADA" }));

    const fallo = await casoDeUso
      .ejecutar(comando({ eventId: "11119999-dddd-4b2b-8ccc-dddddddddddd", estado: "EN_RUTA" }))
      .catch((e) => e as ErrorNegocio);

    expect(fallo).toBeInstanceOf(ErrorNegocio);
    expect(fallo.codigo).toBe("INVALID_TRANSITION");
    expect(fallo.httpStatus).toBe(409);
    expect(eventos.cantidad()).toBe(1);
    expect(notificaciones.cantidad()).toBe(1);
  });

  it("la misma guía vive aislada por tenant (transiciones independientes)", async () => {
    const { casoDeUso, eventos } = caso();
    await casoDeUso.ejecutar(comando({ tenantId: TENANT_A, estado: "ENTREGADA" }));
    const enTenantB = await casoDeUso.ejecutar(
      comando({ tenantId: TENANT_B, estado: "CREADA", eventId: "11119999-eeee-4b2b-8ccc-dddddddddddd" }),
    );

    expect(enTenantB.estado).toBe("ACEPTADO");
    expect(eventos.cantidad()).toBe(2);
  });

  it("la notificación PENDING contiene el payload de negocio del evento", async () => {
    const { casoDeUso, notificaciones } = caso();
    const resultado = await casoDeUso.ejecutar(
      comando({ estado: "EN_RUTA", observacion: "escaneo en xalapa" }),
    );
    const noti = await notificaciones.porEventoId(resultado.eventoId);

    expect(noti?.payload).toEqual({
      eventId: "11119999-aaaa-4b2b-8ccc-dddddddddddd",
      guiaId: GUIA,
      estado: "EN_RUTA",
      fechaEvento: "2026-01-01T08:00:00.000Z",
      observacion: "escaneo en xalapa",
    });
  });

  it("estado de negocio desconocido: error de dominio 400", async () => {
    const { casoDeUso } = caso();
    const fallo = await casoDeUso
      .ejecutar(comando({ eventId: "11119999-ffff-4b2b-8ccc-dddddddddddd", estado: "VOLADA" }))
      .catch((e) => e as ErrorNegocio);

    expect(fallo).toBeInstanceOf(ErrorNegocio);
    expect(fallo.codigo).toBe("INVALID_STATUS");
    expect(fallo.httpStatus).toBe(400);
  });
});
