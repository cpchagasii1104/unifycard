# 🎯 ARQUIVOS CRÍTICOS - Backend Unificard

## Os 5 arquivos que PRECISAM funcionar para o servidor subir

### 1️⃣ `backend/package.json` (Script de start)
**Caminho:** `backend/package.json`  
**Linha crítica:** `"dev": "..."`  
**O que precisa:** Script completo, sem `...`, apontando para `src/server.ts`

**Status atual:** ✅ CORRETO
```json
"dev": "ts-node-dev -r tsconfig-paths/register --respawn --transpile-only --exit-child --ignore-watch node_modules --no-notify src/server.ts"
```

---

### 2️⃣ `backend/src/server.ts` (Entrypoint)
**Caminho:** `backend/src/server.ts`  
**Linha crítica:** `if (require.main === module) { startServer(); }`  
**O que precisa:** Arquivo deve executar até o final e chamar `app.listen()`

**Status atual:** ⚠️ VERIFICAR
- ✅ `process.exit(1)` removido (linha 248)
- ⚠️ Verificar se chega até `app.listen()`

---

### 3️⃣ `backend/tsconfig.json` (Config TypeScript)
**Caminho:** `backend/tsconfig.json`  
**O que precisa:** Config válida, paths corretos, `ts-node` configurado

**Status atual:** ✅ EXISTE (verificar se válido)

---

### 4️⃣ Dependências críticas instaladas
**Arquivo:** `backend/package.json` (dependencies/devDependencies)  
**O que precisa:**
- `ts-node-dev` ✅
- `ts-node` ✅
- `typescript` ✅
- `tsconfig-paths` ✅

**Status atual:** ✅ TODAS PRESENTES

---

### 5️⃣ `backend/src/server.ts` → `buildApp()` → `app.listen()`
**Caminho:** Fluxo de execução dentro de `server.ts`  
**O que precisa:** 
1. `buildApp()` completa sem erro
2. `startServer()` chama `app.listen()`
3. Porta 3000 fica em uso

**Status atual:** ⚠️ VERIFICAR (pode estar travando em algum import)

---

## 🧪 TESTE DEFINITIVO

Execute:

```powershell
.\TESTE_DEFINITIVO.ps1
```

Este teste:
- ✅ Ignora npm/workspace/watchers
- ✅ Testa APENAS se Node consegue executar o arquivo
- ✅ Mostra se o problema é ambiente ou código

---

## 📋 CHECKLIST DE VALIDAÇÃO (ordem obrigatória)

### ✅ PASSO 1: Teste básico do Node
```powershell
cd C:\unificard\backend
node src/TESTE_ENTRYPOINT.ts
```

**Resultado esperado:**
- Logs aparecem = Node funciona
- Nada aparece = Node não executa TypeScript (precisa ts-node)

---

### ✅ PASSO 2: Teste com ts-node
```powershell
cd C:\unificard\backend
node -r ts-node/register/transpile-only src/server.ts
```

**Resultado esperado:**
- Logs aparecem = ts-node funciona
- Erro de import = problema de dependências/paths
- Nada aparece = problema mais profundo

---

### ✅ PASSO 3: Teste com script completo
```powershell
cd C:\unificard
npm run dev -w unificard-backend
```

**Resultado esperado:**
- Backend inicia = TUDO OK
- Erro específico = problema identificado
- Nada acontece = script não está sendo executado

---

## 🚨 CAUSAS MAIS COMUNS (sempre uma delas)

1. **Script `dev` quebrado** → ✅ JÁ CORRIGIDO
2. **Dependência não instalada** → Verificar `npm install`
3. **Entrypoint não executado** → Teste definitivo identifica
4. **Processo morre antes do listen** → Verificar imports no topo de `server.ts`
5. **Node não está executando** → Teste definitivo identifica

---

## 🎯 PRÓXIMO PASSO

Execute o teste definitivo e informe:
- Apareceu algum log? (sim/não)
- Qual foi o último log?
- Apareceu algum erro? (cole completo)

Com isso, identifico EXATAMENTE onde está travando.


















