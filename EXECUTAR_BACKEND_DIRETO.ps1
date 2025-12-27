# Script para executar backend DIRETO no Node (sem npm, sem watchers)
Write-Host "=== EXECUTANDO BACKEND DIRETO NO NODE ===" -ForegroundColor Cyan
Write-Host ""

cd C:\unificard

Write-Host "1. Matando processos Node antigos..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "2. Executando DIRETO no Node (sem npm, sem watchers)..." -ForegroundColor Yellow
Write-Host "   Comando: node -r ts-node/register/transpile-only ./backend/src/server.ts" -ForegroundColor White
Write-Host ""
Write-Host "Aguarde... Se aparecer logs, o backend esta funcionando!" -ForegroundColor Green
Write-Host ""

node -r ts-node/register/transpile-only ./backend/src/server.ts













