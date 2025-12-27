# Script de diagnóstico do backend
Write-Host "🔍 DIAGNÓSTICO DO BACKEND" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
Write-Host "1. Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js não encontrado!" -ForegroundColor Red
    exit 1
}

# 2. Verificar npm
Write-Host "2. Verificando npm..." -ForegroundColor Yellow
$npmVersion = npm --version
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ npm não encontrado!" -ForegroundColor Red
    exit 1
}

# 3. Verificar node_modules
Write-Host "3. Verificando dependências..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ node_modules NÃO existe - execute: npm install" -ForegroundColor Red
    exit 1
}

# 4. Verificar .env
Write-Host "4. Verificando .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✅ .env existe" -ForegroundColor Green
    $hasDb = Get-Content .env | Select-String "DATABASE_URL"
    if ($hasDb) {
        Write-Host "   ✅ DATABASE_URL configurada" -ForegroundColor Green
    } else {
        Write-Host "   ❌ DATABASE_URL NÃO configurada" -ForegroundColor Red
    }
    $hasPort = Get-Content .env | Select-String "PORT"
    if ($hasPort) {
        Write-Host "   ✅ PORT configurada" -ForegroundColor Green
        Get-Content .env | Select-String "PORT"
    } else {
        Write-Host "   ⚠️  PORT não configurada (usará padrão 3000)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ .env NÃO existe" -ForegroundColor Red
    exit 1
}

# 5. Verificar porta 3000
Write-Host "5. Verificando porta 3000..." -ForegroundColor Yellow
$portCheck = netstat -ano | findstr ":3000"
if ($portCheck) {
    Write-Host "   ⚠️  Porta 3000 está em uso:" -ForegroundColor Yellow
    Write-Host $portCheck
    Write-Host "   💡 Para liberar, execute: taskkill /PID <numero> /F" -ForegroundColor Cyan
} else {
    Write-Host "   ✅ Porta 3000 está livre" -ForegroundColor Green
}

# 6. Verificar TypeScript
Write-Host "6. Verificando TypeScript..." -ForegroundColor Yellow
$tscCheck = npx tsc --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ TypeScript disponível" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  TypeScript pode não estar instalado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Diagnóstico completo!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar o backend, execute:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White













