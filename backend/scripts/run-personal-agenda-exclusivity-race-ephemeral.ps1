# run-personal-agenda-exclusivity-race-ephemeral.ps1
# DECISION-0196 §D.1 — a agenda pessoal virou contratavel; esta e a PROVA DE CORRIDA que a
# DECISION-0146 §A.8/G7 exige ("cenario de concorrencia deve ser PROVADO").
# NUNCA toca unificard_dev (LEIS_OPERACIONAIS — REGRA DE AMBIENTE).
#
# 🔴 CABECALHO REESCRITO ANTES DO CODIGO (padrao 2026-08-06: copiar harness propaga DESCRICAO).
# As provas que ESTE harness executa:
#   R  duas confirmacoes SIMULTANEAS, mesmo actor, janelas SOBREPOSTAS -> exatamente UMA confirma
#      + a recusa e NOMEADA (BOOKING_PROVIDER_TIME_CONFLICT) + o BANCO tem 1, sem meia-escrita
#   S  janelas do mesmo actor SEM sobreposicao                         -> AS DUAS confirmam
#   T  back-to-back (fim == inicio)                                    -> AS DUAS confirmam (G8)
# S e T sao a metade que NAO grita: trava nova bloqueia quem pode tao facilmente quanto libera
# quem nao pode, e so a segunda falha aparece na tela.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_agenda_race_e2e"
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
  Write-Host 'Provocando a corrida ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-personal-agenda-exclusivity-race.ts
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
Write-Host 'AGENDA PESSOAL: exclusividade provada SOB CORRIDA em DB efemera.' -ForegroundColor Green
