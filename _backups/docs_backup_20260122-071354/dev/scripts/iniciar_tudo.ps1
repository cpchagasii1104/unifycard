# Script para INICIAR BACKEND E FRONTEND
# Execute na raiz do projeto (C:\unificard)

Write-Host "=== INICIANDO BACKEND E FRONTEND ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

# 1. Matar processos Node antigos
Write-Host "1. Matando processos Node antigos..." -ForegroundColor Yellow
$processes = Get-Process node -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "   Encontrados $($processes.Count) processo(s) Node" -ForegroundColor Yellow
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   Processos mortos" -ForegroundColor Green
} else {
    Write-Host "   Nenhum processo Node encontrado" -ForegroundColor Green
}

# 2. Verificar portas
Write-Host ""
Write-Host "2. Verificando portas..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3000) {
    Write-Host "   Porta 3000 (backend) ja esta em uso" -ForegroundColor Yellow
    $pid = ($port3000 | Select-Object -First 1).OwningProcess
    Write-Host "   PID: $pid" -ForegroundColor White
} else {
    Write-Host "   Porta 3000 (backend) livre" -ForegroundColor Green
}

if ($port5173) {
    Write-Host "   Porta 5173 (frontend) ja esta em uso" -ForegroundColor Yellow
    $pid = ($port5173 | Select-Object -First 1).OwningProcess
    Write-Host "   PID: $pid" -ForegroundColor White
} else {
    Write-Host "   Porta 5173 (frontend) livre" -ForegroundColor Green
}

# 3. Iniciar backend (se não estiver rodando)
Write-Host ""
if (-not $port3000) {
    Write-Host "3. Iniciando BACKEND..." -ForegroundColor Yellow
    Write-Host "   Comando: npm run dev -w unificard-backend" -ForegroundColor White
    Write-Host "   Aguarde 15-20 segundos..." -ForegroundColor Cyan
    Write-Host ""
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\unificard; npm run dev -w unificard-backend"
    Start-Sleep -Seconds 3
    Write-Host "   Backend iniciado em nova janela" -ForegroundColor Green
} else {
    Write-Host "3. Backend ja esta rodando" -ForegroundColor Green
}

# 4. Iniciar frontend (se não estiver rodando)
Write-Host ""
if (-not $port5173) {
    Write-Host "4. Iniciando FRONTEND..." -ForegroundColor Yellow
    Write-Host "   Comando: npm run dev -w unificard-frontend" -ForegroundColor White
    Write-Host "   Aguarde 10-15 segundos..." -ForegroundColor Cyan
    Write-Host ""
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\unificard; npm run dev -w unificard-frontend"
    Start-Sleep -Seconds 3
    Write-Host "   Frontend iniciado em nova janela" -ForegroundColor Green
} else {
    Write-Host "4. Frontend ja esta rodando" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== AGUARDE 20-30 SEGUNDOS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Depois, teste:" -ForegroundColor Yellow
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend: http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "Os servidores foram iniciados em janelas separadas do PowerShell." -ForegroundColor Cyan
Write-Host "Verifique os logs nessas janelas para confirmar que iniciaram corretamente." -ForegroundColor Cyan


















