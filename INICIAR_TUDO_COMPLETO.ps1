# Script para INICIAR BACKEND E FRONTEND COMPLETO
# Execute na raiz do projeto (C:\unificard)

Write-Host "=== INICIANDO BACKEND E FRONTEND ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

# 1. Matar todos os processos Node
Write-Host "1. Matando processos Node antigos..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   Processos mortos" -ForegroundColor Green

# 2. Verificar portas
Write-Host ""
Write-Host "2. Verificando portas..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port3000) {
    $pid = ($port3000 | Select-Object -First 1).OwningProcess
    Write-Host "   Porta 3000 em uso pelo PID $pid - matando..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

if ($port5173) {
    $pid = ($port5173 | Select-Object -First 1).OwningProcess
    Write-Host "   Porta 5173 em uso pelo PID $pid - matando..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "   Portas liberadas" -ForegroundColor Green

# 3. Iniciar backend
Write-Host ""
Write-Host "3. Iniciando BACKEND..." -ForegroundColor Yellow
Write-Host "   Janela do backend sera aberta" -ForegroundColor White
$env:NODE_ENV = "development"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\unificard; Write-Host '=== BACKEND UNIFICARD ===' -ForegroundColor Cyan; Write-Host 'Aguarde 20-30 segundos para iniciar...' -ForegroundColor Yellow; Write-Host ''; npm run dev -w unificard-backend"
Start-Sleep -Seconds 2
Write-Host "   Backend iniciado em nova janela" -ForegroundColor Green

# 4. Iniciar frontend
Write-Host ""
Write-Host "4. Iniciando FRONTEND..." -ForegroundColor Yellow
Write-Host "   Janela do frontend sera aberta" -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\unificard; Write-Host '=== FRONTEND UNIFICARD ===' -ForegroundColor Cyan; Write-Host 'Aguarde 10-15 segundos para iniciar...' -ForegroundColor Yellow; Write-Host ''; npm run dev -w unificard-frontend"
Start-Sleep -Seconds 2
Write-Host "   Frontend iniciado em nova janela" -ForegroundColor Green

# 5. Aguardar e verificar
Write-Host ""
Write-Host "5. Aguardando 30 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "=== VERIFICACAO FINAL ===" -ForegroundColor Cyan
Write-Host ""

# Verificar frontend
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($port5173) {
    Write-Host "✅ FRONTEND: Rodando na porta 5173" -ForegroundColor Green
} else {
    Write-Host "❌ FRONTEND: NAO esta rodando" -ForegroundColor Red
    Write-Host "   Verifique a janela do frontend para ver erros" -ForegroundColor Yellow
}

# Verificar backend
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "✅ BACKEND: Rodando na porta 3000" -ForegroundColor Green
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 3 -UseBasicParsing
        Write-Host "   Endpoint /health responde (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "   Porta em uso mas endpoint nao responde ainda" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ BACKEND: NAO esta rodando" -ForegroundColor Red
    Write-Host "   Verifique a janela do backend para ver erros" -ForegroundColor Yellow
}

Write-Host ""
if ($port5173 -and $port3000) {
    Write-Host "=== SUCESSO! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Acesse o sistema:" -ForegroundColor Cyan
    Write-Host "  http://localhost:5173/login" -ForegroundColor White
    Write-Host ""
    Write-Host "Se ainda ver erro, aguarde mais 10-15 segundos e recarregue a pagina." -ForegroundColor Yellow
} else {
    Write-Host "=== ATENCAO ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Um ou ambos os servidores nao iniciaram corretamente." -ForegroundColor Red
    Write-Host "Verifique as janelas do PowerShell que foram abertas para ver os erros." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Problemas comuns:" -ForegroundColor Cyan
    Write-Host "  - Backend: Erro de conexao com banco de dados" -ForegroundColor White
    Write-Host "  - Backend: Variaveis de ambiente nao configuradas" -ForegroundColor White
    Write-Host "  - Frontend: Dependencias nao instaladas (execute: npm install)" -ForegroundColor White
}













