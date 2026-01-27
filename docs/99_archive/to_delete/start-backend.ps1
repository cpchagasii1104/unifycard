# Script para iniciar o backend do Unificard
Write-Host "🚀 Iniciando backend do Unificard..." -ForegroundColor Cyan
Write-Host ""

cd backend

if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: package.json não encontrado na pasta backend" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pasta backend encontrada" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando servidor na porta 3000..." -ForegroundColor Yellow
Write-Host "Aguarde alguns segundos até ver a mensagem 'Server listening on port 3000'" -ForegroundColor Yellow
Write-Host ""

npm run dev
