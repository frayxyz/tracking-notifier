import { describe, expect, it } from "vitest";
import { PoliticaDeReintentos } from "../../../../src/domain/notificacion/PoliticaDeReintentos.js";

describe("PoliticaDeReintentos", () => {
  const politica = new PoliticaDeReintentos(5, 1000);

  it("espera creciente exponencial por intento fallido: 1s, 2s, 4s, 8s, 16s", () => {
    expect(politica.espera(1)).toBe(1000);
    expect(politica.espera(2)).toBe(2000);
    expect(politica.espera(3)).toBe(4000);
    expect(politica.espera(4)).toBe(8000);
    expect(politica.espera(5)).toBe(16000);
  });

  it("limita la espera a un máximo razonable", () => {
    expect(politica.espera(10)).toBe(30000);
  });

  it("queda agotada cuando los intentos alcanzan el máximo", () => {
    expect(politica.agotados(4)).toBe(false);
    expect(politica.agotados(5)).toBe(true);
  });
});
