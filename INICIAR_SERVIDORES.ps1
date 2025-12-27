# Script para iniciar Backend e Frontend do Unificard
# Execute este script para iniciar ambos os servidores

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Unificard - Iniciando Servidores" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se as portas estão em uso
$port3000 = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 3000 }
$port5173 = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5173 }

if ($port3000) {
    Write-Host "⚠️  Porta 3000 já está em uso (Backend pode estar rodando)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Porta 3000 disponível" -ForegroundColor Green
}

if ($port5173) {
    Write-Host "⚠️  Porta 5173 já está em uso (Frontend pode estar rodando)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Porta 5173 disponível" -ForegroundColor Green
}

Write-Host ""
Write-Host "Iniciando servidores..." -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos no diretório correto
$backendPath = "c:\unificard\backend"
$frontendPath = "c:\unificard\frontend"

if (-not (Test-Path $backendPath)) {
    Write-Host "❌ Erro: Diretório backend não encontrado: $backendPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $frontendPath)) {
    Write-Host "❌ Erro: Diretório frontend não encontrado: $frontendPath" -ForegroundColor Red
    exit 1
}

# Verificar se node_modules existe
if (-not (Test-Path "$backendPath\node_modules")) {
    Write-Host "⚠️  node_modules não encontrado no backend. Execute: cd $backendPath && npm install" -ForegroundColor Yellow
}

if (-not (Test-Path "$frontendPath\node_modules")) {
    Write-Host "⚠️  node_modules não encontrado no frontend. Execute: cd $frontendPath && npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instruções para iniciar:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Abra 2 terminais separados:" -ForegroundColor White
Write-Host ""
Write-Host "TERMINAL 1 - Backend:" -ForegroundColor Yellow
Write-Host "  cd c:\unificard\backend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "TERMINAL 2 - Frontend:" -ForegroundColor Yellow
Write-Host "  cd c:\unificard\frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  URLs:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Após iniciar, aguarde alguns segundos e acesse:" -ForegroundColor White
Write-Host "  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""


