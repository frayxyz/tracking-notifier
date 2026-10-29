export class ErrorNegocio extends Error {
  constructor(
    readonly codigo: string,
    readonly httpStatus: number,
    message: string,
    readonly detalles: unknown[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class TransicionInvalida extends ErrorNegocio {
  constructor(estadoActual: string, estadoSolicitado: string) {
    super(
      "INVALID_TRANSITION",
      409,
      `Guide in terminal status '${estadoActual}' cannot transition to '${estadoSolicitado}'`,
    );
  }
}

export class GuiaNoEncontrada extends ErrorNegocio {
  constructor(guiaId: string) {
    super("GUIDE_NOT_FOUND", 404, `Guide '${guiaId}' not found for this tenant`);
  }
}

export class TenantNoValido extends ErrorNegocio {
  constructor() {
    super("INVALID_TENANT", 400, "Missing or invalid 'X-Tenant-Id' header");
  }
}
