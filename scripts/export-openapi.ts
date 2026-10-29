import { writeFileSync, mkdirSync } from "node:fs";
import { dump } from "js-yaml";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { construirOpenApiDocument } from "../src/infrastructure/http/openapi/construir-documento.js";

const dirProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(dirProyecto, "docs", "openapi.yaml");
mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, dump(construirOpenApiDocument(), { lineWidth: 120 }), "utf8");
console.log(`OpenAPI exportado -> ${destino}`);
