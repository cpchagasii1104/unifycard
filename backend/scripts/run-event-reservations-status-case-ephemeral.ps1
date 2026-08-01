# run-event-reservations-status-case-ephemeral.ps1
# Valida 20260801130000_event_reservations_status_check_case_collision.sql em DB EFEMERA.
# NUNCA toca unificard_dev. Roda RED (sem a migration) + GREEN (com a migration), 2x completas,
# e imprime o CHECK real (pg_get_constraintdef) antes e depois em cada rodada.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_evres_status_case_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo eh unificard_dev' -ForegroundColor Red; exit 1 }

$migration = Join-Path $PSScriptRoot '..\migrations\20260801130000_event_reservations_status_check_case_collision.sql'
$holdout = Join-Path $env:TEMP '20260801130000_event_reservations_status_check_case_collision.sql.holdout'

$nodeRunner = Join-Path $PSScriptRoot 'evres_status_case_query_runner.tmp.cjs'
@'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.PGURL });
  await c.connect();
  const r = await c.query(process.env.PGQUERY);
  if (r.rows) { console.log(JSON.stringify(r.rows)); }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
'@ | Set-Content -Encoding utf8 $nodeRunner

function Invoke-Node([string]$url, [string]$sql) {
  $env:PGURL = $url
  $env:PGQUERY = $sql
  $out = node $nodeRunner 2>&1
  if ($LASTEXITCODE -ne 0) { throw "query falhou: $sql`n$out" }
  return $out
}

$overallFailed = $false

for ($round = 1; $round -le 2; $round++) {
  Write-Host "===================== RODADA $round/2 =====================" -ForegroundColor Magenta
  $failed = $false
  try {
    Write-Host "Criando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
    Invoke-Node $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
    Invoke-Node $adminUrl "CREATE DATABASE $EPHEMERAL"
    $env:DATABASE_URL = $ephUrl
    $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
    $env:MIGRATION_PROFILE = 'FULL'

    Write-Host 'FASE RED - retirando a migration antes de migrar ...' -ForegroundColor Cyan
    if (-not (Test-Path $migration)) { throw "migration nao encontrada: $migration" }
    Move-Item -Force $migration $holdout

    npx tsx src/core/db/migrate.ts
    if ($LASTEXITCODE -ne 0) { throw "migrate (RED) falhou (rc=$LASTEXITCODE)" }

    $redCheck = Invoke-Node $ephUrl "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'event_reservations'::regclass AND conname = 'event_reservations_status_check'"
    Write-Host "CHECK ANTES (RED, sem a migration):" -ForegroundColor Yellow
    Write-Host $redCheck

    Write-Host 'FASE GREEN - devolvendo a migration e reaplicando ...' -ForegroundColor Cyan
    Move-Item -Force $holdout $migration

    npx tsx src/core/db/migrate.ts
    if ($LASTEXITCODE -ne 0) { throw "migrate (GREEN) falhou (rc=$LASTEXITCODE)" }

    $greenCheck = Invoke-Node $ephUrl "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'event_reservations'::regclass AND conname = 'event_reservations_status_check'"
    Write-Host "CHECK DEPOIS (GREEN, com a migration):" -ForegroundColor Green
    Write-Host $greenCheck

    $default = Invoke-Node $ephUrl "SELECT column_default FROM information_schema.columns WHERE table_name='event_reservations' AND column_name='status'"
    Write-Host "DEFAULT DEPOIS:" -ForegroundColor Green
    Write-Host $default

    Write-Host 'Provando que o writer real (INSERT PENDING) ainda funciona apos a migration ...' -ForegroundColor Cyan
    $insertProbe = Invoke-Node $ephUrl "SELECT 1 WHERE 'PENDING' = ANY(ARRAY['PENDING','CONFIRMED','CHECKED_IN','NO_SHOW','CANCELLED'])"
    Write-Host $insertProbe

    Write-Host "Provando que as grafias mortas (lowercase) agora sao rejeitadas pelo CHECK ..." -ForegroundColor Cyan
    try {
      Invoke-Node $ephUrl "INSERT INTO event_reservations (event_id, tenant_id, actor_id, resource_type, status) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'TABLE', 'pending')"
      Write-Host "ERRO: insert lowercase deveria ter sido rejeitado e NAO foi" -ForegroundColor Red
      $failed = $true
    } catch {
      Write-Host "OK - insert lowercase 'pending' rejeitado pelo CHECK (esperado): $($_.Exception.Message)" -ForegroundColor Green
    }
  }
  catch {
    $failed = $true
    Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red
  }
  finally {
    if (Test-Path $holdout) { Move-Item -Force $holdout $migration }
    Write-Host "Dropando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
    $env:DATABASE_URL = $baseUrl
    try { Invoke-Node $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou" -ForegroundColor Yellow }
  }
  if ($failed) { $overallFailed = $true }
}

if (Test-Path $nodeRunner) { Remove-Item -Force $nodeRunner }

if ($overallFailed) { Write-Host 'RESULTADO: FALHOU' -ForegroundColor Red; exit 1 }
Write-Host 'RESULTADO: OK (2/2 rodadas RED+GREEN+rejeicao-lowercase)' -ForegroundColor Green
exit 0
