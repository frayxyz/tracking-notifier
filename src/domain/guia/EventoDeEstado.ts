import { EstadoGuia } from "./EstadoGuia.js";

export interface DatosDeEvento {
  eventId: string;
  tenantId: string;
  guiaId: string;
  estado: EstadoGuia;
  fechaEvento: Date;
  observacion?: string;
  fechaRegistro: Date;
}

export class EventoDeEstado {
  private constructor(
    readonly eventId: string,
    readonly tenantId: string,
    readonly guiaId: string,
    readonly estado: EstadoGuia,
    readonly fechaEvento: Date,
    readonly observacion: string | undefined,
    readonly fechaRegistro: Date,
  ) {}

  static crear(datos: DatosDeEvento): EventoDeEstado {
    return new EventoDeEstado(
      datos.eventId,
      datos.tenantId,
      datos.guiaId,
      datos.estado,
      new Date(datos.fechaEvento),
      datos.observacion,
      new Date(datos.fechaRegistro),
    );
  }
}
