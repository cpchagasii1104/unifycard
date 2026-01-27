# 🔧 DIAGNÓSTICO: Backend Não Responde (ERR_CONNECTION_REFUSED)

> **Problema**: Frontend não consegue conectar no backend  
> **Erro**: `ERR_CONNECTION_REFUSED` em `http://localhost:3000`

---

## ✅ VALIDAÇÃO DO CÓDIGO

### Scripts
- ✅ `package.json` tem script `dev`: `ts-node-dev -r tsconfig-paths/register --respawn --transpile-only --exit-child --ignore-watch node_modules --no-notify src/server.ts`
- ✅ Arquivo principal: `src/server.ts`
- ✅ Entrypoint: `if (require.main === module)` chama `startServer()`
- ✅ Porta: `process.env.PORT ?? 3000`
- ✅ Health endpoint: `/health` registrado

### Configuração
- ✅ `dotenv/config` importado no topo de `server.ts`
- ✅ Health module registrado em `/health`
- ✅ Auth module registrado em `/auth`

---

## 🔍 POSSÍVEIS CAUSAS

### 1. Schema Guard Bloqueando

O `schema-guard.ts` pode estar bloqueando o servidor se:
- `DATABASE_URL` não está configurada → `process.exit(1)`
- Banco não conecta após 5 tentativas → `process.exit(1)`
- Migration 089 falha → `process.exit(1)`

**Solução temporária** (para desenvolvimento):
```bash
# No backend/.env, adicionar:
SKIP_SCHEMA_GUARD=true
```

**Solução definitiva**:
- Verificar `DATABASE_URL` no `.env`
- Garantir que PostgreSQL está rodando
- Executar migrations pendentes

---

### 2. Banco de Dados Não Conecta

**Verificar**:
```bash
# Testar conexão manualmente
psql $DATABASE_URL -c "SELECT 1;"
```

**Se falhar**:
- PostgreSQL não está rodando
- `DATABASE_URL` incorreta
- Credenciais incorretas

---

### 3. Porta 3000 Ocupada

**Verificar**:
```bash
# Windows PowerShell
netstat -ano | findstr :3000

# Se estiver ocupada, matar processo ou mudar porta
```

---

### 4. Dependências Não Instaladas

**Verificar**:
```bash
cd backend
npm install
```

---

## 🚀 SOLUÇÃO PASSO A PASSO

### Passo 1: Verificar Variáveis de Ambiente

Criar/verificar `backend/.env`:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/unificard
JWT_SECRET=sua_chave_secreta_aqui
PORT=3000
SKIP_SCHEMA_GUARD=false
```

**Se banco não estiver pronto, temporariamente**:
```env
SKIP_SCHEMA_GUARD=true
```

---

### Passo 2: Instalar Dependências

```bash
cd backend
npm install
```

---

### Passo 3: Executar Backend

```bash
cd backend
npm run dev
```

**Resultado esperado no console**:
```
🔵 [BOOT] server.ts carregado
🚀 [BOOT] starting server
🔒 Schema Guard: Validando schema mínimo...
✔ Conexão com banco de dados estabelecida
✅ SERVIDOR INICIADO
[BOOT] URL: http://localhost:3000
[BOOT] HEALTH: http://localhost:3000/health
```

---

### Passo 4: Testar Health Endpoint

```bash
curl http://localhost:3000/health
```

**Ou no browser**: `http://localhost:3000/health`

**Resultado esperado**: JSON com `status: "ok"`

---

### Passo 5: Testar Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

---

## 🔴 SE AINDA NÃO FUNCIONAR

### Verificar Logs do Backend

O console do backend deve mostrar:
- Erros de conexão com banco
- Erros de validação de schema
- Erros de importação de módulos

### Verificar Processo

```bash
# Windows PowerShell
Get-Process -Name node | Where-Object {$_.Path -like "*backend*"}
```

### Verificar Porta

```bash
# Windows PowerShell
netstat -ano | findstr :3000
```

---

## ✅ COMANDO FINAL PARA SUBIR BACKEND

```bash
cd backend
npm install
npm run dev
```

**Se schema guard bloquear**:
```bash
# Adicionar no .env:
SKIP_SCHEMA_GUARD=true

# Depois:
npm run dev
```

---

*Guia criado em 2025-01-07*  
*Para diagnóstico de backend offline*






