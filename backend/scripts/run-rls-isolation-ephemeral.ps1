# run-rls-isolation-ephemeral.ps1
# F-DB-ROLE-AND-RLS-HARDENING — roda a prova material de RLS/role em DB EFÊMERA.
# Cria 1 DB efêmera, migra FULL (cria unificard_app + RLS), roda validate-rls-tenant-isolation.ts, dropa.
# NUNCA toca unificard_dev (o teste também tem assertEphemeral). NÃO move dinheiro. NÃO liga worker.
# Uso: pwsh -File scripts/run-rls-isolation-ephemeral.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_rls_hardening_e2e"
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

  Write-Host '📦 Aplicando migrations FULL na DB efêmera ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Rodando validate-rls-tenant-isolation.ts ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-rls-tenant-isolation.ts
  if ($LASTEXITCODE -ne 0) { throw "RLS isolation test falhou (rc=$LASTEXITCODE)" }
}
catch {
  $failed = $true
  Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'RLS TENANT ISOLATION (DB role hardening) em DB efêmera: OK' -ForegroundColor Green
exit 0
