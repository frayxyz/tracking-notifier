export interface Transaccion {
  ejecutar<T>(fn: () => Promise<T>): Promise<T>;
}
