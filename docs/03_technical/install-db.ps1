# ============================================
# CURSOR — INSTALAÇÃO BANCO UNIFICARD (FINAL)
# ============================================

$ErrorActionPreference = "Stop"
$env:PGCLIENTENCODING = "UTF8"

Write-Host "=== INSTALANDO BANCO UNIFICARD ===" -ForegroundColor Cyan

# Ajuste se necessário
$DB_NAME = "unificard"
$DB_USER = "postgres"
$MIGRATIONS_PATH = "backend/migrations"

# Verificação básica
if (!(Test-Path $MIGRATIONS_PATH)) {
    Write-Host "[X] Pasta migrations não encontrada" -ForegroundColor Red
    exit 1
}

# Lista hardcoded (ordem garantida)
$migrations = Get-ChildItem "$MIGRATIONS_PATH\*.sql" | Sort-Object Name

$total = $migrations.Count
$i = 1

foreach ($file in $migrations) {
    Write-Host "[$i/$total] Executando $($file.Name)" -ForegroundColor Gray
    psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f $file.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] ERRO ao executar $($file.Name)" -ForegroundColor Red
        exit 1
    }
    $i++
}

Write-Host ""
Write-Host "=== VERIFICANDO INSTALAÇÃO ===" -ForegroundColor Cyan

$tables = psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

$migs = psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM schema_migrations;"

Write-Host "Tabelas criadas: $($tables.Trim())"
Write-Host "Migrations registradas: $($migs.Trim())"

Write-Host ""
Write-Host "================================================"
Write-Host " BANCO DE DADOS INSTALADO COM SUCESSO " -ForegroundColor Green
Write-Host "================================================"
Write-Host ""
Write-Host "Próximo passo:"
Write-Host "1. Abra um terminal manualmente"
Write-Host "2. cd backend"
Write-Host "3. npm run dev"
