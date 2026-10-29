# tracking-notifier

Microservicio multi-tenant que **recibe cambios de estado de guías de envío**, los **persiste de
forma idempotente** bajo un **PostgreSQL**, y **notifica al webhook de cada cliente** de forma
asíncrona con reintentos (timeout 5 s, backoff creciente, 5 intentos, `FAILED` consultable).

Arquitectura **hexagonal** (dominio puro sin framework ni ORM) para la prueba técnica de
Desarrollador Backend Senior.

---

## Stack

| Componente | Elección |
|---|---|
| Runtime | Node.js 20+ · TypeScript estricto (`noUncheckedIndexedAccess`) |
| HTTP | Express 4 |
| Validación | Zod (también alimenta la spec OpenAPI) |
| Base de datos | PostgreSQL 16 · Drizzle ORM (SQL explícito, migraciones) |
| Logs | Pino (JSON estructurado, sin datos personales) |
| Pruebas | Vitest + Supertest · Integración con PostgreSQL real via testcontainers |
| Ci | GitHub Actions (`npm test` en cada push) |

## Cómo correrlo

### Con Docker (recomendado)

```bash
docker compose up
```

Levanta: API (`:3000`), PostgreSQL (`:5432`) y un **webhook de prueba** (`:9000`) que imprime en
logs todo lo que recibe (JSON por línea). La ruta host `/fail` falla intencionalmente para poder
observar los reintentos y las notificaciones `FAILED`.

### Local (desarrollo)

```bash
cp .env.example .env   # ajusta credenciales si hace falta
npm install
npm run db:migrate     # aplica migraciones
npm run dev            # API + worker en modo watch
```

## Cómo probarlo (guion de demostración)

### En un solo comando (requiere compose corriendo)

```bash
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

Recorre toda la historia observable: healthz → configuración del webhook → `201 ACEPTADO` /
`200 DUPLICADO` → `409` transición terminal → historial → ciclo `/fail` con backoff →
`FAILED` consultable → conteo de entregas en los logs del mock.

### Paso a paso con curl

```bash
# 1. Configura el webhook del tenant (simulado: el Gateway ya validó el tenant)
curl -X PUT http://localhost:3000/v1/webhook \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://webhook-mock:9000/webhooks"}'

# 2. Registra un evento de estado (la respuesta no espera al webhook)
curl -X POST http://localhost:3000/v1/events \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
        "eventId": "0e5bcf6a-98d0-4f02-84b3-a5c9be7d2850",
        "guiaId": "c796dc3e-cad1-4c34-be0b-7c39e4391234",
        "estado": "CREADA",
        "fechaEvento": "2026-10-28T09:00:00.000Z",
        "observacion": "recibida en bodega central"
      }'
```

```bash
# 3. Idempotencia: reenviar el mismo eventId responde 200 DUPLICADO
#    (no se duplica el evento ni la notificación)
#    → repite el curl anterior y compara los códigos HTTP

# 4. Historial de la guía (orden cronológico, aislado por tenant)
curl http://localhost:3000/v1/guides/<guiaId> \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"

# 5. Conoce al webhook en acción (logs del contenedor)
docker compose logs -f webhook-mock

# 6. Demuestra el ciclo de reintentos: configura el webhook hacia la ruta que falla
curl -X PUT http://localhost:3000/v1/webhook \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://webhook-mock:9000/fail"}'
# registra un evento nuevo y observa los 5 intentos crecientes:
curl http://localhost:3000/v1/notifications?status=FAILED \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

**Firma HMAC de los webhooks**: cada envío incluye `X-Signature: sha256=<hex>` donde
`hex = HMAC_SHA256(cuerpo_crudo, secreto_webhook)`; el secreto se genera y entrega cuando el
cliente configura su webhook (se puede rotar reconfigurando). El receptor valida recomputando
el HMAC del body crudo con su secreto.

## API (v1)

La especificación OpenAPI se sirve en **`GET /openapi.json`** (generada desde los mismos
esquemas Zod de validación) y está exportada como snapshot en `docs/openapi.yaml`.
Además, **Swagger UI interactivo** en **`http://localhost:3000/docs`** — permite ejecutar
cada endpoint directamente desde el navegador (recuerda poner el header `X-Tenant-Id`
mediante el botón *Authorize*, tipo *apiKey*).

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/events` | Registra evento de estado. `201` nuevo · `200` duplicado (idempotencia) · `409` transición inválida |
| `GET` | `/v1/guides/:guiaId` | Historial cronológico + estado actual (aislamiento por tenant) |
| `PUT` | `/v1/webhook` | Configura/rota la URL del webhook del tenant |
| `GET` | `/v1/notifications` | Consulta del outbox (`?status=PENDING|DELIVERED|FAILED`) |
| `GET` | `/docs` | Swagger UI interactivo (consume `/openapi.json`) |
| `GET` | `/openapi.json` | Especificación OpenAPI |
| `GET` | `/healthz` | Health check |

**Cabecera obligatoria**: `X-Tenant-Id` (UUID). El Gateway simuló la autenticación del tenant.

**Formato único de error**:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "...", "details": [] } }
```

Códigos: `400 INVALID_PAYLOAD · INVALID_STATUS · INVALID_TENANT · INVALID_WEBHOOK_URL ·
INVALID_BODY`, `404 GUIDE_NOT_FOUND · NOT_FOUND`, `409 INVALID_TRANSITION`, `500 INTERNAL_ERROR`.

## Pruebas

```bash
npm test          # todo (unitarias + integración) en un solo comando
npm run test:unit         # solo unitarias (no requieren Docker)
npm run test:integration  # solo integración (PostgreSQL real via testcontainers)
```

Qué se prueba y por qué:

- **Dominio (unitarias)**: máquina de estados (`EstadoGuia`): transiciones válidas, terminales
  (`ENTREGADA`/`DEVUELTA` rechazan todo), validez de estados de negocio. Es la regla más
  valiosa del producto → código completamente testado.
- **Casos de uso**: idempotencia por `eventId`, que la transición inválida no persiste nada, que
  el evento aceptado crea su notificación `PENDING` en la misma transacción (outbox), que el
  historial ordena cronológicamente aunque el repos devuelva desordenado, aislamiento de tenant.
- **Worker del outbox**: entrega feliz → `DELIVERED`; fallo → reprograma con espera exponencial
  (1 s, 2 s, 4 s…); 5 intentos → `FAILED` consultable y sin más reintentos; tenant sin webhook →
  `FAILED` con error descriptivo.
- **Firma**: el dispatcher envía `X-Signature` correcta sobre el cuerpo crudo; servidor HTTP real
  actuando de cliente para verificación end-to-end.
- **Integración (PostgreSQL real)**: los repos Drizzle con `UNIQUE(tenant_id, event_id)` y
  `ON CONFLICT DO NOTHING` — incluyendo **doble inserción concurrente** (`Promise.all`), que es
  como el reto puede exprimir la condición de carrera en producción.

## Arquitectura (hexagonal — puertos y adaptadores)

```text
src/
  domain/                   # SIN imports de frameworks, ni Express, ni Drizzle
    guia/                   # EstadoGuia (máquina de estados), EventoDeEstado, Guia
    notificacion/           # Notificacion, PoliticaDeReintentos
    webhook/                # ConfiguracionWebhook
    ports/                  # GuiaRepository, NotificacionRepository,
                            # ConfiguracionWebhookRepository, DespachadorDeWebhook,
                            # Reloj, Transaccion
    errors.ts               # errores de negocio con código HTTP (formato único)
  application/
    use-cases/              # RegistrarEventoDeEstado, ConsultarHistorialDeGuia,
                            # ConfigurarWebhook, ListarNotificaciones,
                            # DespacharNotificacionesPendientes (worker)
  infrastructure/
    http/                   # Express: rutas, validación Zod, middleware tenant,
                            # formato de error único, openapi (desde Zod)
    persistence/            # Drizzle: esquema, migraciones, repos, proveedor de
                            # transacción real (outbox atómico)
    webhooks/               # HttpWebhookDispatcher (fetch + HMAC + timeout)
    worker/                 # CicloDelWorker (polling del outbox)
    config/                 # env fail-fast (Zod), logger Pino
  container.ts              # composición e inyección de dependencias manual
```

La **regla de dependencia** es estricta: `domain` y `application` no importan nada de
`infrastructure`; los adaptadores implementan los puertos de dominio. `container.ts` ensambla
todo al arranque (inyección explícita, sin contenedor mágico).

## Decisiones y supuestos

1. **`guiaId` en el cuerpo del evento** — el enunciado no lo declara pero sin él es imposible
   agrupar el historial por guía ni aplicar la máquina de estados. Se asume que viene en el payload
   (`guiaId: UUID`). Primera decisión de dominio documentada.
2. **Outbox como corazón del sistema** — ver `docs/adr-001.md` (cuadro de alternativas y consecuencias).
3. **Idempotencia** — la garantía fuerte se implementa **en la base de datos** (`UNIQUE` + `ON
   CONFLICT DO NOTHING`), no solo en código de aplicación: es la única manera de vencer la
   condición de carrera de doble envío. El caso de uso consulta primero y devuelve
   `DUPLICADO → 200` sin duplicar evento ni notificación.
4. **Estados terminales y reglas de transición** — la máquina de estados actúa en dos niveles:
   - **Terminales en absoluto**: `ENTREGADA` y `DEVUELTA` rechazan **cualquier evento nuevo** con
     `409 INVALID_TRANSITION` (no cambian de estado, ni siquiera hacia sí mismas con datos nuevos).
     La única respuesta posible es la repetición del **mismo eventId** ya registrado, que responde
     `200 DUPLICADO` por idempotencia (no es un evento nuevo: no cambia nada).
   - **Regresión bloqueada**: `EN_RUTA → CREADA` se rechaza con `409` (una guía no "vuelve a nacer").
   - **Deduplicación por estado** (estados no terminales): un evento nuevo cuyo estado, `fechaEvento`
     y `observacion` son **idénticos** al evento vigente se responde `200 DUPLICADO` sin persistir
     nada (es la misma lectura reenviada con otro `eventId`).
   - **Re-escaneo enriquecido**: mismo estado pero con `fechaEvento` u `observacion` distintas se
     acepta (`201 ACEPTADO`) como lectura nueva + su notificación (fiel a "por cada evento aceptado
     se notifica"). El estado solo se mueve hacia adelante; el dedup fuerte sigue garantizado por
     `eventId`, y por estado+contenido para lecturas repetidas.
5. **Estado actual de la guía** — es el del evento con `fechaEvento` más reciente
   (desempate por `fechaRegistro`), no el último recibido: refleja el significado de
   "historial cronológico" del enunciado. Los eventos que se reciben fuera de orden
   (con `fechaEvento` anterior) se validan contra el estado vigente en recepción.
6. **Tenant** — `X-Tenant-Id` se confía (simulado por Gateway); el servicio verifica formato UUID,
   no existencia. El tenant nace a la hora de configurar su webhook; toda lectura/escritura filtra
   por tenant y las `UNIQUE` están por `(tenant_id, …)`.
7. **Notificaciones de tenants sin webhook** — se marcan `FAILED` con error descriptivo y quedan
   consultables (es el comportamiento con menos esquinas y más observabilidad).
8. **Secretos** — exclusivamente por variables de entorno (validadas con Zod al arrancar:
   *fail-fast*). Nada sensible en el repo; `.env.example` documenta el contrato. Credenciales de
   compose son ficticias (solo demo).
9. **Logs** — JSON por línea (Pino) con `redact` de cabeceras sensibles; se registran
   identificadores (`tenantId`, `eventId`) y resultados, **nunca** cargas útiles ni `observacion`
   (candidato real a contener datos personales).

## Herramientas de IA utilizadas

- **Asistente de codificación (Claude/GPT) para andamiaje acelerado**: estructura del proyecto,
  configuración TypeScript, esqueleto Express/Drizzle, y redacción de los primeros tests para
  bootstrapping por TDD. El **diseño** (máquina de estados, outbox, contratos HTTP) y las
  decisiones del ADR son de análisis manual con el dominio del enunciado.
- **Depuración incrementada**: el asistente ayudó a identificar el error de entorno OpenSSL de
  npm en Windows (workaround documentado en scripts) y a corregir detalles de tipado estricto.
- Todo el código final fue revisado, ejecutado y testeado localmente; las pruebas
  describen el comportamiento esperado de negocio y las aserciones son verificables.

## Qué haría con más tiempo

- **`LISTEN/NOTIFY`** del outbox para entrega casi-inmediata sin sacrificar durabilidad
  (polling mantiene su rol de red de seguridad).
- **Métricas/OpenTelemetry**: contador de ciclos del worker, histograma de intentos,
  trazas propagadas por `eventId`.
- **Rate limiting y desduplicación** adicional por tenant en el dispatcher, y circuit breaker
  si un webhook se cae prolongadamente (aplicar un retraso mayor a `next_attempt_at`).
- **Paginación por cursor** en `/v1/notifications` (offset basta para el alcance actual).
- **Readiness y liveness separadas** y health-check que refleje la salud del worker.
- **E2E contra la API en compose** (el webhook mock ya está listo para estos tests).
- **Lint en CI** con ESLint riguroso (reglas de fronteras de arquitectura con `eslint-plugin-boundaries`).
