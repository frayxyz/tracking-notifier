import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ZipkinExporter } from "@opentelemetry/exporter-zipkin";
import { trace } from "@opentelemetry/api";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new NodeSDK({
  serviceName: "experimento-zipkin",
  traceExporter: new ZipkinExporter({ url: "http://jaeger:9411/api/v2/spans" }),
});
sdk.start();

const span = trace.getTracer("prueba").startSpan("span.manual.zipkin");
span.setAttribute("via", "zipkin-json");
span.end();

await new Promise((r) => setTimeout(r, 2500));
await sdk.shutdown();
console.log("== fin experimento zipkin ==");
