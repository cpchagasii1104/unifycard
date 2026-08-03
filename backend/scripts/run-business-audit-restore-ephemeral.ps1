# run-orchestration-fulfillment-rentable-ephemeral.ps1
# Orquestra o E2E F-BUSINESS-AUDIT-RESTORE em DB EFÊMERA. NUNCA toca unificard_dev.
# RED:   DB efêmera SEM 20260803100000 -> fulfillment_kind='rentable' recusado pelo CHECK (23514).
# GREEN: mesma DB COM a migration -> locável aceito; NÃO-locável ainda recusado pela FK (23503);
#        valor fora do vocabulário governado ainda recusado (23514).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_business_audit_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

$migration = Join-Path $PSScriptRoot '..\migrations\20260803120000_business_audit_logs_restore.sql'
$holdout = Join-Path $env:TEMP '20260803120000_business_audit_logs_restore.sql.holdout'

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

  Write-Host '🔴 FASE RED — retirando a migration antes de migrar ...' -ForegroundColor Cyan
  if (-not (Test-Path $migration)) { throw "migration não encontrada: $migration" }
  Move-Item -Force $migration $holdout

  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate (sem a migration) falhou (rc=$LASTEXITCODE)" }

  npx tsx src/scripts/validate-pipeline-e2e-business-audit-restore.ts red
  if ($LASTEXITCODE -ne 0) { throw "e2e RED falhou (rc=$LASTEXITCODE)" }

  Write-Host '🟢 FASE GREEN — devolvendo a migration e reaplicando ...' -ForegroundColor Cyan
  Move-Item -Force $holdout $migration

  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate (com a migration) falhou (rc=$LASTEXITCODE)" }

  npx tsx src/scripts/validate-pipeline-e2e-business-audit-restore.ts green
  if ($LASTEXITCODE -ne 0) { throw "e2e GREEN falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  if (Test-Path $holdout) { Move-Item -Force $holdout $migration }
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E BUSINESS-AUDIT-RESTORE (RED + GREEN): OK' -ForegroundColor Green
exit 0
