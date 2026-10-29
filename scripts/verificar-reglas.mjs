const TENANT = "11111111-1111-1111-1111-111111111111";
const post = (eid, estado, fe, g, obs) =>
  fetch("http://localhost:3000/v1/events", {
    method: "POST",
    headers: { "X-Tenant-Id": TENANT, "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: eid, guiaId: g, estado, fechaEvento: fe, observacion: obs }),
  }).then(async (r) => {
    const body = await r.json();
    return `${r.status} ${body.estado ?? body.error.code} - ${body.error?.message ?? ""}`;
  });

const historial = (g) =>
  fetch(`http://localhost:3000/v1/guides/${g}`, { headers: { "X-Tenant-Id": TENANT } }).then(
    async (r) => {
      const h = await r.json();
      return `${r.status} estadoActual=${h.estadoActual} secuencia=${h.eventos.map((e) => `${e.estado}@${e.fechaEvento.slice(0, 10)}`).join(" -> ")}`;
    },
  );

(async () => {
  // Reglas base
  const G = crypto.randomUUID();
  console.log("--- reglas base ---");
  console.log(await post(crypto.randomUUID(), "EN_RUTA", "2026-10-29T10:00:00.000Z", G));
  console.log("regresión    ->", await post(crypto.randomUUID(), "CREADA", "2026-10-30T11:00:00.000Z", G));
  await post(crypto.randomUUID(), "ENTREGADA", "2026-10-29T12:00:00.000Z", G);
  console.log("terminal     ->", await post(crypto.randomUUID(), "EN_RUTA", "2026-10-31T13:00:00.000Z", G));

  // Inserciones históricas (fuera de orden)
  console.log("--- eventos fuera de orden ---");
  const H = crypto.randomUUID();
  console.log("EN_RUTA (T2)     ->", await post(crypto.randomUUID(), "EN_RUTA", "2026-10-15T10:00:00.000Z", H));
  console.log("CREADA tardía(T1)->", await post(crypto.randomUUID(), "CREADA", "2026-10-14T08:00:00.000Z", H, "llegada tardía"));
  console.log(await historial(H));
  console.log("ENTREGADA tardía incoherente ->", await post(crypto.randomUUID(), "ENTREGADA", "2026-10-14T06:00:00.000Z", H));

  // Terminal + tardío
  const K = crypto.randomUUID();
  await post(crypto.randomUUID(), "ENTREGADA", "2026-10-16T10:00:00.000Z", K);
  console.log("--- terminal cerrada a tardíos ---");
  console.log("CREADA tardía bajo ENTREGADA ->", await post(crypto.randomUUID(), "CREADA", "2026-10-10T08:00:00.000Z", K));
})();
