# ========================================
# RESTART UNIFICARD - Reinicia Backend + Frontend
# ========================================
# Este script para e reinicia o Unificard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REINICIANDO UNIFICARD" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obter caminho do script stop
$scriptPath = Join-Path (Get-Location).Path "stop-unificard.ps1"

Write-Host "[1/3] Encerrando processos..." -ForegroundColor Yellow

# Executar stop (sem mostrar a janela de confirmação)
& $scriptPath 2>&1 | Out-Null

# Aguardar 2 segundos para garantir que processos foram encerrados
Write-Host "  → Aguardando 2 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host "[2/3] Limpando portas..." -ForegroundColor Yellow

# Verificar se as portas estão livres
$ports = @(3000, 5173)
$portsFree = $true

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "  ⚠ Porta $port ainda em uso, aguardando..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        $portsFree = $false
    }
}

if (-not $portsFree) {
    Write-Host "  → Forçando limpeza de portas..." -ForegroundColor Yellow
    foreach ($port in $ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Seconds 1
}

Write-Host "[3/3] Reiniciando servidores..." -ForegroundColor Yellow

# Executar start
$startScriptPath = Join-Path (Get-Location).Path "start-unificard.ps1"
& $startScriptPath







