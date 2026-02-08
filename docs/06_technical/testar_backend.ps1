# Script para TESTAR se o backend está rodando
# Execute após iniciar o backend

Write-Host "=== TESTANDO BACKEND ===" -ForegroundColor Cyan
Write-Host ""

# Aguardar um pouco
Write-Host "Aguardando 5 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Testar porta 3000
Write-Host "1. Verificando porta 3000..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "   Porta 3000 esta em uso" -ForegroundColor Green
    $pid = ($port | Select-Object -First 1).OwningProcess
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "   Processo: $($proc.ProcessName) (PID: $pid)" -ForegroundColor White
    }
} else {
    Write-Host "   Porta 3000 NAO esta em uso" -ForegroundColor Red
    Write-Host "   Backend provavelmente nao iniciou" -ForegroundColor Red
    exit 1
}

# Testar endpoint /health
Write-Host ""
Write-Host "2. Testando endpoint /health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "   SUCESSO! Backend esta respondendo" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Resposta: $($response.Content)" -ForegroundColor White
} catch {
    Write-Host "   ERRO: Backend nao esta respondendo" -ForegroundColor Red
    Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Possiveis causas:" -ForegroundColor Yellow
    Write-Host "   - Backend ainda esta iniciando (aguarde mais 10-15 segundos)" -ForegroundColor White
    Write-Host "   - Backend falhou ao iniciar (verifique os logs)" -ForegroundColor White
    Write-Host "   - Porta 3000 esta bloqueada por firewall" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== BACKEND FUNCIONANDO! ===" -ForegroundColor Green


















