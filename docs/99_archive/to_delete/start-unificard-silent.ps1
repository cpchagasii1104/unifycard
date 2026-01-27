# ========================================
# START UNIFICARD - SILENT MODE
# ========================================
# Versão silenciosa para uso com Task Scheduler
# Não abre janelas, apenas inicia os processos em background

# Obter caminho absoluto do projeto
# Tenta obter do caminho do script, senão usa o diretório atual
if ($PSScriptRoot) {
    $projectRoot = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    $projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $projectRoot = (Get-Location).Path
}
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"

# Matar processos Node antigos
Get-Process | Where-Object {
    $_.ProcessName -eq "node" -and 
    ($_.Path -like "*unificard*" -or 
     $_.CommandLine -like "*unificard*" -or
     $_.CommandLine -like "*backend*" -or
     $_.CommandLine -like "*frontend*")
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Matar processos nas portas
$ports = @(3000, 5173)
foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
               Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

# Iniciar backend em background
$backendScript = @"
Set-Location '$backendPath'
pnpm run dev
"@

$backendScriptPath = Join-Path $env:TEMP "unificard-backend-start.ps1"
$backendScript | Out-File -FilePath $backendScriptPath -Encoding UTF8

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $backendScriptPath
) -WindowStyle Normal

Start-Sleep -Seconds 3

# Iniciar frontend em background
$frontendScript = @"
Set-Location '$frontendPath'
pnpm run dev
"@

$frontendScriptPath = Join-Path $env:TEMP "unificard-frontend-start.ps1"
$frontendScript | Out-File -FilePath $frontendScriptPath -Encoding UTF8

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $frontendScriptPath
) -WindowStyle Normal

# Log para verificação (opcional)
$logPath = Join-Path $projectRoot "unificard-auto-start.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] Unificard iniciado automaticamente" | Out-File -FilePath $logPath -Append

