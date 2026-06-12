# run-media-migration-backfill-ephemeral.ps1
# Orquestrador do E2E de BACKFILL LEGADO das migrations de midia (374/375/376)
# - F-CANONICAL-MEDIA-CONTEXT-IDENTITY-V2-COLLISION-SAFE-CLOSURE (GO secao 6).
# Cria DUAS DBs EFEMERAS (caminho feliz + fail-closed); o proprio e2e orquestra
# os migrates parciais/completos via MIGRATION_STOP_BEFORE. NUNCA toca unificard_dev.
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

$baseUrl = ((Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim()
if (-not $baseUrl) { throw 'DATABASE_URL nao encontrada em backend/.env' }

$prefix = $baseUrl.Substring(0, $baseUrl.LastIndexOf('/') + 1)
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$dbA = "unificard_media_backfill_$stamp"
$dbB = "unificard_media_backfill_fc_$stamp"
foreach ($n in @($dbA, $dbB)) { if ($n -eq 'unificard_dev') { throw 'ABORT: nome efemero colidiu com unificard_dev.' } }

$maintUrl = $prefix + 'postgres'

Write-Host "DBs efemeras: $dbA (feliz) / $dbB (fail-closed)" -ForegroundColor Cyan

$exitCode = 1
try {
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbA;" | Out-Null
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbB;" | Out-Null
    Write-Host "DBs criadas (VAZIAS - o e2e migra por fases)" -ForegroundColor Green

    $env:DATABASE_URL = $prefix + $dbA
    $env:EXPECTED_DATABASE_NAME = $dbA
    $env:BACKFILL_FC_DATABASE_URL = $prefix + $dbB
    $env:BACKFILL_FC_DATABASE_NAME = $dbB
    $env:MIGRATION_PROFILE = 'FULL'
    $env:NODE_ENV = 'development'
    Remove-Item Env:PILOT_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:MIGRATION_STOP_BEFORE -ErrorAction SilentlyContinue

    Push-Location $backend
    try {
        Write-Host "e2e backfill legado (fases A e B)..." -ForegroundColor Yellow
        & npx tsx src/scripts/validate-pipeline-e2e-media-migration-backfill-legacy.ts
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
        Remove-Item Env:BACKFILL_FC_DATABASE_URL -ErrorAction SilentlyContinue
        Remove-Item Env:BACKFILL_FC_DATABASE_NAME -ErrorAction SilentlyContinue
        Remove-Item Env:MIGRATION_STOP_BEFORE -ErrorAction SilentlyContinue
    }
}
finally {
    foreach ($n in @($dbA, $dbB)) {
        try {
            & $psql $maintUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $n WITH (FORCE);" | Out-Null
            Write-Host "DB efemera dropada: $n" -ForegroundColor Green
        }
        catch {
            Write-Host "Falha ao dropar $n - drope manualmente." -ForegroundColor Red
        }
    }
}

if ($exitCode -ne 0) { Write-Host "backfill legado falhou (exit $exitCode)" -ForegroundColor Red; exit $exitCode }
Write-Host "backfill legado de midia verde." -ForegroundColor Green
exit 0
