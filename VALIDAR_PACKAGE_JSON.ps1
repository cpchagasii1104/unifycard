# Script para VALIDAR package.json antes de iniciar backend
# Execute na raiz do projeto

Write-Host "=== VALIDACAO DO package.json ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard\backend

# 1. Verificar se arquivo existe
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: package.json nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "1. Arquivo encontrado" -ForegroundColor Green

# 2. Verificar se tem '...' (três pontos)
Write-Host ""
Write-Host "2. Verificando se ha '...' (tres pontos)..." -ForegroundColor Yellow
$content = Get-Content "package.json" -Raw
if ($content -match '\.\.\.') {
    Write-Host "   ERRO: Encontrado '...' no arquivo!" -ForegroundColor Red
    Write-Host "   Localizacao:" -ForegroundColor Yellow
    $content | Select-String -Pattern '\.\.\.' -Context 2,2
    exit 1
} else {
    Write-Host "   OK: Nenhum '...' encontrado" -ForegroundColor Green
}

# 3. Validar JSON
Write-Host ""
Write-Host "3. Validando JSON..." -ForegroundColor Yellow
try {
    $json = $content | ConvertFrom-Json
    Write-Host "   JSON valido!" -ForegroundColor Green
} catch {
    Write-Host "   ERRO: JSON invalido!" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Verificar script 'dev'
Write-Host ""
Write-Host "4. Verificando script 'dev'..." -ForegroundColor Yellow
if (-not $json.scripts.dev) {
    Write-Host "   ERRO: Script 'dev' nao encontrado!" -ForegroundColor Red
    exit 1
}

$devScript = $json.scripts.dev
Write-Host "   Script atual:" -ForegroundColor White
Write-Host "   $devScript" -ForegroundColor Gray

# Verificar se aponta para src/server.ts
if ($devScript -notmatch 'src/server\.ts') {
    Write-Host "   AVISO: Script nao aponta para src/server.ts" -ForegroundColor Yellow
}

# Verificar se usa ts-node-dev
if ($devScript -notmatch 'ts-node-dev') {
    Write-Host "   AVISO: Script nao usa ts-node-dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== VALIDACAO CONCLUIDA ===" -ForegroundColor Green
Write-Host ""
Write-Host "Se tudo estiver OK, execute:" -ForegroundColor Cyan
Write-Host "  cd C:\unificard" -ForegroundColor White
Write-Host "  npm run dev -w unificard-backend" -ForegroundColor White













