# 🔍 Diagnóstico do Backend

## Como executar diagnóstico

Execute no PowerShell, na pasta `backend`:

```powershell
cd C:\unificard\backend
.\diagnostico.ps1
```

Ou execute manualmente cada passo:

## 1. Verificar dependências

```powershell
npm list --depth=0
```

Se houver erros, reinstale:
```powershell
npm install
```

## 2. Verificar arquivo .env

```powershell
if (Test-Path .env) {
    Write-Host "✅ .env existe"
    Get-Content .env | Select-String "DATABASE_URL|PORT"
} else {
    Write-Host "❌ .env NÃO existe"
}
```

## 3. Testar conexão com banco

```powershell
# Se tiver psql instalado
psql $env:DATABASE_URL -c "SELECT 1"
```

## 4. Tentar iniciar com logs detalhados

```powershell
$env:NODE_ENV="development"
$env:LOG_LEVEL="debug"
npm run dev
```

## 5. Verificar porta 3000

```powershell
netstat -ano | findstr ":3000"
```

Se houver algo, mate o processo:
```powershell
taskkill /PID <numero> /F
```

## Erros Comuns

### "Cannot find module"
- Execute: `npm install`

### "Port already in use"
- Mate processos na porta 3000
- Ou mude a porta no `.env`: `PORT=3001`

### "Database connection failed"
- Verifique se PostgreSQL está rodando
- Verifique `DATABASE_URL` no `.env`
- Teste conexão manualmente

### "EADDRINUSE"
- Porta já está em uso
- Mate o processo ou mude a porta


























