const BACKOFF_MAXIMO_MS = 30_000;

export class PoliticaDeReintentos {
  constructor(
    readonly maxIntentos: number,
    readonly baseMs: number,
  ) {}

  espera(intentoFallido: number): number {
    const exponente = Math.max(0, intentoFallido - 1);
    return Math.min(this.baseMs * 2 ** exponente, BACKOFF_MAXIMO_MS);
  }

  agotados(intentos: number): boolean {
    return intentos >= this.maxIntentos;
  }
}
