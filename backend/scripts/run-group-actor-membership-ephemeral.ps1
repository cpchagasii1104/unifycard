# run-group-actor-membership-ephemeral.ps1
# D9.2-A · DECISION-0188 — E2E da fundação Actor-first DORMENTE em DB EFÊMERA.
# Mecanismo governado (precedente D9.1/FISCAL-4E): CLONE de unificard_dev (pg_dump plain — LEITURA),
# aplica a migration D9.1 (20260717120000) E DEPOIS a D9.2-A (20260718120000) SOMENTE no clone,
# roda o e2e e DESTRÓI o clone com prova de inexistência. NUNCA toca dev.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$baseUrl = ((Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', '')
if (-not $baseUrl) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_gam_membership_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }
$PGBIN = 'C:\Program Files\PostgreSQL\17\bin'
$MIG_D91 = 'migrations/20260717120000_group_institutional_bindings.sql'
$MIG_D92A = 'migrations/20260718120000_group_actor_memberships.sql'

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

  $verify = @"
const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ephUrl'});await c.connect();
const q=async(s)=>Number((await c.query(s)).rows[0].n);
const groups=await q("select count(*)::int n from pg_class where relname='groups'");
const gm=await q('select count(*)::int n from group_members');
const gi=await q("select count(*)::int n from pg_class where relname='group_invites'");
const fnassert=await q("select count(*)::int n from pg_proc where proname='fn_assert_actors_in_tenant'");
const approle=await q("select count(*)::int n from pg_roles where rolname='unificard_app'");
const gib=await q("select count(*)::int n from pg_class where relname='group_institutional_bindings'");
const gam=await q("select count(*)::int n from pg_class where relname='group_actor_memberships'");
await c.end();
if(groups<1||gi<1||fnassert<1||approle<1||gm<1){console.error('CLONE_INCOMPLETO groups='+groups+' gm='+gm+' gi='+gi+' fn='+fnassert+' role='+approle);process.exit(1);}
if(gib!==0||gam!==0){console.error('CLONE_DIVERGENTE: casas D9.1/D9.2-A ja existem antes das migrations');process.exit(1);}
console.log('clone fiel: legado presente · casas novas ausentes (pre-migrations)');
})().catch(e=>{console.error(e.message);process.exit(1);});
"@
  $verify | node -
  if ($LASTEXITCODE -ne 0) { throw "clone infiel" }

  Write-Host '📦 Aplicando migration D9.1 (dependência) SOMENTE no clone ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -v ON_ERROR_STOP=1 -q -f $MIG_D91
  if ($LASTEXITCODE -ne 0) { throw "migration D9.1 falhou (rc=$LASTEXITCODE)" }

  Write-Host '📦 Aplicando migration D9.2-A SOMENTE no clone ...' -ForegroundColor Cyan
  & "$PGBIN\psql.exe" --dbname=$ephUrl -v ON_ERROR_STOP=1 -q -f $MIG_D92A
  if ($LASTEXITCODE -ne 0) { throw "migration D9.2-A falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Rodando e2e group-actor-membership ...' -ForegroundColor Cyan
  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  npx tsx src/scripts/validate-pipeline-e2e-group-actor-membership.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL + limpando dump ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force -ErrorAction SilentlyContinue }
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
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
Write-Host 'E2E GROUP-ACTOR-MEMBERSHIP: OK' -ForegroundColor Green
exit 0
