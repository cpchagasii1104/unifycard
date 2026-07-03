# run-guc-cross-context-reset-on-reuse-ephemeral.ps1
# Orquestrador do E2E F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (achado A1 da re-auditoria).
# DB EFEMERA, migra FULL, roda com DATABASE_POOL_MAX=1 (reuso determinístico), DROPA.
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'
$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$baseUrl = ((Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim()
if (-not $baseUrl) { throw 'DATABASE_URL nao encontrada em backend/.env' }
$prefix = $baseUrl.Substring(0, $baseUrl.LastIndexOf('/') + 1)
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$dbName = "unificard_guc_reset_reuse_$stamp"
if ($dbName -eq 'unificard_dev') { throw 'ABORT: nome efemero colidiu com unificard_dev.' }
$maintUrl = $prefix + 'postgres'
$ephUrl = $prefix + $dbName
Write-Host "DB efemera: $dbName" -ForegroundColor Cyan
$exitCode = 1
try {
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName;" | Out-Null
    Write-Host "DB criada" -ForegroundColor Green
    $env:DATABASE_URL = $ephUrl
    $env:MIGRATION_PROFILE = 'FULL'
    $env:EXPECTED_DATABASE_NAME = $dbName
    $env:NODE_ENV = 'development'
    Remove-Item Env:PILOT_MODE -ErrorAction SilentlyContinue
    Push-Location $backend
    try {
        Write-Host "migrate (FULL)..." -ForegroundColor Yellow
        # migrate roda com pool default (nao precisa de max=1)
        & npx tsx src/core/db/migrate.ts
        if ($LASTEXITCODE -ne 0) { throw "migrate falhou (exit $LASTEXITCODE)" }
        Write-Host "e2e guc cross context reset on reuse (DATABASE_POOL_MAX=1)..." -ForegroundColor Yellow
        $env:DATABASE_POOL_MAX = '1'
        $env:DATABASE_POOL_MIN = '1'
        & npx tsx src/scripts/validate-pipeline-e2e-guc-cross-context-reset-on-reuse.ts
        $exitCode = $LASTEXITCODE
    }
    finally {
        Remove-Item Env:DATABASE_POOL_MAX -ErrorAction SilentlyContinue
        Remove-Item Env:DATABASE_POOL_MIN -ErrorAction SilentlyContinue
        Pop-Location
    }
}
finally {
    try { & $psql $maintUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $dbName WITH (FORCE);" | Out-Null; Write-Host "DB efemera dropada: $dbName" -ForegroundColor Green }
    catch { Write-Host "Falha ao dropar $dbName - drope manualmente." -ForegroundColor Red }
}
if ($exitCode -ne 0) { Write-Host "e2e guc cross context reset on reuse falhou (exit $exitCode)" -ForegroundColor Red; exit $exitCode }
Write-Host "e2e guc cross context reset on reuse verde." -ForegroundColor Green
exit 0
