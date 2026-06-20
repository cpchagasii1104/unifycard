# run-payout-proof-e2e-ephemeral.ps1
# F-ACTOR-WALLET-PAYOUT-PROOF-WIRING — orquestra os E2Es comportamentais de payout/recovery em DB EFÊMERA.
# Cria 1 DB efêmera, migra FULL, roda F2 (request) + F3 (execution) + C3 (debit recovery) + C7 (finalization),
# e dropa. NUNCA toca unificard_dev (cada E2E também tem assertEphemeral como segunda barreira).
# NÃO liga ENABLE_PAYOUT_WORKER, NÃO semeia PORTA-1 de produção, NÃO move dinheiro real (DB descartável).
# Uso: pwsh -File scripts/run-payout-proof-e2e-ephemeral.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_payout_proof_e2e"
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

$E2ES = @(
  'src/scripts/validate-pipeline-e2e-f2-actor-wallet-payout-request.ts',
  'src/scripts/validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts',
  'src/scripts/validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts',
  'src/scripts/validate-pipeline-e2e-c7-recovery-finalization.ts'
)

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

  Write-Host '🌱 Self-seed do grafo mínimo (canônico) na DB efêmera ...' -ForegroundColor Cyan
  Remove-Item 'scripts/.tmp-payout-e2e-tenant.txt' -ErrorAction SilentlyContinue
  npx tsx src/scripts/test-support/payout-e2e-self-seed.ts
  if ($LASTEXITCODE -ne 0) { throw "self-seed falhou (rc=$LASTEXITCODE)" }

  # tenant efetivo (resolvido server-side pelo register) → repassar aos E2Es.
  $effTenant = (Get-Content 'scripts/.tmp-payout-e2e-tenant.txt' -Raw).Trim()
  if (-not $effTenant) { throw 'tenant efetivo do self-seed não emitido' }
  $env:E2E_TENANT_ID = $effTenant
  Write-Host "🔗 E2E_TENANT_ID = $effTenant (tenant efetivo do self-seed)" -ForegroundColor Cyan

  foreach ($e2e in $E2ES) {
    Write-Host "🧪 Rodando $e2e ..." -ForegroundColor Cyan
    npx tsx $e2e
    if ($LASTEXITCODE -ne 0) { throw "e2e falhou: $e2e (rc=$LASTEXITCODE)" }
  }
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
Write-Host 'PAYOUT PROOF E2E (F2/F3/C3/C7) em DB efêmera: OK' -ForegroundColor Green
exit 0
