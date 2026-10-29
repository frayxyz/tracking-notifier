import type { NextFunction, Request, Response } from "express";
import { TenantNoValido } from "../../../domain/errors.js";
import { TenantHeadeRSChema } from "../dtos/esquemas.js";

declare module "express-serve-static-core" {
  interface Request {
    tenantId?: string;
  }
}

export function middlewareDeTenant(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.header("X-Tenant-Id");
    const parsed = TenantHeadeRSChema.safeParse(header);
    if (!parsed.success) {
      throw new TenantNoValido();
    }
    req.tenantId = parsed.data;
    next();
  } catch (err) {
    next(err);
  }
}
