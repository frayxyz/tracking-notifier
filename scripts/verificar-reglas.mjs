const post = (eid, estado, fe, g) =>
  fetch("http://localhost:3000/v1/events", {
    method: "POST",
    headers: {
      "X-Tenant-Id": "11111111-1111-1111-1111-111111111111",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eventId: eid, guiaId: g, estado, fechaEvento: fe }),
  }).then(async (r) => {
    const body = await r.json();
    return `${r.status} ${body.estado ?? body.error.code} - ${body.error?.message ?? ""}`;
  });

(async () => {
  const G = crypto.randomUUID();
  console.log(await post(crypto.randomUUID(), "EN_RUTA", "2026-10-29T10:00:00.000Z", G));
  console.log("regresión  ->", await post(crypto.randomUUID(), "CREADA", "2026-10-29T11:00:00.000Z", G));
  await post(crypto.randomUUID(), "ENTREGADA", "2026-10-29T12:00:00.000Z", G);
  console.log("terminal   ->", await post(crypto.randomUUID(), "EN_RUTA", "2026-10-29T13:00:00.000Z", G));
})();
