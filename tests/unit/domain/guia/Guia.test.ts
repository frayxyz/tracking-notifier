import { describe, expect, it } from "vitest";
import { Guia } from "../../../../src/domain/guia/Guia.js";
import { EstadoGuia } from "../../../../src/domain/guia/EstadoGuia.js";
import { EventoDeEstado } from "../../../../src/domain/guia/EventoDeEstado.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const GUIA = "22222222-2222-2222-2222-222222222222";
const FECHA = new Date("2026-01-01T10:00:00.000Z");

function eventoDesde(
  eventId: string,
  estado: string,
  fechaEvento: Date,
  observacion?: string,
): EventoDeEstado {
  return EventoDeEstado.crear({
    eventId,
    tenantId: TENANT,
    guiaId: GUIA,
    estado: EstadoGuia.desde(estado),
    fechaEvento,
    observacion,
    fechaRegistro: FECHA,
  });
}

describe("EventoDeEstado", () => {
  it("expone los datos de negocio del evento", () => {
    const e = eventoDesde("aaaa-bbbb", "EN_RUTA", new Date("2026-01-01T09:00:00.000Z"));
    expect(e.eventId).toBe("aaaa-bbbb");
    expect(e.estado.valor).toBe("EN_RUTA");
    expect(e.fechaEvento.toISOString()).toBe("2026-01-01T09:00:00.000Z");
    expect(e.observacion).toBeUndefined();
  });
});

describe("Guia (agregado)", () => {
  it("guía nueva no tiene eventos ni estado actual", () => {
    const guia = Guia.vacia(TENANT, GUIA);
    expect(guia.eventos()).toEqual([]);
    expect(guia.estadoActual()).toBeNull();
  });

  it("registrar primer evento lo agrega y define el estado actual", () => {
    const guia = Guia.vacia(TENANT, GUIA);
    const registrado = guia.registrarEvento({
      eventId: "aaaa-bbbb",
      estado: EstadoGuia.desde("CREADA"),
      fechaEvento: new Date("2026-01-01T08:00:00.000Z"),
      observacion: "recibida en bodega",
      fechaRegistro: FECHA,
    });
    expect(guia.eventos()).toHaveLength(1);
    expect(guia.estadoActual()?.valor).toBe("CREADA");
    expect(registrado.observacion).toBe("recibida en bodega");
  });

  it("una guía ENTREGADA rechaza nuevos eventos del dominio", () => {
    const guia = Guia.vacia(TENANT, GUIA);
    guia.registrarEvento({
      eventId: "aaaa-bbbb",
      estado: EstadoGuia.desde("ENTREGADA"),
      fechaEvento: FECHA,
      fechaRegistro: FECHA,
    });
    expect(() =>
      guia.registrarEvento({
        eventId: "cccc-dddd",
        estado: EstadoGuia.desde("EN_RUTA"),
        fechaEvento: FECHA,
        fechaRegistro: FECHA,
      }),
    ).toThrowError(/terminal/i);
  });

  it("acepta actualización al mismo estado no terminal (re-escaneo)", () => {
    const guia = Guia.vacia(TENANT, GUIA);
    guia.registrarEvento({
      eventId: "aaaa-bbbb",
      estado: EstadoGuia.desde("EN_RUTA"),
      fechaEvento: FECHA,
      fechaRegistro: FECHA,
    });
    guia.registrarEvento({
      eventId: "cccc-dddd",
      estado: EstadoGuia.desde("EN_RUTA"),
      fechaEvento: new Date("2026-01-01T11:00:00.000Z"),
      observacion: "segundo escaneo",
      fechaRegistro: FECHA,
    });
    expect(guia.eventos()).toHaveLength(2);
  });

  it("existeEventoRespuesta cuando el eventId ya pertenece a la guía", () => {
    const guia = Guia.vacia(TENANT, GUIA);
    guia.registrarEvento({
      eventId: "aaaa-bbbb",
      estado: EstadoGuia.desde("CREADA"),
      fechaEvento: FECHA,
      fechaRegistro: FECHA,
    });
    expect(guia.contieneEventoId("aaaa-bbbb")).toBe(true);
    expect(guia.contieneEventoId("zzzz-xxxx")).toBe(false);
  });
});
