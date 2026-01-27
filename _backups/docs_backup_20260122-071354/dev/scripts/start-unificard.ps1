# ========================================
# START UNIFICARD - Backend + Frontend
# ========================================
# Este script inicia o backend e frontend do Unificard
# em terminais separados do PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO UNIFICARD" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obter caminho absoluto do projeto
$projectRoot = (Get-Location).Path
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"

Write-Host "[1/4] Matando processos Node antigos..." -ForegroundColor Yellow

# Matar todos os processos Node relacionados ao Unificard
Get-Process | Where-Object {
    $_.ProcessName -eq "node" -and 
    ($_.Path -like "*unificard*" -or 
     $_.CommandLine -like "*unificard*" -or
     $_.CommandLine -like "*backend*" -or
     $_.CommandLine -like "*frontend*")
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Matar processos Node que possam estar usando as portas
$ports = @(3000, 5173) # Backend e Frontend
foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
               Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Processo na porta $port encerrado" -ForegroundColor Green
    }
}

# Aguardar um momento para garantir que processos foram encerrados
Start-Sleep -Seconds 2

Write-Host "[2/4] Verificando dependências..." -ForegroundColor Yellow

# Verificar se pnpm está instalado
try {
    $pnpmVersion = pnpm --version 2>&1
    Write-Host "  ✓ pnpm encontrado (v$pnpmVersion)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ pnpm não encontrado! Instale com: npm install -g pnpm" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se node_modules existem
if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
    Write-Host "  ⚠ node_modules do backend não encontrado" -ForegroundColor Yellow
    Write-Host "  Executando: pnpm install no backend..." -ForegroundColor Yellow
    Set-Location $backendPath
    pnpm install
    Set-Location $projectRoot
}

if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "  ⚠ node_modules do frontend não encontrado" -ForegroundColor Yellow
    Write-Host "  Executando: pnpm install no frontend..." -ForegroundColor Yellow
    Set-Location $frontendPath
    pnpm install
    Set-Location $projectRoot
}

Write-Host "[3/4] Iniciando Backend..." -ForegroundColor Yellow

# Criar script temporário para iniciar backend em nova janela
$backendScript = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$backendPath'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  BACKEND UNIFICARD' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Iniciando servidor na porta 3000...' -ForegroundColor Yellow
Write-Host 'Auto-restart ativado (ts-node-dev)' -ForegroundColor Green
Write-Host ''
Write-Host '⚠️  Mantenha esta janela aberta!' -ForegroundColor Yellow
Write-Host ''
pnpm run dev
"@

$backendScriptPath = Join-Path $env:TEMP "unificard-backend-start.ps1"
$backendScript | Out-File -FilePath $backendScriptPath -Encoding UTF8

# Iniciar backend em nova janela do PowerShell
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $backendScriptPath
) -WindowStyle Normal

Write-Host "  ✓ Backend iniciado em nova janela" -ForegroundColor Green
Start-Sleep -Seconds 3

Write-Host "[4/4] Iniciando Frontend..." -ForegroundColor Yellow

# Criar script temporário para iniciar frontend em nova janela
$frontendScript = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$frontendPath'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  FRONTEND UNIFICARD' -ForegroundColor Yellow
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Iniciando servidor de desenvolvimento...' -ForegroundColor Yellow
Write-Host 'Auto-restart ativado (Vite)' -ForegroundColor Green
Write-Host ''
Write-Host '⚠️  Mantenha esta janela aberta!' -ForegroundColor Yellow
Write-Host ''
pnpm run dev
"@

$frontendScriptPath = Join-Path $env:TEMP "unificard-frontend-start.ps1"
$frontendScript | Out-File -FilePath $frontendScriptPath -Encoding UTF8

# Iniciar frontend em nova janela do PowerShell
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $frontendScriptPath
) -WindowStyle Normal

Write-Host "  ✓ Frontend iniciado em nova janela" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ UNIFICARD INICIADO COM SUCESSO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Duas janelas do PowerShell foram abertas:" -ForegroundColor Yellow
Write-Host "  - Uma para o Backend" -ForegroundColor White
Write-Host "  - Uma para o Frontend" -ForegroundColor White
Write-Host ""
Write-Host "Para parar os servidores, execute:" -ForegroundColor Yellow
Write-Host "  .\stop-unificard.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar esta janela..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
