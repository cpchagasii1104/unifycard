# run-product-offer-direct-http-ephemeral.ps1
# Orquestra o E2E F-PRODUCT-OFFER-DIRECT-HTTP-E2E-PROOF (endpoint direto POST /marketplace/offerings/product)
# em DB EFÊMERA:
#   1. cria DB efêmera (drop se existir);
#   2. aplica TODAS as migrations (runner produtivo, perfil FULL) contra a DB efêmera;
#   3. roda o e2e (validate-pipeline-e2e-product-offer-direct-http.ts);
#   4. dropa a DB efêmera SEMPRE (finally).
# NUNCA toca unificard_dev. Uso: pwsh -File scripts/run-product-offer-direct-http-ephemeral.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

# Carrega DATABASE_URL base do .env
$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
# Extrai prefixo (tudo até a última /) e troca o nome do banco
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_product_offer_direct_http_e2e"
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

$failed = $false
try {
  Write-Host "🧱 Criando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL"
  Invoke-Psql $adminUrl "CREATE DATABASE $EPHEMERAL"

  $env:DATABASE_URL = $ephUrl
  $env:EXPECTED_DATABASE_NAME = $EPHEMERAL
  $env:MIGRATION_PROFILE = 'FULL'

  Write-Host '📦 Aplicando migrations na DB efêmera ...' -ForegroundColor Cyan
  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate falhou (rc=$LASTEXITCODE)" }

  Write-Host '🧪 Rodando e2e product-offer DIRECT HTTP (PJ-only + ramo + W1) ...' -ForegroundColor Cyan
  npx tsx src/scripts/validate-pipeline-e2e-product-offer-direct-http.ts
  if ($LASTEXITCODE -ne 0) { throw "e2e falhou (rc=$LASTEXITCODE)" }
}
catch {
  $failed = $true
  Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E PRODUCT-OFFER DIRECT HTTP (PJ-only + ramo + W1): OK' -ForegroundColor Green
exit 0
