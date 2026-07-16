# run-regional-treasury-grant-substrate-ephemeral.ps1
# B-CITY-2 · DECISION-0185 — E2E do substrato dormente regional_treasury em DB EFÊMERA.
# Mecanismo governado (precedente FISCAL-4E): CLONE de unificard_dev (pg_dump plain — LEITURA, nunca
# modifica dev; corrige o search_path='' pinado pelo pg_dump17 p/ resolver unaccent em colunas geradas),
# aplica SOMENTE a migration nova via psql direto (migrate.ts FULL está quebrado numa migration pre-existente
# NAO-aplicada, 20260713140000), roda o e2e e DESTRÓI o clone (resíduo zero). NUNCA toca dev.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$baseUrl = ((Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', '')
if (-not $baseUrl) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_regional_treasury_grant_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }
$PGBIN = 'C:\Program Files\PostgreSQL\17\bin'
$MIG = 'migrations/20260716140000_regional_treasury_authority_grant_substrate.sql'

function Invoke-Psql([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); await c.query('$sql'); await c.end(); })().catch(e => { console.error(e.message); process.exit(1); });
"@
  $node | node -
  if ($LASTEXITCODE -ne 0) { throw "psql falhou: $sql" }
}

$failed = $false
$dumpFile = Join-Path $env:TEMP "unificard_dev_clone_$([guid]::NewGuid().ToString('N')).sql"
try {
  Write-Host "🧱 Criando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Psql $adminUrl "CREATE DATABASE $EPHEMERAL"

  Write-Host '📋 Clonando unificard_dev (pg_dump plain — leitura; dev intocado) ...' -ForegroundColor Cyan
  & "$PGBIN\pg_dump.exe" --dbname=$baseUrl --format=plain --file=$dumpFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (rc=$LASTEXITCODE)" }
  # pg_dump17 pina search_path='' (anti-injeção); repõe public,pg_catalog p/ resolver unaccent em colunas geradas.
  $txt = [System.IO.File]::ReadAllText($dumpFile)
  $txt = $txt.Replace("set_config('search_path', '', false)", "set_config('search_path', 'public, pg_catalog', false)")
  [System.IO.File]::WriteAllText($dumpFile, $txt)

  Write-Host '📦 Restaurando clone (best-effort; erros de dados legado de dev são benignos) ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -q -f $dumpFile 2>&1 | Select-String -Pattern 'ERRO|error' | Select-Object -First 3

  # GATE de fidelidade do clone: objetos essenciais presentes (senão STOP).
  $verify = @"
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ephUrl'});await c.connect();
const q=async(s)=>Number((await c.query(s)).rows[0].n);
const acg=await q("select count(*)::int n from pg_constraint where conrelid='actor_capability_grants'::regclass and contype='c'");
const cities=await q('select count(*)::int n from cities');
const states=await q('select count(*)::int n from states');
const tenants=await q('select count(*)::int n from tenants');
await c.end();
if(acg<7||cities<1||states<1||tenants<1){console.error('CLONE_INCOMPLETO acg='+acg+' cities='+cities+' states='+states+' tenants='+tenants);process.exit(1);}
console.log('clone fiel: acg_checks='+acg+' cities='+cities+' states='+states+' tenants='+tenants);
})().catch(e=>{console.error(e.message);process.exit(1);});
"@
  $verify | node -
  if ($LASTEXITCODE -ne 0) { throw "clone infiel (objetos essenciais ausentes)" }

  Write-Host '📦 Aplicando SOMENTE a migration nova (psql direto, transacional) ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -v ON_ERROR_STOP=1 -q -f $MIG
  if ($LASTEXITCODE -ne 0) { throw "migration nova falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Rodando e2e regional-treasury-grant-substrate ...' -ForegroundColor Cyan
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  npx tsx src/scripts/validate-pipeline-e2e-regional-treasury-grant-substrate.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL + limpando dump ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force -ErrorAction SilentlyContinue }
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E REGIONAL-TREASURY-GRANT-SUBSTRATE: OK' -ForegroundColor Green
exit 0
