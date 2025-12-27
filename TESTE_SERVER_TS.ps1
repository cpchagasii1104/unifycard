# Teste DIRETO do server.ts - captura TODOS os logs
cd C:\unificard\backend

Write-Host "=== TESTE DIRETO: server.ts ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Executando server.ts com ts-node..." -ForegroundColor Yellow
Write-Host "Comando: node -r ts-node/register/transpile-only src/server.ts" -ForegroundColor White
Write-Host ""
Write-Host "OBSERVE TODOS OS LOGS QUE APARECEREM:" -ForegroundColor Green
Write-Host "  - Se aparecer 'RUN TAG' = arquivo esta sendo executado" -ForegroundColor White
Write-Host "  - Se aparecer 'BOOTSTRAP STARTED' = imports concluidos" -ForegroundColor White
Write-Host "  - Se aparecer 'SERVIDOR INICIADO' = backend subiu" -ForegroundColor White
Write-Host "  - Se aparecer ERRO = problema identificado" -ForegroundColor White
Write-Host ""
Write-Host "Aguarde 15 segundos..." -ForegroundColor Cyan
Write-Host ""

$env:NODE_ENV = "development"
node -r ts-node/register/transpile-only src/server.ts 2>&1













