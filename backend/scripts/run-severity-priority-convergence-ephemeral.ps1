# run-severity-priority-convergence-ephemeral.ps1
# Orquestra o E2E F-SEVERITY-CANONICAL-CONVERGENCE em DB EFÊMERA. NUNCA toca unificard_dev.
# Fase PRE: aplica todas as migrations EXCETO a de convergência, semeia audit_events com o
#           vocabulário antigo (low/medium/high/critical) — simula o unificard_dev de hoje.
# Fase POST: devolve a migration, reaplica (converte o dado semeado + troca CHECK/ENUM), confirma
#            remapeamento exato, rejeição do vocabulário antigo, aceitação do novo, e um
#            createAlert() real com e sem severity.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$envLine = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
if (-not $envLine) { Write-Host 'DATABASE_URL ausente no .env' -ForegroundColor Red; exit 1 }
$baseUrl = $envLine -replace '^DATABASE_URL=', ''
$prefix = $baseUrl -replace '/[^/]+$', ''
$adminUrl = "$prefix/postgres"
$EPHEMERAL = "unificard_severity_convergence_e2e"
$ephUrl = "$prefix/$EPHEMERAL"
if ($EPHEMERAL -eq 'unificard_dev') { Write-Host 'ABORT: alvo é unificard_dev' -ForegroundColor Red; exit 1 }

$migration = Join-Path $PSScriptRoot '..\migrations\20260731130000_severity_priority_canonical_convergence.sql'
$holdout = Join-Path $env:TEMP '20260731130000_severity_priority_canonical_convergence.sql.holdout'
$handoff = Join-Path $env:TEMP 'severity_convergence_e2e_tenant.json'

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
  if (Test-Path $handoff) { Remove-Item -Force $handoff }

  Write-Host '🔴 FASE PRE — retirando a migration de convergência antes de migrar ...' -ForegroundColor Cyan
  if (-not (Test-Path $migration)) { throw "migration não encontrada: $migration" }
  Move-Item -Force $migration $holdout

  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate (sem convergencia) falhou (rc=$LASTEXITCODE)" }

  npx tsx src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts pre
  if ($LASTEXITCODE -ne 0) { throw "e2e PRE falhou (rc=$LASTEXITCODE)" }

  Write-Host '🟢 FASE POST — devolvendo a migration e reaplicando ...' -ForegroundColor Cyan
  Move-Item -Force $holdout $migration

  npx tsx src/core/db/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migrate (com convergencia) falhou (rc=$LASTEXITCODE)" }

  npx tsx src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts post
  if ($LASTEXITCODE -ne 0) { throw "e2e POST falhou (rc=$LASTEXITCODE)" }
}
catch { $failed = $true; Write-Host "💥 $($_.Exception.Message)" -ForegroundColor Red }
finally {
  if (Test-Path $holdout) { Move-Item -Force $holdout $migration }
  if (Test-Path $handoff) { Remove-Item -Force $handoff }
  Write-Host "🧹 Dropando DB efêmera $EPHEMERAL ..." -ForegroundColor Cyan
  $env:DATABASE_URL = $baseUrl
  try { Invoke-Psql $adminUrl "DROP DATABASE IF EXISTS $EPHEMERAL WITH (FORCE)" } catch { Write-Host "aviso: drop falhou: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($failed) { exit 1 }
Write-Host 'E2E SEVERITY-PRIORITY-CONVERGENCE (PRE+POST): OK' -ForegroundColor Green
exit 0
