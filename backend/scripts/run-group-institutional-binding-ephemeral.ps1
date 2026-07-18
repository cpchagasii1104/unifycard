# run-group-institutional-binding-ephemeral.ps1
# D9.1 · DECISION-0186/0187 — E2E do substrato group_institutional_bindings em DB EFÊMERA.
# Mecanismo governado (precedente FISCAL-4E / B-CITY-2): CLONE de unificard_dev (pg_dump plain —
# LEITURA, nunca modifica dev; corrige o search_path='' pinado pelo pg_dump17), aplica SOMENTE a
# migration nova via psql direto e DESTRÓI o clone (resíduo zero). NUNCA toca dev.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$baseUrl = ((Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', '')
if (-not $baseUrl) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_gib_binding_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }
$PGBIN = 'C:\Program Files\PostgreSQL\17\bin'
$MIG = 'migrations/20260717120000_group_institutional_bindings.sql'

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
  $txt = [System.IO.File]::ReadAllText($dumpFile)
  $txt = $txt.Replace("set_config('search_path', '', false)", "set_config('search_path', 'public, pg_catalog', false)")
  [System.IO.File]::WriteAllText($dumpFile, $txt)

  Write-Host '📦 Restaurando clone (best-effort; erros de dados legado de dev são benignos) ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -q -f $dumpFile 2>&1 | Select-String -Pattern 'ERRO|error' | Select-Object -First 3

  # GATE de fidelidade do clone: objetos essenciais do D9.1 presentes (senão STOP).
  $verify = @"
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ephUrl'});await c.connect();
const q=async(s)=>Number((await c.query(s)).rows[0].n);
const groups=await q("select count(*)::int n from pg_class where relname='groups'");
const uqa=await q("select count(*)::int n from pg_indexes where indexname='uq_actors_group'");
const uqg=await q("select count(*)::int n from pg_indexes where indexname='uq_groups_actor'");
const fnassert=await q("select count(*)::int n from pg_proc where proname='fn_assert_actors_in_tenant'");
const approle=await q("select count(*)::int n from pg_roles where rolname='unificard_app'");
const gib=await q("select count(*)::int n from pg_class where relname='group_institutional_bindings'");
const tenants=await q('select count(*)::int n from tenants');
await c.end();
if(groups<1||uqa<1||uqg<1||fnassert<1||approle<1||tenants<1){console.error('CLONE_INCOMPLETO groups='+groups+' uq_actors_group='+uqa+' uq_groups_actor='+uqg+' fn_assert='+fnassert+' app_role='+approle+' tenants='+tenants);process.exit(1);}
if(gib!==0){console.error('CLONE_DIVERGENTE: group_institutional_bindings JA existe antes da migration');process.exit(1);}
console.log('clone fiel: groups ok · 1:1 indexes ok · fn_assert ok · app role ok · gib ausente (pre-migration)');
})().catch(e=>{console.error(e.message);process.exit(1);});
"@
  $verify | node -
  if ($LASTEXITCODE -ne 0) { throw "clone infiel (objetos essenciais ausentes)" }

  Write-Host '📦 Aplicando SOMENTE a migration nova (psql direto, transacional) ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -v ON_ERROR_STOP=1 -q -f $MIG
  if ($LASTEXITCODE -ne 0) { throw "migration nova falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Rodando e2e group-institutional-binding ...' -ForegroundColor Cyan
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  npx tsx src/scripts/validate-pipeline-e2e-group-institutional-binding.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL + limpando dump ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force -ErrorAction SilentlyContinue }
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
  # prova de inexistência do clone
  $gone = @"
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$adminUrl'});await c.connect();
const r=await c.query("select count(*)::int n from pg_database where datname='$EPHEMERAL'");await c.end();
if(Number(r.rows[0].n)!==0){console.error('RESIDUO: DB efêmera ainda existe');process.exit(1);}
console.log('clone destruído: 0 residuo');
})().catch(e=>{console.error(e.message);process.exit(1);});
"@
  $gone | node -
  if ($LASTEXITCODE -ne 0) { $failed = $true }
}
if ($failed) { exit 1 }
Write-Host 'E2E GROUP-INSTITUTIONAL-BINDING: OK' -ForegroundColor Green
exit 0
