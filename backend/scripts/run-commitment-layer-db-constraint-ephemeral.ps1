# run-commitment-layer-db-constraint-ephemeral.ps1
# DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT — valida a migration 20260806220000 em DB EFEMERA.
# NUNCA toca unificard_dev (LEIS_OPERACIONAIS — REGRA DE AMBIENTE).
#
# Prova os DOIS sentidos:
#   N  escrita CRUA sobreposta do mesmo recurso  -> o BANCO recusa (o que o lock nao alcanca)
#   N2 compromisso sem intervalo materializado   -> CHECK recusa (anti range ilimitado)
#   P  back-to-back / outro recurso / outro tenant / status nao-bloqueante / recurso NULO /
#      confirmed->checked_in->checked_out / cancelar libera  -> TODOS PASSAM
#   F  equipment quantity=10 confirma as DUAS sobrepostas (fungivel intacto);
#      vehicle recusa a 2a pelo erro NOMEADO do app (banco e backstop, nao UX)
#   A  o ramo provider materializa booked_* e commitment_resource_id
#   D  editar a janela depois do compromisso NAO abre double-booking (metade do obstaculo 4)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_commit_db_e2e"
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
  npx tsx src/scripts/validate-commitment-layer-db-constraint.ts
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
Write-Host 'DT-COMMITMENT-LAYER-DB-CONSTRAINT: provas OK em DB efemera.' -ForegroundColor Green
