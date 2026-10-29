import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { HttpWebhookDispatcher } from "../../../../src/infrastructure/webhooks/HttpWebhookDispatcher.js";
import { createHmac } from "node:crypto";

const PAYLOAD = {
  eventId: "00000000-0000-4000-8000-000000000001",
  guiaId: "22222222-2222-4000-8000-222222222222",
  estado: "EN_RUTA",
  fechaEvento: "2026-01-01T09:00:00.000Z",
};

const SECRETO = "secreto-compartido-de-prueba";

type Manejador = (req: IncomingMessage, res: ServerResponse) => void;

function arrancarServidor(handler: Manejador): Promise<Server> {
  return new Promise((resolver) => {
    const server = createServer(handler);
    server.listen(0, () => resolver(server));
  });
}

function puertoDe(server: Server): number {
  const direccion = server.address();
  return typeof direccion === "object" && direccion ? direccion.port : 0;
}

async function cerrar(server: Server): Promise<void> {
  await new Promise<void>((resolver) => server.close(() => resolver()));
}

describe("HttpWebhookDispatcher", () => {
  it("entrega el payload con firma HMAC-SHA256 válida del cuerpo", async () => {
    let cuerpoRecibido: string | null = null;
    let firmaRecibida: string | null = null;
    const servidor = await arrancarServidor((req, res) => {
      const trozos: Buffer[] = [];
      req.on("data", (t: Buffer) => trozos.push(t));
      req.on("end", () => {
        cuerpoRecibido = Buffer.concat(trozos).toString("utf8");
        firmaRecibida = (req.headers["x-signature"] as string | undefined) ?? null;
        res.writeHead(200);
        res.end("ok");
      });
    });

    const despachador = new HttpWebhookDispatcher({ timeoutMs: 5000, firmaHmacActiva: true });
    const resultado = await despachador.despachar(
      `http://127.0.0.1:${puertoDe(servidor)}/webhook`,
      PAYLOAD,
      SECRETO,
    );
    await cerrar(servidor);

    expect(resultado).toEqual({ exito: true, httpStatus: 200 });
    expect(cuerpoRecibido).toBe(JSON.stringify(PAYLOAD));
    const firmaEsperada = `sha256=${createHmac("sha256", SECRETO).update(cuerpoRecibido ?? "").digest("hex")}`;
    expect(firmaRecibida).toBe(firmaEsperada);
  });

  it("respuestas 5xx se reportan como fallo con el código HTTP", async () => {
    const servidor = await arrancarServidor((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(500);
        res.end("explode");
      });
    });

    const despachador = new HttpWebhookDispatcher({ timeoutMs: 5000, firmaHmacActiva: true });
    const resultado = await despachador.despachar(
      `http://127.0.0.1:${puertoDe(servidor)}/fallo`,
      PAYLOAD,
      SECRETO,
    );
    await cerrar(servidor);

    expect(resultado.exito).toBe(false);
    expect(resultado.httpStatus).toBe(500);
  });

  it("timeout configurable: se reporta como fallo con mensaje claro", async () => {
    const servidor = await arrancarServidor((req, res) => {
      req.resume();
      setTimeout(() => {
        res.writeHead(200);
        res.end("ok");
      }, 800);
    });

    const despachador = new HttpWebhookDispatcher({ timeoutMs: 100, firmaHmacActiva: false });
    const resultado = await despachador.despachar(
      `http://127.0.0.1:${puertoDe(servidor)}/webhook`,
      PAYLOAD,
      SECRETO,
    );
    await cerrar(servidor);

    expect(resultado.exito).toBe(false);
    expect(resultado.error).toMatch(/tiempo límite/i);
  });
});
