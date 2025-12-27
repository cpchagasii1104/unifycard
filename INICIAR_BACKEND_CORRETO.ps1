# Script para INICIAR BACKEND CORRETAMENTE (após correção do package.json)
# Execute na raiz do projeto (C:\unificard)

Write-Host "=== INICIANDO BACKEND CORRETAMENTE ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

# 1) Matar processos Node zumbis
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

# 2) Verificar porta 3000
Write-Host ""
Write-Host "2. Verificando porta 3000..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    $pid = ($port | Select-Object -First 1).OwningProcess
    Write-Host "   Porta 3000 em uso pelo PID $pid" -ForegroundColor Red
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   Porta 3000 liberada" -ForegroundColor Green
} else {
    Write-Host "   Porta 3000 livre" -ForegroundColor Green
}

# 3) Verificar se package.json está correto
Write-Host ""
Write-Host "3. Verificando package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "backend\package.json" -Raw
if ($packageJson -match '\.\.\.') {
    Write-Host "   AVISO: package.json contem '...' (três pontos)!" -ForegroundColor Red
    Write-Host "   Corrija o script 'dev' antes de continuar" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "   package.json OK" -ForegroundColor Green
}

# 4) Iniciar backend via workspace
Write-Host ""
Write-Host "4. Iniciando backend via workspace..." -ForegroundColor Yellow
Write-Host "   Comando: npm run dev -w unificard-backend" -ForegroundColor White
Write-Host ""
Write-Host "   Aguarde 15-20 segundos para o backend iniciar..." -ForegroundColor Cyan
Write-Host "   Observe os logs abaixo:" -ForegroundColor Cyan
Write-Host ""

$env:NODE_ENV = "development"
npm run dev -w unificard-backend













