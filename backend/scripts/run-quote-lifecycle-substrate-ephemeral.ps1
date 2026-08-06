# run-quote-lifecycle-substrate-ephemeral.ps1
# F-SERVICE-DEMAND-QUOTE-LIFECYCLE — prova de COMPORTAMENTO do substrato (migration 20260806120000),
# em DB EFEMERA. NUNCA toca unificard_dev (LEIS_OPERACIONAIS — REGRA DE AMBIENTE).
#
# 🔴 CABECALHO REESCRITO ANTES DO CODIGO (padrao de 2026-08-06: copiar harness propaga DESCRICAO).
# As provas que este harness realmente executa:
#   A1  offering_id + asset_id juntos          -> DEVE FALHAR (CHECK de exclusividade morde)
#   B1  so offering_id                          -> DEVE PASSAR
#   B2  so asset_id                             -> DEVE PASSAR  (a metade LOCACAO, ADENDO 5c)
#   C1  expires_at omitido                      -> DEVE FALHAR (NOT NULL sem default: omissao grita)
#   D1  demanda com target_actor_id             -> DEVE PASSAR (dirigida)
#   D2  demanda sem target_actor_id             -> segue BROADCAST (nada regride)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_quote_lifecycle_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo e unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Sql([string]$url, [string]$sql) {
  $env:__SQL_URL = $url; $env:__SQL_TEXT = $sql
  node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.__SQL_URL});await c.connect();await c.query(process.env.__SQL_TEXT);await c.end();})().catch(e=>{console.error(e.message);process.exit(1);});"
  if ($LASTEXITCODE -ne 0) { throw "sql falhou: $sql" }
}

$failed = $false
try {
  Write-Host "Criando DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Sql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Sql $adminUrl "CREATE DATABASE $EPHEMERAL"
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'
  Write-Host 'Aplicando migrations VIVAS FULL ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }
  Write-Host 'Rodando provas do substrato ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-quote-lifecycle-substrate.ts
  if ($LASTEXITCODE -ne 0) { throw "provas falharam (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red }
finally {
  $env:DATABASE_URL = $baseUrl
  Remove-Item Env:EXPECTED_DATABASE_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:MIGRATION_PROFILE -ErrorAction SilentlyContinue
  Write-Host "Destruindo DB efemera $EPHEMERAL ..." -ForegroundColor Cyan
  try { Invoke-Sql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host 'aviso: drop da efemera falhou' -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'F-SERVICE-DEMAND-QUOTE-LIFECYCLE (substrato): provas OK em DB efemera.' -ForegroundColor Green
