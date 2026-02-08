# Script para iniciar o backend como workspace (CORRETO para monorepo)
Write-Host "=== INICIANDO BACKEND (WORKSPACE) ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

Write-Host "1. Matando processos Node antigos..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "2. Verificando ts-node-dev..." -ForegroundColor Yellow
npm -w unificard-backend exec -- ts-node-dev --version

Write-Host ""
Write-Host "3. Iniciando backend como workspace..." -ForegroundColor Yellow
Write-Host "   Comando: npm run dev -w unificard-backend" -ForegroundColor White
Write-Host ""

npm run dev -w unificard-backend


















