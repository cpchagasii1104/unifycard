# run-group-membership-cutover-ephemeral.ps1
# D9.2-B · DECISION-0188 — E2E do CUTOVER Actor-first da membership em DB EFÊMERA FRESCA.
# Mecanismo governado (precedente actor-page/FULL): cria DB nova, aplica TODAS as migrations
# pelo runner produtivo (MIGRATION_PROFILE=FULL — inclui D9.1, D9.2-A e o cutover 20260723160000),
# roda o e2e e DESTRÓI a DB com prova de inexistência. NUNCA toca unificard_dev.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_gmc_cutover_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

function Invoke-Psql([string]$url, [string]$sql) {
  $node = @"
const { Client } = require('pg');
(async () => { const c = new Client({ connectionString: '$url' }); await c.connect(); await c.query('$sql'); await c.end(); })().catch(e => { console.error(e.message); process.exit(1); });
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
  Write-Host '📦 Aplicando TODAS as migrations (FULL — inclui cutover D9.2-B) ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }
  Write-Host '🧪 Rodando e2e group-membership-cutover ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-group-membership-cutover.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
  $gone = @"
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$adminUrl'});await c.connect();
const r=await c.query("select count(*)::int n from pg_database where datname='$EPHEMERAL'");await c.end();
if(Number(r.rows[0].n)!==0){console.error('RESIDUO: DB efêmera ainda existe');process.exit(1);}
console.log('DB efêmera destruída: 0 resíduo');
})().catch(e=>{console.error(e.message);process.exit(1);});
"@
  $gone | node -
  if ($LASTEXITCODE -ne 0) { $failed = $true }
}
if ($failed) { exit 1 }
Write-Host 'E2E GROUP-MEMBERSHIP-CUTOVER: OK' -ForegroundColor Green
exit 0
