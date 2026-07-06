# run-r2-delegation-schema-ephemeral.ps1
# Prova a migration R2.1 (delegação governada + audit append-only) em DB EFEMERA. NUNCA toca unificard_dev.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_curation_hardening_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo e unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Node([string]$url, [string]$js) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); $js await c.end(); })().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
"@
  $node | node -
  if ($LASTEXITCODE -ne 0) { throw "node falhou" }
}

$failed = $false
try {
  Write-Host "Criando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Node $adminUrl "await c.query('DROP DATABASE IF EXISTS $EPHEMERAL');"
  Invoke-Node $adminUrl "await c.query('CREATE DATABASE $EPHEMERAL');"
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'
  Write-Host 'Aplicando TODAS as migrations (inclui R2.1) ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts | Select-Object -Last 3
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }

  Write-Host 'Provando mapa 0106 ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-curation-hardening.ts
  if ($LASTEXITCODE -ne 0) { throw "prova R2.1 falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "FALHA: $($_.Exception.Message)" -ForegroundColor Red }
finally {
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Node $adminUrl "await c.query('DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)');" } catch { Write-Host "aviso: drop falhou" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'CURATION HARDENING: OK' -ForegroundColor Green
exit 0
