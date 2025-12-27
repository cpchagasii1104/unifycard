# TESTE FINAL - Validar que backend está funcionando
# Este script verifica se o backend iniciou corretamente

cd C:\unificard

Write-Host "=== TESTE FINAL - VALIDACAO DO BACKEND ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se há processos Node rodando
Write-Host "1. Verificando processos Node..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   ✅ Encontrados $($nodeProcesses.Count) processo(s) Node" -ForegroundColor Green
    $nodeProcesses | ForEach-Object {
        Write-Host "      PID: $($_.Id) - Memoria: $([math]::Round($_.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️ Nenhum processo Node encontrado" -ForegroundColor Yellow
    Write-Host "      Execute: npm run dev -w unificard-backend" -ForegroundColor White
    exit 1
}

Write-Host ""

# 2. Verificar se porta 3000 está em uso
Write-Host "2. Verificando porta 3000..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "   ✅ Porta 3000 está LISTENING" -ForegroundColor Green
    Write-Host "      PID: $($port3000.OwningProcess)" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Porta 3000 NÃO está em uso" -ForegroundColor Red
    Write-Host "      O backend não iniciou corretamente" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 3. Testar endpoint /health
Write-Host "3. Testando endpoint /health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ /health respondeu com sucesso" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "      Status: $($healthData.status)" -ForegroundColor Gray
        Write-Host "      Uptime: $($healthData.uptime) segundos" -ForegroundColor Gray
        if ($healthData.database) {
            if ($healthData.database.connected) {
                Write-Host "      Database: ✅ Conectado" -ForegroundColor Green
            } else {
                Write-Host "      Database: ⚠️ Desconectado (mas servidor funcionando)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ⚠️ /health respondeu com status $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ /health NÃO respondeu" -ForegroundColor Red
    Write-Host "      Erro: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "      O backend pode estar travado ou não iniciou completamente" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 4. Resumo final
Write-Host "=== RESUMO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Backend está FUNCIONANDO corretamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Verifique o frontend em http://localhost:5173" -ForegroundColor White
Write-Host "  2. O frontend deve conseguir conectar ao backend" -ForegroundColor White
Write-Host "  3. Se houver erros, eles serão de aplicação (não de bootstrap)" -ForegroundColor White
Write-Host ""













