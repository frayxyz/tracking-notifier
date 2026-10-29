import { NodeSDK } from "@opentelemetry/sdk-node";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export interface ConfiguracionTracing {
  activo: boolean;
  endpointOtlp: string;
}

export function iniciarTracing(config: ConfiguracionTracing): NodeSDK | null {
  if (!config.activo) return null;
  const sdk = new NodeSDK({
    serviceName: "tracking-notifier",
    traceExporter: new OTLPTraceExporter({
      url: `${config.endpointOtlp}/v1/traces`,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
    ],
  });
  sdk.start();
  return sdk;
}

export async function detenerTracing(sdk: NodeSDK | null): Promise<void> {
  if (sdk) await sdk.shutdown();
}
