const http = require("node:http");

const PUERTO = process.env.PORT || 9000;
const FALLAR_EN = new Set((process.env.FAIL_PATHS || "/fail").split(","));

let recibidos = 0;

const servidor = http.createServer((req, res) => {
  const trozos = [];
  req.on("data", (t) => trozos.push(t));
  req.on("end", () => {
    const cuerpo = Buffer.concat(trozos).toString("utf8");
    recibidos++;
    const esFallo = FALLAR_EN.has(req.url || "");

    const registro = {
      n: recibidos,
      ts: new Date().toISOString(),
      method: req.method,
      path: req.url,
      signature: req.headers["x-signature"] || null,
      body: cuerpo,
    };

    console.log(
      JSON.stringify({
        webhook_mock: registro,
        entregable: esFallo ? "FALLO_INTENCIONAL" : "RECEPCION_OK",
      }),
    );

    res.writeHead(esFallo ? 500 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ rec: true, n: recibidos, intentional: esFallo }));
  });
});

servidor.listen(PUERTO, () => {
  console.log(JSON.stringify({ webhook_mock: "listening", port: PUERTO, fail_paths: [...FALLAR_EN] }));
});
