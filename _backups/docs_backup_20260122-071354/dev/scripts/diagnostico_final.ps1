# Script de DIAGNÓSTICO FINAL (respostas que o usuário precisa)
# Execute e copie/cole a saída completa

Write-Host "=== DIAGNOSTICO FINAL ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. PROCESSOS NODE:" -ForegroundColor Yellow
Write-Host ""

$processes = Get-Process node -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Select-Object Id,ProcessName,StartTime,Path | Format-Table -Auto
    Write-Host "Total: $($processes.Count) processo(s)" -ForegroundColor Red
} else {
    Write-Host "Nenhum processo Node encontrado" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. PORTA 3000:" -ForegroundColor Yellow
Write-Host ""

$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    $port | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -Auto
    $pid = ($port | Select-Object -First 1).OwningProcess
    if ($pid) {
        Write-Host "Processo usando porta 3000 (PID $pid):" -ForegroundColor Red
        Get-Process -Id $pid -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path,StartTime | Format-List
    }
} else {
    Write-Host "Porta 3000 esta livre" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== COPIE/COLE A SAIDA ACIMA ===" -ForegroundColor Cyan
Write-Host ""


















