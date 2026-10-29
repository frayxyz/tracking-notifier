import { NodeSDK } from "@opentelemetry/sdk-node";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { ZipkinExporter } from "@opentelemetry/exporter-zipkin";

export interface ConfiguracionTracing {
  activo: boolean;
  urlZipkin: string;
}

export function iniciarTracing(config: ConfiguracionTracing): NodeSDK | null {
  if (!config.activo) return null;
  const sdk = new NodeSDK({
    serviceName: "tracking-notifier",
    traceExporter: new ZipkinExporter({ url: config.urlZipkin }),
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
