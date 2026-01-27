# 🚀 Como Iniciar o Backend do Unificard

## ⚠️ Problema Atual
O frontend não consegue conectar ao backend porque ele não está rodando.

## ✅ Solução Passo a Passo

### 1. Abra um Terminal/PowerShell

Abra um novo terminal na raiz do projeto (`C:\unificard`).

### 2. Navegue para a pasta backend

```bash
cd backend
```

### 3. Verifique se as dependências estão instaladas

```bash
npm install
```

### 4. Verifique se o arquivo .env existe

```bash
# Se não existir, crie baseado em .env.example
# (ou copie de outro ambiente)
```

### 5. Inicie o servidor

```bash
npm run dev
```

### 6. Aguarde a mensagem de sucesso

Você deve ver algo como:
```
Server listening on port 3000
```

### 7. Verifique se está funcionando

Abra outro terminal e teste:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

Se retornar status 200, está funcionando! ✅

### 8. Recarregue o frontend

Depois que o backend estiver rodando, recarregue a página do frontend (`localhost:5173/login`).

---

## 🔧 Troubleshooting

### Erro: "Port 3000 is already in use"

Algum processo já está usando a porta 3000. Para resolver:

```powershell
# Encontrar o processo
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess

# Matar o processo (substitua PID pelo número do processo)
Stop-Process -Id <PID> -Force
```

### Erro: "Cannot find module"

Execute:
```bash
cd backend
npm install
```

### Erro: "Database connection failed"

Verifique se o PostgreSQL está rodando e se as credenciais no `.env` estão corretas.

---

## 📝 Nota Importante

O backend precisa estar rodando **antes** de usar o frontend. Mantenha o terminal do backend aberto enquanto desenvolve.
