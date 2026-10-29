import pino from "pino";

export function createLoggerStub(): pino.Logger {
  return pino({ level: "silent" });
}
