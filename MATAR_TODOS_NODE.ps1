# Script para MATAR TODOS os processos Node
# Execute como Administrador se necessário

Write-Host "=== MATANDO TODOS OS PROCESSOS NODE ===" -ForegroundColor Red
Write-Host ""

$processes = Get-Process -Name node -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "Encontrados $($processes.Count) processos Node:" -ForegroundColor Yellow
    $processes | ForEach-Object {
        Write-Host "  PID: $($_.Id) - Iniciado: $($_.StartTime)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Matando TODOS os processos..." -ForegroundColor Red
    Stop-Process -Name node -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    
    # Verificar novamente
    $remaining = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "AVISO: Ainda ha $($remaining.Count) processos Node!" -ForegroundColor Red
        Write-Host "Tente executar como Administrador" -ForegroundColor Yellow
        Write-Host "Ou mate manualmente: taskkill /F /IM node.exe" -ForegroundColor Yellow
    } else {
        Write-Host "SUCESSO: Todos os processos Node foram mortos" -ForegroundColor Green
    }
} else {
    Write-Host "Nenhum processo Node encontrado" -ForegroundColor Green
}

Write-Host ""
Write-Host "Agora execute o backend:" -ForegroundColor Cyan
Write-Host "  cd C:\unificard" -ForegroundColor White
Write-Host "  node -r ts-node/register/transpile-only ./backend/src/server.ts" -ForegroundColor White













