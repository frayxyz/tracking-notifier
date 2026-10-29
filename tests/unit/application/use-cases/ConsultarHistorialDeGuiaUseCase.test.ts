import { describe, expect, it } from "vitest";
import { ConsultarHistorialDeGuiaUseCase } from "../../../../src/application/use-cases/ConsultarHistorialDeGuiaUseCase.js";
import { RepositorioDeEventosEnMemoria } from "../../../support/adaptadores-memoria.js";
import { Guia } from "../../../../src/domain/guia/Guia.js";
import { EstadoGuia } from "../../../../src/domain/guia/EstadoGuia.js";
import { GuiaNoEncontrada } from "../../../../src/domain/errors.js";
import type { EventoDeEstado } from "../../../../src/domain/guia/EventoDeEstado.js";
import type { GuiaRepository } from "../../../../src/domain/ports/GuiaRepository.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const GUIA = "22222222-2222-2222-2222-222222222222";

async function eventosPopulados(): Promise<RepositorioDeEventosEnMemoria> {
  const eventos = new RepositorioDeEventosEnMemoria();
  const guia = Guia.vacia(TENANT, GUIA);
  const fechas = [
    { eventId: "ev-creada-1", estado: "CREADA", fechaEvento: "2026-01-01T08:00:00.000Z", observacion: undefined },
    { eventId: "ev-enruta-1", estado: "EN_RUTA", fechaEvento: "2026-01-02T10:00:00.000Z", observacion: "scan ruta" },
  ] as const;
  for (const f of fechas) {
    const registrado = guia.registrarEvento({
      eventId: f.eventId,
      estado: EstadoGuia.desde(f.estado),
      fechaEvento: new Date(f.fechaEvento),
      observacion: f.observacion === undefined ? undefined : f.observacion,
      fechaRegistro: new Date("2026-01-02T12:00:00.000Z"),
    });
    await eventos.guardar(registrado);
  }
  return eventos;
}

describe("ConsultarHistorialDeGuiaUseCase", () => {
  it("devuelve estado actual y eventos en orden cronológico por fechaEvento", async () => {
    const casos = new ConsultarHistorialDeGuiaUseCase(await eventosPopulados());
    const historial = await casos.ejecutar({ tenantId: TENANT, guiaId: GUIA });

    expect(historial.guiaId).toBe(GUIA);
    expect(historial.estadoActual).toBe("EN_RUTA");
    expect(historial.eventos.map((e) => e.eventId)).toEqual(["ev-creada-1", "ev-enruta-1"]);
    expect(historial.eventos[0]!.fechaEvento).toBe("2026-01-01T08:00:00.000Z");
    expect(historial.eventos[0]!.observacion).toBeUndefined();
    expect(historial.eventos[1]!.observacion).toBe("scan ruta");
  });

  it("ordena cronológicamente aunque el repositorio devuelva desordenado", async () => {
    const creado = EventoDesde("ev-a", "CREADA", "2026-01-01T10:00:00.000Z");
    const enRuta = EventoDesde("ev-b", "EN_RUTA", "2026-01-05T10:00:00.000Z");
    const repositorioDesordenado: GuiaRepository = {
      eventosDeGuia: async () => [enRuta, creado],
      buscarEvento: async () => null,
      guardar: async () => {},
    };
    const historial = await new ConsultarHistorialDeGuiaUseCase(repositorioDesordenado).ejecutar({
      tenantId: TENANT,
      guiaId: GUIA,
    });

    expect(historial.estadoActual).toBe("EN_RUTA");
    expect(historial.eventos.map((e) => e.eventId)).toEqual(["ev-a", "ev-b"]);
  });

  it("guía sin eventos para el tenant: 404 GUIDE_NOT_FOUND", async () => {
    const fallo = await new ConsultarHistorialDeGuiaUseCase(new RepositorioDeEventosEnMemoria())
      .ejecutar({ tenantId: TENANT, guiaId: GUIA })
      .catch((e) => e);

    expect(fallo).toBeInstanceOf(GuiaNoEncontrada);
    expect(fallo.httpStatus).toBe(404);
  });
});

function EventoDesde(eventId: string, estado: string, fechaEvento: string): EventoDeEstado {
  return Guia.vacia(TENANT, GUIA)
    .registrarEvento({
      eventId,
      estado: EstadoGuia.desde(estado),
      fechaEvento: new Date(fechaEvento),
      fechaRegistro: new Date(fechaEvento),
    });
}
