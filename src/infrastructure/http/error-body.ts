export interface ErrorBody {
  error: { code: string; message: string; details: unknown[] };
}

export function construirError(code: string, message: string, details: unknown[] = []): ErrorBody {
  return { error: { code, message, details } };
}
