# Verificar e registrar migracao 400
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
        
        $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT filename FROM schema_migrations WHERE filename = '400_backfill_catalog_categories_to_core.sql';"
        
        if ([string]::IsNullOrWhiteSpace($result)) {
            Write-Host "Migracao 400 nao registrada - registrando..."
            psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "INSERT INTO schema_migrations (filename, executed_at) VALUES ('400_backfill_catalog_categories_to_core.sql', NOW()) ON CONFLICT (filename) DO NOTHING;"
            Write-Host "Migracao 400 registrada"
        } else {
            Write-Host "Migracao 400 ja registrada"
        }
        
        $env:PGPASSWORD = $null
    }
}



