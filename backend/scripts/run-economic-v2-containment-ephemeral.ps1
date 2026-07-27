# run-economic-v2-containment-ephemeral.ps1
# Orquestra o E2E validate-pipeline-e2e-economic-v2-containment em DB EFEMERA. NUNCA toca unificard_dev.
# F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 SS4/SS9) - 8 rotas mandatadas -> 501 honesto
# ANTES de qualquer side-effect; 3 rotas fora do mapa (leitura + handoff de fase) permanecem vivas.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_economic_v2_containment_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo e unificard_dev' -ForegroundColor Red; exit 1 }

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
  Write-Host "Criando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Psql $adminUrl "CREATE DATABASE $EPHEMERAL"
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'
  Write-Host 'Aplicando migrations ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }
  Write-Host 'Rodando e2e economic-v2-containment ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-economic-v2-containment.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "Dropando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E ECONOMIC-V2-CONTAINMENT: OK' -ForegroundColor Green
exit 0
