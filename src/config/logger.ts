import pino from "pino";
import type { Env } from "./env.js";

export type Logger = pino.Logger;

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: "tracking-notifier" },
    redact: ["req.headers.authorization", "req.headers['x-signature']"],
  });
}
