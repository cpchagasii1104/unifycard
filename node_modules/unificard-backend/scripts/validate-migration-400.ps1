# Validacoes pos-migracao
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Split-Path -Parent $scriptPath
$envFile = Join-Path $backendPath ".env"

$envContent = Get-Content $envFile -Raw
if ($envContent -match "DATABASE_URL=([^\r\n]+)") {
    $databaseUrl = $matches[1].Trim()
    if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
        $dbUser = $matches[1]
        $dbPassword = $matches[2]
        $dbHost = $matches[3]
        $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
        $dbName = $matches[5]
        
        $env:PGPASSWORD = $dbPassword
        
        Write-Host "1) Total origem:"
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT COUNT(*) FROM catalog_categories;"
        
        Write-Host "2) Total migrado:"
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories';"
        
        Write-Host "3) Raizes:"
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NULL;"
        
        Write-Host "4) Subcategorias:"
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' AND parent_id IS NOT NULL;"
        
        Write-Host "5) Slugs duplicados:"
        $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT slug, country_code, COUNT(*) FROM categories WHERE metadata->>'legacy_source' = 'catalog_categories' GROUP BY slug, country_code HAVING COUNT(*) > 1;"
        if ([string]::IsNullOrWhiteSpace($result)) {
            Write-Host "0 (nenhum duplicado)"
        } else {
            Write-Host $result
        }
        
        $env:PGPASSWORD = $null
    }
}



