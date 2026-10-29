import { describe, expect, it } from "vitest";
import { ConfigurarWebhookUseCase } from "../../../../src/application/use-cases/ConfigurarWebhookUseCase.js";
import { RepositorioDeConfiguracionWebhookEnMemoria } from "../../../support/repositorio-webhook-memoria.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const SECRETOS_FIJOS = ["secreto-0", "secreto-1"];

describe("ConfigurarWebhookUseCase", () => {
  it("guarda la URL y genera un secreto para el tenant", async () => {
    const repositorio = new RepositorioDeConfiguracionWebhookEnMemoria();
    const uso = new ConfigurarWebhookUseCase(repositorio, { generar: () => "secreto-ficticio-123" });
    const resultado = await uso.ejecutar({
      tenantId: TENANT,
      url: "https://cliente.ejemplo.com/webhooks/envios",
    });

    expect(resultado.url).toBe("https://cliente.ejemplo.com/webhooks/envios");
    expect(resultado.webhookSecret).toBe("secreto-ficticio-123");
    expect(repositorio.contiene(TENANT)).toBe(true);
  });

  it("reconfigura: actualiza URL y rota el secreto", async () => {
    let indice = 0;
    const repositorio = new RepositorioDeConfiguracionWebhookEnMemoria();
    const uso = new ConfigurarWebhookUseCase(repositorio, {
      generar: () => SECRETOS_FIJOS[indice++] ?? "fallback",
    });

    await uso.ejecutar({ tenantId: TENANT, url: "https://old.ejemplo.com/hook" });
    const segunda = await uso.ejecutar({ tenantId: TENANT, url: "https://new.ejemplo.com/hook" });

    expect(segunda.url).toBe("https://new.ejemplo.com/hook");
    expect(segunda.webhookSecret).toBe("secreto-1");
    const buscada = await repositorio.buscar(TENANT);
    expect(buscada?.secret).toBe("secreto-1");
    expect(buscada?.url).toBe("https://new.ejemplo.com/hook");
  });

  it("rechaza URL que no es http(s) (400)", async () => {
    const uso = new ConfigurarWebhookUseCase(
      new RepositorioDeConfiguracionWebhookEnMemoria(),
      { generar: () => "secreto" },
    );
    const fallo = await uso
      .ejecutar({ tenantId: TENANT, url: "ftp://mal.ejemplo.com/hook" })
      .catch((e) => e);

    expect(String(fallo.message)).toMatch(/http/i);
  });
});
