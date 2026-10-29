import { ErrorNegocio } from "../errors.js";

const ESTADOS_NEGOCIO = ["CREADA", "EN_RUTA", "ENTREGADA", "DEVUELTA"] as const;

export type EstadoValor = (typeof ESTADOS_NEGOCIO)[number];

const TERMINALES: ReadonlySet<EstadoValor> = new Set<EstadoValor>(["ENTREGADA", "DEVUELTA"]);

export class EstadoGuia {
  private constructor(readonly valor: EstadoValor) {}

  static desde(valor: string): EstadoGuia {
    if (!ESTADOS_NEGOCIO.includes(valor as EstadoValor)) {
      throw new ErrorNegocio("INVALID_STATUS", 400, `Estado no válido para guía: '${valor}'`);
    }
    return INSTANCIAS[valor as EstadoValor];
  }

  static todos(): EstadoGuia[] {
    return ESTADOS_NEGOCIO.map((v) => INSTANCIAS[v]);
  }

  esTerminal(): boolean {
    return TERMINALES.has(this.valor);
  }

  puedeTransicionarA(destino: EstadoGuia): boolean {
    return !this.esTerminal();
  }

  equals(otro: EstadoGuia): boolean {
    return this.valor === otro.valor;
  }
}

const INSTANCIAS: Record<EstadoValor, EstadoGuia> = {
  CREADA: new EstadoGuia("CREADA"),
  EN_RUTA: new EstadoGuia("EN_RUTA"),
  ENTREGADA: new EstadoGuia("ENTREGADA"),
  DEVUELTA: new EstadoGuia("DEVUELTA"),
};
