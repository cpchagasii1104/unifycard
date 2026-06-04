# run-pj-verification-display-ephemeral.ps1
# Orquestrador da validação DECISION-0089 Fase 1 (kyb_status como fonte visual de verificação PJ).
# Cria DB EFÊMERA, migra FULL, roda o teste do read-model e DROPA a DB no fim. NUNCA toca unificard_dev.
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

$baseUrl = ((Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim()
if (-not $baseUrl) { throw 'DATABASE_URL não encontrada em backend/.env' }

$prefix = $baseUrl.Substring(0, $baseUrl.LastIndexOf('/') + 1)
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$dbName = "unificard_verif_display_$stamp"
if ($dbName -eq 'unificard_dev') { throw 'ABORT: nome efêmero colidiu com unificard_dev.' }

$maintUrl = $prefix + 'postgres'
$ephUrl = $prefix + $dbName

Write-Host "🧪 DB efêmera: $dbName" -ForegroundColor Cyan

$exitCode = 1
try {
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName;" | Out-Null
    Write-Host "✅ DB criada" -ForegroundColor Green

    $env:DATABASE_URL = $ephUrl
    $env:MIGRATION_PROFILE = 'FULL'
    $env:EXPECTED_DATABASE_NAME = $dbName
    $env:NODE_ENV = 'development'
    Remove-Item Env:PILOT_MODE -ErrorAction SilentlyContinue

    Push-Location $backend
    try {
        Write-Host "⏳ migrate (FULL)..." -ForegroundColor Yellow
        & npx tsx src/core/db/migrate.ts
        if ($LASTEXITCODE -ne 0) { throw "migrate falhou (exit $LASTEXITCODE)" }

        Write-Host "⏳ teste DECISION-0089 Fase 1 (read-model verificação)..." -ForegroundColor Yellow
        & npx tsx src/scripts/validate-pipeline-e2e-pj-verification-display.ts
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    try {
        & $psql $maintUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $dbName WITH (FORCE);" | Out-Null
        Write-Host "🧹 DB efêmera dropada: $dbName" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Falha ao dropar $dbName — drope manualmente." -ForegroundColor Red
    }
}

if ($exitCode -ne 0) { Write-Host "❌ DECISION-0089 Fase 1 falhou (exit $exitCode)" -ForegroundColor Red; exit $exitCode }
Write-Host "✨ DECISION-0089 Fase 1 verde." -ForegroundColor Green
exit 0
