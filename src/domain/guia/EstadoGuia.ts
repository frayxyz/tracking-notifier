import { ErrorNegocio } from "../errors.js";

const ESTADOS_NEGOCIO = ["CREADA", "EN_RUTA", "ENTREGADA", "DEVUELTA"] as const;

export type EstadoValor = (typeof ESTADOS_NEGOCIO)[number];

const TERMINALES: ReadonlySet<EstadoValor> = new Set<EstadoValor>(["ENTREGADA", "DEVUELTA"]);

export class EstadoGuia {
  private constructor(readonly valor: EstadoValor) {}

  static readonly CREADA = new EstadoGuia("CREADA");
  static readonly EN_RUTA = new EstadoGuia("EN_RUTA");
  static readonly ENTREGADA = new EstadoGuia("ENTREGADA");
  static readonly DEVUELTA = new EstadoGuia("DEVUELTA");

  static desde(valor: string): EstadoGuia {
    if (!ESTADOS_NEGOCIO.includes(valor as EstadoValor)) {
      throw new ErrorNegocio("INVALID_STATUS", 400, `Estado no válido para guía: '${valor}'`);
    }
    return EstadoGuia[valor as keyof typeof EstadoGuia] as EstadoGuia;
  }

  static todos(): EstadoGuia[] {
    return [EstadoGuia.CREADA, EstadoGuia.EN_RUTA, EstadoGuia.ENTREGADA, EstadoGuia.DEVUELTA];
  }

  esTerminal(): boolean {
    return TERMINALES.has(this.valor);
  }

  puedeTransicionarA(_destino: EstadoGuia): boolean {
    return !this.esTerminal();
  }

  equals(otro: EstadoGuia): boolean {
    return this.valor === otro.valor;
  }
}
