import type {
  ResultadoDespacho,
  DespachadorDeWebhook,
} from "../../src/domain/ports/DespachadorDeWebhook.js";
import type { Reloj } from "../../src/domain/ports/Reloj.js";

export class RelojControlado implements Reloj {
  private tiempo = new Date("2026-01-01T12:00:00.000Z");

  ahora(): Date {
    return this.tiempo;
  }

  avanzar(ms: number): void {
    this.tiempo = new Date(this.tiempo.getTime() + ms);
  }
}

export class DespachadorFalso implements DespachadorDeWebhook {
  readonly llamadas: { url: string; raw: string | null }[] = [];

  private respuestas: ResultadoDespacho[] = [];

  constructor(respuestas: ResultadoDespacho[] = []) {
    this.respuestas = respuestas;
  }

  setRespuestas(respuestas: ResultadoDespacho[]): void {
    this.respuestas = respuestas;
  }

  async despachar(url: string, payload: unknown, _secret: string): Promise<ResultadoDespacho> {
    this.llamadas.push({
      url,
      raw: typeof payload === "string" ? String(payload) : JSON.stringify(payload),
    });
    return this.respuestas.shift() ?? { exito: true, httpStatus: 200 };
  }

  cantidad(): number {
    return this.llamadas.length;
  }
}
