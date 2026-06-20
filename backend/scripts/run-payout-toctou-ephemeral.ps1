# run-payout-toctou-ephemeral.ps1
# F-PAYOUT-TOCTOU-SAFETY-HARDENING — roda o E2E de TOCTOU execute-time em DB EFÊMERA.
# Cria DB efêmera, migra FULL, self-seed canônico (grafo + coverage + KYC), roda validate-pipeline-e2e-payout-toctou.ts, dropa.
# NUNCA toca unificard_dev. NÃO liga worker. NÃO abre HTTP execution. NÃO abre external payout. DB descartável.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_payout_toctou_e2e"
$ephUrl = "$prefix/$EPHEMERAL"

if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Psql([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: '$url' });
  await c.connect();
  await c.query('$sql');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
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
  Remove-Item Env:\ENABLE_PAYOUT_WORKER -ErrorAction SilentlyContinue

  Write-Host '📦 Aplicando migrations FULL ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }

  Write-Host '🌱 Self-seed canônico (grafo + coverage + KYC) ...' -ForegroundColor Cyan
  Remove-Item 'scripts/.tmp-payout-e2e-tenant.txt' -ErrorAction SilentlyContinue
  npx tsx src/scripts/test-support/payout-e2e-self-seed.ts
  if ($LASTEXITCODE -ne 0) { throw "self-seed falhou (rc=$LASTEXITCODE)" }
  $effTenant = (Get-Content 'scripts/.tmp-payout-e2e-tenant.txt' -Raw).Trim()
  if (-not $effTenant) { throw 'tenant efetivo do self-seed não emitido' }
  $env:E2E_TENANT_ID = $effTenant
  Write-Host "🔗 E2E_TENANT_ID = $effTenant" -ForegroundColor Cyan

  Write-Host '🧪 Rodando validate-pipeline-e2e-payout-toctou.ts ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-payout-toctou.ts
  if ($LASTEXITCODE -ne 0) { throw "toctou e2e falhou (rc=$LASTEXITCODE)" }
}
catch {
  $failed = $true
  Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  Remove-Item 'scripts/.tmp-payout-e2e-tenant.txt' -ErrorAction SilentlyContinue
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'PAYOUT TOCTOU SAFETY E2E em DB efêmera: OK' -ForegroundColor Green
exit 0
