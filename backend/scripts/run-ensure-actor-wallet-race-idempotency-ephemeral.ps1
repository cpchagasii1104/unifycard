# run-ensure-actor-wallet-race-idempotency-ephemeral.ps1
# Orquestra o E2E validate-pipeline-e2e-ensure-actor-wallet-race-idempotency em DB EFÊMERA.
# NUNCA toca unificard_dev. DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE (D_FIX Onda 2, 2026-07-05).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_race_ephemeral_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Psql([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); await c.query('$sql'); await c.end(); })().catch(e => { console.error(e.message); process.exit(1); });
"@
  $node | node -
  if ($LASTEXITCODE -ne 0) { throw "psql falhou: $sql" }
}

$failed = $false
try {
  Write-Host "🧱 Criando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Psql $adminUrl "CREATE DATABASE $EPHEMERAL"
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'
  Write-Host '📦 Aplicando migrations ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts | Select-Object -Last 5
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }
  Write-Host '🧪 Rodando e2e ensure-actor-wallet-race-idempotency ...' -ForegroundColor Cyan
  # 5 concorrentes não é suficiente pra forçar a colisão real no unique index (confirmado
  # empiricamente 2026-07-05); 60 reproduz de forma confiável tanto o bug (sem o fix) quanto a
  # idempotência (com o fix).
  if (-not $env:RACE_CONCURRENCY) { $env:RACE_CONCURRENCY = '60' }
  npx tsx src/scripts/validate-pipeline-e2e-ensure-actor-wallet-race-idempotency.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E ENSURE-ACTOR-WALLET-RACE-IDEMPOTENCY: OK' -ForegroundColor Green
exit 0
