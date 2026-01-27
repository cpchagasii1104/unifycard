# ========================================
# STOP UNIFICARD - Encerra Backend + Frontend
# ========================================
# Este script encerra todos os processos Node
# relacionados ao Unificard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ENCERRANDO UNIFICARD" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obter caminho do projeto
$projectRoot = (Get-Location).Path

Write-Host "[1/3] Encerrando processos nas portas 3000 e 5173..." -ForegroundColor Yellow

# Encerrar processos usando as portas do backend e frontend
$ports = @(3000, 5173)
$killedCount = 0

foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess) {
                $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "  → Encerrando processo na porta $port (PID: $($process.Id))" -ForegroundColor Gray
                    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        }
    } catch {
        # Porta não está em uso ou erro ao acessar
    }
}

Write-Host "[2/3] Encerrando processos Node relacionados ao Unificard..." -ForegroundColor Yellow

# Encerrar processos Node que possam estar rodando o backend ou frontend
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

foreach ($proc in $nodeProcesses) {
    try {
        # Verificar se o processo está relacionado ao Unificard
        $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        
        if ($commandLine -and (
            $commandLine -like "*unificard*" -or
            $commandLine -like "*backend*" -or
            $commandLine -like "*frontend*" -or
            $commandLine -like "*ts-node-dev*" -or
            $commandLine -like "*vite*"
        )) {
            Write-Host "  → Encerrando processo Node (PID: $($proc.Id))" -ForegroundColor Gray
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killedCount++
        }
    } catch {
        # Processo pode ter sido encerrado ou não temos permissão
    }
}

Write-Host "[3/3] Limpando scripts temporários..." -ForegroundColor Yellow

# Limpar scripts temporários
$tempScripts = @(
    "$env:TEMP\unificard-backend-start.ps1",
    "$env:TEMP\unificard-frontend-start.ps1"
)

foreach ($script in $tempScripts) {
    if (Test-Path $script) {
        Remove-Item $script -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($killedCount -gt 0) {
    Write-Host "  ✅ $killedCount processo(s) encerrado(s)" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Nenhum processo encontrado" -ForegroundColor Gray
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")







