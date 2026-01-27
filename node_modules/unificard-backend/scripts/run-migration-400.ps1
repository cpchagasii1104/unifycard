# Script para executar migração 400 diretamente via psql
# Uso: .\backend\scripts\run-migration-400.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRAÇÃO FASE 1 - BACKFILL CATEGORIAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se DATABASE_URL está configurada
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "DATABASE_URL=(.+)") {
        $databaseUrl = $matches[1].Trim()
        Write-Host "✓ DATABASE_URL encontrada no .env" -ForegroundColor Green
    } else {
        Write-Host "⚠ DATABASE_URL não encontrada no .env" -ForegroundColor Yellow
        Write-Host "Por favor, forneça as credenciais do banco:" -ForegroundColor Yellow
        $dbHost = Read-Host "Host"
        $dbPort = Read-Host "Port (padrão: 5432)"
        $dbName = Read-Host "Database"
        $dbUser = Read-Host "User"
        $dbPassword = Read-Host "Password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
        $dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        $databaseUrl = "postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:$($dbPort):5432/$dbName"
    }
} else {
    Write-Host "⚠ Arquivo .env não encontrado" -ForegroundColor Yellow
    Write-Host "Por favor, forneça as credenciais do banco:" -ForegroundColor Yellow
    $dbHost = Read-Host "Host"
    $dbPort = Read-Host "Port (padrão: 5432)"
    $dbName = Read-Host "Database"
    $dbUser = Read-Host "User"
    $dbPassword = Read-Host "Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
    $dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    $databaseUrl = "postgresql://${dbUser}:${dbPasswordPlain}@${dbHost}:$($dbPort):5432/$dbName"
}

# Extrair componentes da URL
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
    $dbName = $matches[5]
} else {
    Write-Host "❌ Erro: DATABASE_URL inválida" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Conectando ao banco:" -ForegroundColor Cyan
Write-Host "  Host: $dbHost" -ForegroundColor Gray
Write-Host "  Port: $dbPort" -ForegroundColor Gray
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host "  User: $dbUser" -ForegroundColor Gray
Write-Host ""

$migrationFile = Join-Path $PSScriptRoot "..\migrations\400_backfill_catalog_categories_to_core.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Erro: Arquivo de migração não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Executando migração: $migrationFile" -ForegroundColor Cyan
Write-Host ""

# Executar migração
$env:PGPASSWORD = $dbPassword
try {
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Migração executada com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Executando validações..." -ForegroundColor Cyan
        Write-Host ""
        
        # Validações
        $validationQueries = @(
            @{Name="1) Total origem"; Query="SELECT COUNT(*) FROM catalog_categories;"},
            @{Name="2) Total migrado"; Query="SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories';"},
            @{Name="3) Raízes"; Query="SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NULL;"},
            @{Name="4) Subcategorias"; Query="SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NOT NULL;"},
            @{Name="5) Slugs duplicados"; Query="SELECT slug, country_code, COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' GROUP BY slug, country_code HAVING COUNT(*) > 1;"}
        )
        
        foreach ($val in $validationQueries) {
            Write-Host "$($val.Name):" -ForegroundColor Yellow
            $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $val.Query
            Write-Host $result -ForegroundColor White
            Write-Host ""
        }
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "MIGRAÇÃO CONCLUÍDA" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Erro ao executar migração (código: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erro ao executar migração: $_" -ForegroundColor Red
    exit 1
} finally {
    $env:PGPASSWORD = $null
}



