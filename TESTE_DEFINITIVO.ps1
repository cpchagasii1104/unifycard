# TESTE DEFINITIVO - Valida se o entrypoint pode ser executado
# Este teste IGNORA npm, workspace, watchers - testa APENAS Node + arquivo

Write-Host "=== TESTE DEFINITIVO - ENTRYPOINT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este teste verifica se o Node consegue executar o arquivo server.ts" -ForegroundColor Yellow
Write-Host "IGNORA: npm, workspace, watchers, dependencias" -ForegroundColor Yellow
Write-Host ""

cd C:\unificard\backend

Write-Host "1. Verificando se Node esta instalado..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Node encontrado: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ERRO: Node nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Verificando se arquivo server.ts existe..." -ForegroundColor Yellow
if (Test-Path "src\server.ts") {
    Write-Host "   Arquivo encontrado: src\server.ts" -ForegroundColor Green
} else {
    Write-Host "   ERRO: Arquivo src\server.ts nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. Executando TESTE_ENTRYPOINT.ts (versao simplificada)..." -ForegroundColor Yellow
Write-Host "   Comando: node src/TESTE_ENTRYPOINT.ts" -ForegroundColor White
Write-Host ""
Write-Host "   OBSERVE: Se aparecerem logs, o Node consegue executar arquivos TypeScript" -ForegroundColor Cyan
Write-Host "   Se NAO aparecer nada, o problema e o ambiente Node/TypeScript" -ForegroundColor Red
Write-Host ""

node src/TESTE_ENTRYPOINT.ts

Write-Host ""
Write-Host "=== INTERPRETACAO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Se voce viu:" -ForegroundColor Yellow
Write-Host "  ✅ 'SERVER ENTRYPOINT STARTED' = Node consegue executar o arquivo" -ForegroundColor Green
Write-Host "  ✅ 'SERVER STILL ALIVE' = Processo continua vivo" -ForegroundColor Green
Write-Host "  ✅ 'FORCING EXIT' = Arquivo foi executado completamente" -ForegroundColor Green
Write-Host ""
Write-Host "Se voce NAO viu nada:" -ForegroundColor Yellow
Write-Host "  ❌ Node nao consegue executar TypeScript diretamente" -ForegroundColor Red
Write-Host "  ❌ Precisa usar ts-node ou compilar antes" -ForegroundColor Red
Write-Host ""
Write-Host "Proximo passo: Testar com ts-node" -ForegroundColor Cyan













