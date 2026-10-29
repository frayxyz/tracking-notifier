import { describe, expect, it } from "vitest";
import { EstadoGuia } from "../../../../src/domain/guia/EstadoGuia.js";

describe("EstadoGuia (máquina de estados del dominio)", () => {
  it("se construye desde un estado de negocio válido", () => {
    expect(EstadoGuia.desde("EN_RUTA").valor).toBe("EN_RUTA");
  });

  it("rechaza estados que no pertenecen al negocio", () => {
    expect(() => EstadoGuia.desde("CANCELADA")).toThrowError(/estado no válido/i);
  });

  it("flujo completo feliz: CREADA → EN_RUTA → ENTREGADA", () => {
    const creada = EstadoGuia.desde("CREADA");
    const enRuta = EstadoGuia.desde("EN_RUTA");
    const entregada = EstadoGuia.desde("ENTREGADA");

    expect(creada.puedeTransicionarA(enRuta)).toBe(true);
    expect(enRuta.puedeTransicionarA(entregada)).toBe(true);
  });

  it("permite entrega directa sin tránsito: CREADA → ENTREGADA", () => {
    expect(EstadoGuia.desde("CREADA").puedeTransicionarA(EstadoGuia.desde("ENTREGADA"))).toBe(
      true,
    );
  });

  it("permite devolución sin salida: CREADA → DEVUELTA", () => {
    expect(EstadoGuia.desde("CREADA").puedeTransicionarA(EstadoGuia.desde("DEVUELTA"))).toBe(
      true,
    );
  });

  it("permite re-escaneo del mismo estado no terminal (ej: doble lectura en ruta)", () => {
    const enRuta = EstadoGuia.desde("EN_RUTA");
    expect(enRuta.puedeTransicionarA(enRuta)).toBe(true);
  });

  it("ENTREGADA es terminal: rechaza cualquier transición", () => {
    const entregada = EstadoGuia.desde("ENTREGADA");
    for (const destino of EstadoGuia.todos()) {
      expect(entregada.puedeTransicionarA(destino)).toBe(false);
    }
  });

  it("DEVUELTA es terminal: rechaza cualquier transición", () => {
    const devuelta = EstadoGuia.desde("DEVUELTA");
    for (const destino of EstadoGuia.todos()) {
      expect(devuelta.puedeTransicionarA(destino)).toBe(false);
    }
  });
});
