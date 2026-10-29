import type { PayloadWebhook } from "../notificacion/Notificacion.js";

export interface ResultadoDespacho {
  exito: boolean;
  httpStatus?: number;
  error?: string;
}

export interface DespachadorDeWebhook {
  despachar(url: string, payload: PayloadWebhook, secret: string): Promise<ResultadoDespacho>;
}
