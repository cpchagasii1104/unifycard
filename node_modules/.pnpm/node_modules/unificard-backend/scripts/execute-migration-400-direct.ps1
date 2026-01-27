# Execucao direta da migracao 400
$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Split-Path -Parent $scriptPath
$envFile = Join-Path $backendPath ".env"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRACAO FASE 1 - BACKFILL CATEGORIAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $envFile)) {
    Write-Host "ERRO: Arquivo .env nao encontrado" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch "DATABASE_URL=([^\r\n]+)") {
    Write-Host "ERRO: DATABASE_URL nao encontrada" -ForegroundColor Red
    exit 1
}

$databaseUrl = $matches[1].Trim()

if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
    $dbName = $matches[5]
} else {
    Write-Host "ERRO: DATABASE_URL invalida" -ForegroundColor Red
    exit 1
}

Write-Host "Conectando ao banco:" -ForegroundColor Cyan
Write-Host "  Host: $dbHost" -ForegroundColor Gray
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host ""

$migrationFile = Join-Path $backendPath "migrations\400_backfill_catalog_categories_to_core.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERRO: Arquivo de migracao nao encontrado" -ForegroundColor Red
    exit 1
}

$env:PGPASSWORD = $dbPassword

Write-Host "Verificando dados em catalog_categories..." -ForegroundColor Cyan
$checkQuery = "SELECT COUNT(*) FROM catalog_categories;"
$checkResult = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $checkQuery 2>&1
$checkCount = [int]($checkResult -replace '\s+', '')

if ($checkCount -eq 0) {
    Write-Host "AVISO: Nenhuma categoria encontrada em catalog_categories" -ForegroundColor Yellow
    Write-Host "A migracao sera executada mas nao migrara dados" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Executando migracao..." -ForegroundColor Cyan

# Executar migracao ignorando NOTICE (sao informativos, nao erros)
$ErrorActionPreference = "SilentlyContinue"
$output = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1 | Where-Object { $_ -notmatch "^psql:" }
$exitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

# Mostrar saida
if ($output) {
    $outputLines = $output -split "`r?`n"
    foreach ($line in $outputLines) {
        if ($line -match "NOTA:|NOTICE:") {
            Write-Host $line -ForegroundColor Gray
        } elseif ($line -match "ERRO|ERROR|FATAL|EXCEPTION") {
            Write-Host $line -ForegroundColor Red
        } elseif ($line -match "COMMIT|SUCESSO|PASSARAM|TODAS AS VALIDACOES") {
            Write-Host $line -ForegroundColor Green
        } elseif ($line.Trim() -ne "") {
            Write-Host $line
        }
    }
}

# Verificar sucesso: exit code 0 OU presenca de COMMIT na saida
$outputText = if ($output) { $output -join "`n" } else { "" }
$migrationSuccess = ($exitCode -eq 0) -or ($outputText -match "COMMIT")

if ($migrationSuccess) {
    Write-Host ""
    Write-Host "Migracao executada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Executando validacoes..." -ForegroundColor Cyan
    Write-Host ""
    
    $q1 = "SELECT COUNT(*) FROM catalog_categories;"
    $q2 = "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories';"
    $q3 = "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NULL;"
    $q4 = "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NOT NULL;"
    $q5 = "SELECT slug, country_code, COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' GROUP BY slug, country_code HAVING COUNT(*) > 1;"
    
    Write-Host "1) Total origem:" -ForegroundColor Yellow
    $r1 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $q1 2>&1
    Write-Host "  $r1" -ForegroundColor White
    Write-Host ""
    
    Write-Host "2) Total migrado:" -ForegroundColor Yellow
    $r2 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $q2 2>&1
    Write-Host "  $r2" -ForegroundColor White
    Write-Host ""
    
    Write-Host "3) Raizes:" -ForegroundColor Yellow
    $r3 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $q3 2>&1
    Write-Host "  $r3" -ForegroundColor White
    Write-Host ""
    
    Write-Host "4) Subcategorias:" -ForegroundColor Yellow
    $r4 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $q4 2>&1
    Write-Host "  $r4" -ForegroundColor White
    Write-Host ""
    
    Write-Host "5) Slugs duplicados (DEVE SER ZERO):" -ForegroundColor Yellow
    $r5 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $q5 2>&1
    if ($r5 -match "error|ERROR") {
        Write-Host "  ERRO: $r5" -ForegroundColor Red
    } elseif ([string]::IsNullOrWhiteSpace($r5)) {
        Write-Host "  0 (nenhum duplicado - OK)" -ForegroundColor Green
    } else {
        Write-Host "  $r5" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "MIGRACAO CONCLUIDA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERRO ao executar migracao (codigo: $exitCode)" -ForegroundColor Red
    exit 1
}

$env:PGPASSWORD = $null
