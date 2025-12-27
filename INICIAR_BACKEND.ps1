# Script para iniciar o backend Unificard
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO BACKEND UNIFICARD" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navegar para o diretório do backend
Set-Location "C:\unificard\backend"

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "[ERRO] node_modules nao encontrado!" -ForegroundColor Red
    Write-Host "Execute: npm install" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "✅ Dependencias encontradas" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando servidor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Mantenha esta janela aberta!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Aguarde ver: '✅ SERVIDOR INICIADO COM SUCESSO'" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Iniciar o servidor
npm run dev













