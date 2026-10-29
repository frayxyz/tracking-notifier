const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PUERTO = process.env.PORT || 9000;
const FALLAR_EN = new Set((process.env.FAIL_PATHS || "/fail").split(","));
const MAX_ENTREGAS = 200;

let entregas = [];
let siguienteId = 0;
const clientesSSE = new Set();

const html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

const servidor = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "GET" && req.url === "/entregas") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ entregas }));
    return;
  }

  if (req.method === "GET" && req.url === "/eventos") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 3000\n\n");
    clientesSSE.add(res);
    req.on("close", () => clientesSSE.delete(res));
    return;
  }

  if (req.method !== "POST") {
    if (req.url === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Solo se registran POSTs como entregas");
    return;
  }

  const trozos = [];
  req.on("data", (t) => trozos.push(t));
  req.on("end", () => {
    const cuerpo = Buffer.concat(trozos).toString("utf8");
    const esFallo = FALLAR_EN.has(req.url || "");
    siguienteId++;

    const entrega = {
      n: siguienteId,
      ts: new Date().toISOString(),
      method: req.method,
      path: req.url || "",
      estadoHttp: esFallo ? 500 : 200,
      firma: req.headers["x-signature"] || null,
      cuerpo,
    };
    entregas.push(entrega);
    if (entregas.length > MAX_ENTREGAS) entregas = entregas.slice(-MAX_ENTREGAS);

    console.log(
      JSON.stringify({
        webhook_mock: {
          n: entrega.n,
          ts: entrega.ts,
          method: req.method,
          path: entrega.path,
          signature: entrega.firma,
          body: entrega.cuerpo,
        },
        entregable: esFallo ? "FALLO_INTENCIONAL" : "RECEPCION_OK",
      }),
    );

    const payload = `data: ${JSON.stringify({
      ...entrega,
      tipo: esFallo ? "FALLO_INTENCIONAL" : "RECEPCION_OK",
    })}\n\n`;
    for (const cliente of clientesSSE) {
      try {
        cliente.write(payload);
      } catch {
        clientesSSE.delete(cliente);
      }
    }

    res.writeHead(esFallo ? 500 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ rec: true, n: siguienteId, intentional: esFallo }));
  });
});

servidor.listen(PUERTO, () => {
  console.log(
    JSON.stringify({
      webhook_mock: "listening",
      port: PUERTO,
      vista: `http://localhost:${PUERTO}`,
      fail_paths: [...FALLAR_EN],
    }),
  );
});
