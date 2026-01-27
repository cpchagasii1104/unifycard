# Script para SOLUCAO RAPIDA - Reiniciar backend e testar
# Execute na raiz do projeto (C:\unificard)

Write-Host "=== SOLUCAO RAPIDA - REINICIAR BACKEND ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

# 1. Matar processos Node
Write-Host "1. Matando processos Node..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   OK" -ForegroundColor Green

# 2. Verificar porta 3000
Write-Host ""
Write-Host "2. Verificando porta 3000..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    $pid = ($port | Select-Object -First 1).OwningProcess
    Write-Host "   Porta 3000 em uso pelo PID $pid" -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   Porta 3000 liberada" -ForegroundColor Green
} else {
    Write-Host "   Porta 3000 livre" -ForegroundColor Green
}

# 3. Iniciar backend em nova janela
Write-Host ""
Write-Host "3. Iniciando backend em nova janela..." -ForegroundColor Yellow
Write-Host "   Aguarde 20-30 segundos para o backend iniciar" -ForegroundColor Cyan
Write-Host ""

$env:NODE_ENV = "development"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\unificard; Write-Host '=== BACKEND UNIFICARD ===' -ForegroundColor Cyan; Write-Host ''; npm run dev -w unificard-backend"

Start-Sleep -Seconds 3
Write-Host "   Backend iniciado em nova janela do PowerShell" -ForegroundColor Green
Write-Host "   Verifique os logs nessa janela" -ForegroundColor Yellow

# 4. Aguardar e testar
Write-Host ""
Write-Host "4. Aguardando 25 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 25

Write-Host ""
Write-Host "5. Testando backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 3 -UseBasicParsing
    Write-Host ""
    Write-Host "   SUCESSO! Backend esta respondendo" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Agora voce pode:" -ForegroundColor Cyan
    Write-Host "   - Acessar o frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "   - Fazer login normalmente" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "   Backend ainda nao esta respondendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "   VERIFIQUE:" -ForegroundColor Yellow
    Write-Host "   1. A janela do backend que foi aberta" -ForegroundColor White
    Write-Host "   2. Procure por erros nos logs" -ForegroundColor White
    Write-Host "   3. Verifique se o banco de dados esta rodando" -ForegroundColor White
    Write-Host "   4. Verifique as variaveis de ambiente (.env)" -ForegroundColor White
    Write-Host ""
    Write-Host "   Aguarde mais 10-15 segundos e teste novamente:" -ForegroundColor Cyan
    Write-Host "   Invoke-WebRequest http://localhost:3000/health" -ForegroundColor White
}


















