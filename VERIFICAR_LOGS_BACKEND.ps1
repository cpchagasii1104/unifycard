# Script para verificar se o backend está rodando e mostrar informações
Write-Host "=== STATUS DO BACKEND ===" -ForegroundColor Cyan
Write-Host ""

# Processos Node
Write-Host "Processos Node rodando:" -ForegroundColor Yellow
$processes = Get-Process node -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Select-Object Id,ProcessName,StartTime,CPU,WorkingSet | Format-Table -Auto
} else {
    Write-Host "Nenhum processo Node encontrado" -ForegroundColor Red
}

Write-Host ""

# Porta 3000
Write-Host "Porta 3000:" -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "Porta 3000 esta em uso" -ForegroundColor Green
    $pid = ($port | Select-Object -First 1).OwningProcess
    Write-Host "PID: $pid" -ForegroundColor White
} else {
    Write-Host "Porta 3000 NAO esta em uso" -ForegroundColor Red
}

Write-Host ""

# Teste /health
Write-Host "Testando /health:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 3 -UseBasicParsing
    Write-Host "SUCESSO! Backend esta respondendo" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Backend nao esta respondendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTRUCOES:" -ForegroundColor Yellow
    Write-Host "1. Verifique o terminal onde o backend foi iniciado" -ForegroundColor White
    Write-Host "2. Procure por erros de conexao com banco de dados" -ForegroundColor White
    Write-Host "3. Verifique se as variaveis de ambiente estao configuradas" -ForegroundColor White
    Write-Host "4. Verifique se o banco de dados esta rodando" -ForegroundColor White
}













