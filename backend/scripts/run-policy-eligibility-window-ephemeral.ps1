# run-policy-eligibility-window-ephemeral.ps1
# Valida a migration do PRAZO da linha de política em DB EFÊMERA. NUNCA toca unificard_dev.
#
# Por que efêmero: `LEIS_OPERACIONAIS` — REGRA DE AMBIENTE. `unificard_dev` é o banco OFICIAL com
# dado curado insubstituível (75 bairros de Curitiba selados, 48 policies). Migration se valida
# onde a perda é zero.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_policy_window_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Node([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); await c.query(``$sql``); await c.end(); })().catch(e => { console.error(e.message); process.exit(1); });
"@
  $node | node -
  if ($LASTEXITCODE -ne 0) { throw "sql falhou: $sql" }
}

$failed = $false
try {
  Write-Host "🧱 Criando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Node $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Node $adminUrl "CREATE DATABASE $EPHEMERAL"
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'

  Write-Host '📦 Aplicando migrations VIVAS FULL ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Provando a coluna e a trava ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-policy-eligibility-window.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  $env:DATABASE_URL = $baseUrl
  Remove-Item Env:EXPECTED_DATABASE_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:MIGRATION_PROFILE -ErrorAction SilentlyContinue
  Write-Host "🧹 Destruindo DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  try { Invoke-Node $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL" } catch { Write-Host "aviso: falha ao destruir" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host '✅ migration do prazo validada em efêmera' -ForegroundColor Green
