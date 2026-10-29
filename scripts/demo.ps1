$ErrorActionPreference = "Stop"
$BASE = "http://localhost:3000"
$TENANT = "11111111-1111-1111-1111-111111111111"
$GUIA = [guid]::NewGuid().ToString()
$H = @{ "X-Tenant-Id" = $TENANT; "Content-Type" = "application/json" }

function Nodo($metodo, $uri, $cuerpo) {
    try {
        if ($cuerpo) {
            $r = Invoke-RestMethod -Method $metodo -Uri $uri -Headers $H -ContentType "application/json" -Body $cuerpo
            $nuevoEstado = $null
            Write-Host "OK  $uri" -NoNewline; Write-Host "  ->" -NoNewline; Write-Host ($r | ConvertTo-Json -Compress -Depth 8)
        } else {
            $r = Invoke-RestMethod -Method $metodo -Uri $uri -Headers @{"X-Tenant-Id" = $TENANT}
            Write-Host "200 $uri" -NoNewline; Write-Host "  ->" -NoNewline; Write-Host ($r | ConvertTo-Json -Compress -Depth 8)
        }
    } catch {
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host "[HTTP] $uri  -> $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        } else {
            Write-Host "[ERR] $uri -> $($_.Exception.Message)" -ForegroundColor Red
            throw
        }
    }
}

Write-Host "=== 1. healthz ===" -ForegroundColor Cyan
Nodo GET "$BASE/healthz"

Write-Host "`n=== 2. configurar webhook del tenant (ruta OK del mock) ===" -ForegroundColor Cyan
Nodo PUT "$BASE/v1/webhook" '{"url": "http://webhook-mock:9000/webhooks"}'

Write-Host "`n=== 3. registrar evento (201 ACEPTADO) y reenviarlo (200 DUPLICADO) ===" -ForegroundColor Cyan
$eventId = [guid]::NewGuid().ToString()
$fecha = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$payload = '{"eventId":"' + $eventId + '","guiaId":"' + $GUIA + '","estado":"CREADA","fechaEvento":"' + $fecha + '","observacion":"prueba de demo"}'
Nodo POST "$BASE/v1/events" $payload
Nodo POST "$BASE/v1/events" $payload

Write-Host "`n=== 4. registrar terminal ENTREGADA y forzar transicion invalida (se espera 409) ===" -ForegroundColor Cyan
$fecha2 = (Get-Date).ToUniversalTime().AddMinutes(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Nodo POST "$BASE/v1/events" ('{"eventId":"' + [guid]::NewGuid().ToString() + '","guiaId":"' + $GUIA + '","estado":"ENTREGADA","fechaEvento":"' + $fecha2 + '"}')
$fecha3 = (Get-Date).ToUniversalTime().AddMinutes(2).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Nodo POST "$BASE/v1/events" ('{"eventId":"' + [guid]::NewGuid().ToString() + '","guiaId":"' + $GUIA + '","estado":"EN_RUTA","fechaEvento":"' + $fecha3 + '"}')

Write-Host "`n=== 5. historial de la guia ===" -ForegroundColor Cyan
Nodo GET "$BASE/v1/guides/$GUIA"

Write-Host "`n=== 6. webhook que falla: apuntar a /fail y registrar evento ===" -ForegroundColor Cyan
Nodo PUT "$BASE/v1/webhook" '{"url": "http://webhook-mock:9000/fail"}'
$eventIdFalla = [guid]::NewGuid().ToString()
$guiaFalla = [guid]::NewGuid().ToString()
$fechaF = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Nodo POST "$BASE/v1/events" ('{"eventId":"' + $eventIdFalla + '","guiaId":"' + $guiaFalla + '","estado":"CREADA","fechaEvento":"' + $fechaF + '","observacion":"demo reintentos"}')

Write-Host "esperando el ciclo del worker con backoff (1s+2s+4s+8s+16s ~ 35s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 42

Write-Host "`n=== 7. notificaciones FAILED consultables ===" -ForegroundColor Cyan
Nodo GET "$BASE/v1/notifications?status=FAILED"

Write-Host "`n=== 8. entregas que FALLARON vistas por el webhook-mock ===" -ForegroundColor Cyan
docker compose logs webhook-mock --tail 40 --no-log-prefix 2>$null | Select-String "FALLO_INTENCIONAL" | Measure-Object | ForEach-Object { "FALLO_INTENCIONAL detectados: $($_.Count)" }

Write-Host "=== 9. entregas OK vistas por el webhook-mock (incluida firma HMAC) ===" -ForegroundColor Cyan
docker compose logs webhook-mock --no-log-prefix 2>$null | Select-String "RECEPCION_OK" | Measure-Object | ForEach-Object { "RECEPCION_OK detectados: $($_.Count)" }

Write-Host "`nDemo completa. OpenAPI: http://localhost:3000/openapi.json" -ForegroundColor Green
