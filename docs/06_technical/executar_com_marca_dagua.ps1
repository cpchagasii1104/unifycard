# Script para executar backend com MARCA D'ÁGUA (garante que está executando o arquivo certo)
# Execute APÓS matar todos os processos Node

Write-Host "=== EXECUTANDO BACKEND COM MARCA D'AGUA ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

# Verificar se há processos Node rodando
$processes = Get-Process node -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "AVISO: Ainda ha $($processes.Count) processo(s) Node rodando!" -ForegroundColor Red
    Write-Host "Execute primeiro: .\EXTERMINAR_NODE_COMPLETO.ps1" -ForegroundColor Yellow
    Write-Host ""
    $processes | Select-Object Id,ProcessName,StartTime | Format-Table -Auto
    Write-Host ""
    $resposta = Read-Host "Deseja continuar mesmo assim? (S/N)"
    if ($resposta -ne "S" -and $resposta -ne "s") {
        Write-Host "Cancelado" -ForegroundColor Yellow
        exit
    }
}

# Verificar porta 3000
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "AVISO: Porta 3000 esta em uso!" -ForegroundColor Red
    $pid = ($port | Select-Object -First 1).OwningProcess
    Write-Host "Processo usando porta: PID $pid" -ForegroundColor Yellow
    $resposta = Read-Host "Deseja matar o processo e continuar? (S/N)"
    if ($resposta -eq "S" -or $resposta -eq "s") {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Processo morto" -ForegroundColor Green
    } else {
        Write-Host "Cancelado" -ForegroundColor Yellow
        exit
    }
}

Write-Host ""
Write-Host "Gerando marca d'agua unica..." -ForegroundColor Yellow
$runTag = "DIRECT-" + [guid]::NewGuid().ToString()
$env:UNIFICARD_RUN = $runTag

Write-Host ""
Write-Host "MARCA D'AGUA: $runTag" -ForegroundColor Cyan
Write-Host ""
Write-Host "Executando backend..." -ForegroundColor Yellow
Write-Host "Comando: node -r ts-node/register/transpile-only ./backend/src/server.ts" -ForegroundColor White
Write-Host ""
Write-Host "OBSERVE: O primeiro log DEVE mostrar 'RUN TAG: DIRECT-...'" -ForegroundColor Green
Write-Host "Se nao aparecer, o arquivo server.ts nao esta sendo executado!" -ForegroundColor Red
Write-Host ""
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""

node -r ts-node/register/transpile-only ./backend/src/server.ts


















