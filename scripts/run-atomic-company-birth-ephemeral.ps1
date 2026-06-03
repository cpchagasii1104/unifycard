# run-atomic-company-birth-ephemeral.ps1
# Orquestrador da validação F-ATOMIC-COMPANY-BIRTH (DECISION-0075 §9.2).
# Cria uma DB EFÊMERA, migra com MIGRATION_PROFILE=FULL, roda o teste de atomicidade
# do nascimento PJ e DROPA a DB no fim (try/finally). NUNCA toca unificard_dev.
#
# Uso:  pwsh -File scripts/run-atomic-company-birth-ephemeral.ps1
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

# URL base do .env (não imprime a senha)
$baseUrl = ((Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim()
if (-not $baseUrl) { throw 'DATABASE_URL não encontrada em backend/.env' }

$prefix = $baseUrl.Substring(0, $baseUrl.LastIndexOf('/') + 1)   # postgresql://user:pw@host:port/
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$dbName = "unificard_atomic_birth_$stamp"

if ($dbName -eq 'unificard_dev') { throw 'ABORT: nome efêmero colidiu com unificard_dev.' }

$maintUrl = $prefix + 'postgres'
$ephUrl = $prefix + $dbName

Write-Host "🧪 DB efêmera: $dbName" -ForegroundColor Cyan

$exitCode = 1
try {
    # 1) Criar DB efêmera
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName;" | Out-Null
    Write-Host "✅ DB criada" -ForegroundColor Green

    # 2) Migrar (FULL) — env do filho aponta para a efêmera
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

        Write-Host "⏳ teste F-ATOMIC-COMPANY-BIRTH..." -ForegroundColor Yellow
        & npx tsx src/scripts/validate-pipeline-e2e-atomic-company-birth.ts
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    # 3) DROP da DB efêmera (sempre)
    try {
        & $psql $maintUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $dbName WITH (FORCE);" | Out-Null
        Write-Host "🧹 DB efêmera dropada: $dbName" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Falha ao dropar $dbName — drope manualmente." -ForegroundColor Red
    }
}

if ($exitCode -ne 0) { Write-Host "❌ F-ATOMIC-COMPANY-BIRTH falhou (exit $exitCode)" -ForegroundColor Red; exit $exitCode }
Write-Host "✨ F-ATOMIC-COMPANY-BIRTH verde." -ForegroundColor Green
exit 0
