# run-migration-runner-isolation-ephemeral.ps1
# Orquestrador do E2E F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE (P1-P10):
# runner produtivo SEM truncamento + tooling test-only com guardas fail-closed.
# Cria DUAS DBs EFEMERAS e dropa ao final. NUNCA toca unificard_dev.
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

$baseUrl = ((Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim()
if (-not $baseUrl) { throw 'DATABASE_URL nao encontrada em backend/.env' }

$prefix = $baseUrl.Substring(0, $baseUrl.LastIndexOf('/') + 1)
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$db1 = "unificard_runner_iso_test1_$stamp"
$db2 = "unificard_runner_iso_test2_$stamp"
foreach ($n in @($db1, $db2)) { if ($n -eq 'unificard_dev') { throw 'ABORT: nome efemero colidiu com unificard_dev.' } }

$maintUrl = $prefix + 'postgres'

Write-Host "DBs efemeras: $db1 / $db2" -ForegroundColor Cyan

$exitCode = 1
try {
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db1;" | Out-Null
    & $psql $maintUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db2;" | Out-Null
    Write-Host "DBs criadas (VAZIAS - o e2e orquestra os runners)" -ForegroundColor Green

    $env:DATABASE_URL = $prefix + $db1
    $env:RUNNER_ISO_DB1_URL = $prefix + $db1
    $env:RUNNER_ISO_DB1_NAME = $db1
    $env:RUNNER_ISO_DB2_URL = $prefix + $db2
    $env:RUNNER_ISO_DB2_NAME = $db2
    $env:MIGRATION_PROFILE = 'FULL'
    $env:NODE_ENV = 'development'
    Remove-Item Env:PILOT_MODE -ErrorAction SilentlyContinue

    Push-Location $backend
    try {
        Write-Host "e2e runner isolation (P1-P10)..." -ForegroundColor Yellow
        & npx tsx src/scripts/validate-pipeline-e2e-migration-runner-isolation.ts
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
        foreach ($v in @('RUNNER_ISO_DB1_URL','RUNNER_ISO_DB1_NAME','RUNNER_ISO_DB2_URL','RUNNER_ISO_DB2_NAME')) {
            Remove-Item "Env:$v" -ErrorAction SilentlyContinue
        }
    }
}
finally {
    foreach ($n in @($db1, $db2)) {
        try {
            & $psql $maintUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $n WITH (FORCE);" | Out-Null
            Write-Host "DB efemera dropada: $n" -ForegroundColor Green
        }
        catch {
            Write-Host "Falha ao dropar $n - drope manualmente." -ForegroundColor Red
        }
    }
}

if ($exitCode -ne 0) { Write-Host "runner isolation falhou (exit $exitCode)" -ForegroundColor Red; exit $exitCode }
Write-Host "runner isolation verde." -ForegroundColor Green
exit 0
