# run-rental-exclusivity-guarantee-ephemeral.ps1
# F-RENTAL-EXCLUSIVITY-GUARANTEE — valida a migration 20260806010000 em DB EFEMERA.
# NUNCA toca unificard_dev (LEIS_OPERACIONAIS — REGRA DE AMBIENTE).
#
# Prova os DOIS sentidos, nao so o verde:
#   A1  vehicle  + quantity>1  -> DEVE FALHAR (a garantia migrada morde)
#   A2  property + quantity>1  -> DEVE FALHAR
#   A3  space    + quantity>1  -> DEVE FALHAR
#   A4  equipment+ quantity>1  -> DEVE PASSAR (fungivel e legitimo)
#   A5  vehicle  + quantity=1  -> DEVE PASSAR
#   B1  a EXCLUDE availability_rental_no_overlap NAO existe mais
#   B2  duas janelas ATIVAS sobrepostas de rentable_resource entram no banco
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_rental_excl_e2e"
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
  Write-Host 'Rodando provas dos dois sentidos ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-rental-exclusivity-guarantee.ts
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
Write-Host 'F-RENTAL-EXCLUSIVITY-GUARANTEE: provas OK em DB efemera.' -ForegroundColor Green
