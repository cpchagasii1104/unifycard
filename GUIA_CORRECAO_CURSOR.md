# 🎯 Guia de Correção - Backend Unificard

## Status Atual

✅ **package.json já corrigido** (sem `...`, script `dev` completo)
✅ **JSON válido**
✅ **Script `dev` correto**

---

## 📋 Checklist de Validação

### 1. Verificar `backend/package.json`

**Arquivo:** `backend/package.json`

**Script `dev` DEVE ser:**
```json
"dev": "ts-node-dev -r tsconfig-paths/register --respawn --transpile-only --exit-child --ignore-watch node_modules --no-notify src/server.ts"
```

**Verificações:**
- ❌ NÃO deve ter `...` (três pontos) em nenhum lugar
- ✅ Deve apontar para `src/server.ts`
- ✅ JSON deve ser válido (sem vírgulas extras)

---

### 2. Comparar com Zip da Cláudia (se disponível)

**Arquivos para comparar:**
- `backend/package.json`
- `backend/tsconfig.json`
- Estrutura de `backend/src/`

**O que procurar:**
- Diferenças nos scripts
- Flags diferentes no `ts-node-dev`
- Configurações de TypeScript diferentes

---

## 🛠️ Comando para o Cursor (se precisar corrigir)

### Passo 1: Abrir arquivo
```
backend/package.json
```

### Passo 2: Selecionar script `dev`
Selecione a linha do `dev` ou o bloco `scripts`.

### Passo 3: Comando para Cursor
**Ctrl + K → Ctrl + I**

Cole:
```
Compare este package.json com o backend/package.json do zip da Cláudia e:
1. Remova qualquer script truncado com '...'
2. Garanta que o script 'dev' use ts-node-dev com flags completas e válidas no Windows
3. Não altere outros scripts sem necessidade
4. Preserve compatibilidade com monorepo/workspaces
```

### Passo 4: Validar
- ❌ Não aceite refatorações grandes
- ✅ Aceite apenas correção do script `dev`
- ✅ Confirme que JSON está válido

---

## ▶️ Procedimento de Teste

### 1. Matar processos Node
```powershell
taskkill /F /IM node.exe
```

### 2. Ir para raiz do projeto
```powershell
cd C:\unificard
```

### 3. Iniciar backend
```powershell
npm run dev -w unificard-backend
```

### 4. Aguardar 15-20 segundos

### 5. Testar (em outro terminal)
```powershell
Invoke-WebRequest http://localhost:3000/health
```

---

## ✅ Resultado Esperado

- Backend inicia e mostra logs
- Porta 3000 fica em uso
- `/health` responde com status 200

---

## ❌ Se Não Funcionar

Informe:
1. Apareceu algum log? (sim/não)
2. Qual foi o último log?
3. Apareceu algum erro? (cole completo)

Isso identifica se é:
- Problema de runtime (DB/env/etc)
- Problema de configuração
- Problema de dependências

---

## 📌 Importante

O problema **NÃO foi bug de código**.
Foi **script truncado com `...`** que impedia o backend de iniciar.

Agora que está corrigido, qualquer erro será **real e explícito**.













