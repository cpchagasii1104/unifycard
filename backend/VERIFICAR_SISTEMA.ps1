# Script de Verificação Completa do Sistema Unificard
# Executa todas as verificações necessárias

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UNIFICARD - VERIFICAÇÃO DO SISTEMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar PostgreSQL
Write-Host "1. Verificando PostgreSQL..." -ForegroundColor Yellow
$pgPort = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5432 }
if ($pgPort) {
    Write-Host "   ✅ PostgreSQL está rodando na porta 5432" -ForegroundColor Green
} else {
    Write-Host "   ❌ PostgreSQL NÃO está rodando na porta 5432" -ForegroundColor Red
    Write-Host "   💡 Solução: Instale Docker e execute 'docker-compose up -d' ou inicie PostgreSQL localmente" -ForegroundColor Yellow
}

# 2. Verificar Backend
Write-Host ""
Write-Host "2. Verificando Backend (porta 3000)..." -ForegroundColor Yellow
$backendPort = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 3000 }
if ($backendPort) {
    Write-Host "   ✅ Backend está rodando na porta 3000" -ForegroundColor Green
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Host "   ✅ Backend está respondendo corretamente" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Backend está rodando mas não está respondendo" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Backend NÃO está rodando" -ForegroundColor Red
    Write-Host "   💡 Solução: Execute 'cd backend && npm run dev'" -ForegroundColor Yellow
}

# 3. Verificar Frontend
Write-Host ""
Write-Host "3. Verificando Frontend (porta 5173)..." -ForegroundColor Yellow
$frontendPort = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5173 }
if ($frontendPort) {
    Write-Host "   ✅ Frontend está rodando na porta 5173" -ForegroundColor Green
} else {
    Write-Host "   ❌ Frontend NÃO está rodando" -ForegroundColor Red
    Write-Host "   💡 Solução: Execute 'cd frontend && npm run dev'" -ForegroundColor Yellow
}

# 4. Verificar arquivos .env
Write-Host ""
Write-Host "4. Verificando arquivos de configuração..." -ForegroundColor Yellow
$backendEnv = Test-Path "backend\.env"
$frontendEnv = Test-Path "frontend\.env"

if ($backendEnv) {
    Write-Host "   ✅ backend/.env existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ backend/.env NÃO existe" -ForegroundColor Red
}

if ($frontendEnv) {
    Write-Host "   ✅ frontend/.env existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ frontend/.env NÃO existe" -ForegroundColor Red
}

# 5. Verificar migrations
Write-Host ""
Write-Host "5. Verificando migrations..." -ForegroundColor Yellow
$migrationsCount = (Get-ChildItem "backend\migrations" -Filter "*.sql" -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "   📦 Encontradas $migrationsCount migrations" -ForegroundColor Cyan

# 6. Resumo
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allOk = $pgPort -and $backendPort -and $frontendPort -and $backendEnv -and $frontendEnv

if ($allOk) {
    Write-Host "✅ Sistema parece estar configurado corretamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Acesse: http://localhost:5173" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Alguns componentes precisam de atenção" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor White
    Write-Host "1. Verifique se PostgreSQL está rodando" -ForegroundColor Gray
    Write-Host "2. Execute 'npm run migrate' no backend (se necessário)" -ForegroundColor Gray
    Write-Host "3. Execute 'npm run dev:user' no backend para criar usuário de teste" -ForegroundColor Gray
    Write-Host "4. Inicie o backend: 'cd backend && npm run dev'" -ForegroundColor Gray
    Write-Host "5. Inicie o frontend: 'cd frontend && npm run dev'" -ForegroundColor Gray
}

Write-Host ""

