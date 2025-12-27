# TESTE BINÁRIO - Identificar qual import trava
# Este script testa imports incrementalmente até encontrar o que trava

cd C:\unificard\backend

Write-Host "=== TESTE BINARIO - IDENTIFICAR IMPORT QUE TRAVA ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este teste vai executar server-TESTE.ts que loga cada import" -ForegroundColor Yellow
Write-Host "O ultimo STEP que aparecer = ultimo import que funcionou" -ForegroundColor Yellow
Write-Host "O proximo import e o que esta travando" -ForegroundColor Red
Write-Host ""
Write-Host "Executando..." -ForegroundColor Cyan
Write-Host ""

$env:NODE_ENV = "development"
node -r ts-node/register/transpile-only src/server-TESTE.ts 2>&1

Write-Host ""
Write-Host "=== INTERPRETACAO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OBSERVE:" -ForegroundColor Yellow
Write-Host "  - Qual foi o ULTIMO STEP que apareceu?" -ForegroundColor White
Write-Host "  - O proximo import e o que esta travando" -ForegroundColor Red
Write-Host ""
Write-Host "Exemplo:" -ForegroundColor Yellow
Write-Host "  Se apareceu ate STEP 26 (companiesModule)" -ForegroundColor White
Write-Host "  Entao o problema esta em: referralModule ou planModule ou depois" -ForegroundColor Red













