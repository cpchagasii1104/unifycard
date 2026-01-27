# 🔴 DIAGNÓSTICO: Erro 401 em /social/actors/available

**Data:** 26/12/2025  
**Sintoma:** Múltiplos 401 durante bootstrap, mas terceira tentativa funciona

---

## 📊 ANÁLISE DO LOG

```
1️⃣ Bootstrap #1 inicia
   [SessionProvider] 🚀 Iniciando bootstrap de sessão...
   [SessionProvider] ✅ FASE 1 (Auth) concluída: token e tenantId presentes
   [SessionProvider] 🔄 FASE 2 (Contexto): Carregando actors disponíveis...

2️⃣ Bootstrap #2 inicia ENQUANTO #1 ainda está rodando (RACE CONDITION)
   [SessionProvider] 🚀 Iniciando bootstrap de sessão...
   [SessionProvider] ✅ FASE 1 (Auth) concluída: token e tenantId presentes
   [SessionProvider] 🔄 FASE 2 (Contexto): Carregando actors disponíveis...

3️⃣ Primeira request falha
   GET /social/actors/available → 401 (Unauthorized)
   [API] ⚠️ 401 durante bootstrap - ignorando (não limpar token)
   → Token NÃO é limpo (dentro do grace period)

4️⃣ Bootstrap #1 termina com erro
   [SessionProvider] ✅ Actors carregados: 0 encontrado(s)
   [SessionProvider] ✅✅✅ sessionReady = true (sem actors, mas autenticado)
   [SessionProvider] 🏁 Bootstrap finalizado

5️⃣ Segunda request falha
   GET /social/actors/available → 401 (Unauthorized)
   [API] ❌ Token expirado - limpando sessão
   → Token É limpo (fora do grace period ou condição diferente)

6️⃣ Bootstrap #3 inicia e FUNCIONA
   [SessionProvider] 🚀 Iniciando bootstrap de sessão...
   [SessionProvider] ✅ FASE 1 (Auth) concluída: token e tenantId presentes
   [SessionProvider] ✅ Actors carregados: 1 encontrado(s)
   [SessionProvider] ✅ Actor único selecionado: Clayton Pereira Chagas
```

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Problema 1: Race Condition no Bootstrap

O `useEffect` no `SessionProvider.tsx` roda duas vezes:
- Linha 206: `useEffect(() => { bootstrapSession(); }, []);`
- Linha 210-245: `useEffect` que escuta `auth-changed`

**Por quê duas vezes?**
1. O login dispara evento `auth-changed`
2. O segundo useEffect escuta esse evento e chama `bootstrapSession()` novamente
3. Ambos rodam quase simultaneamente

**O guard `if (isBootstrapping)` não funciona porque:**
- O state `isBootstrapping` é setado na linha 58 (dentro da função)
- Mas entre a chamada e o `setIsBootstrapping(true)`, outra chamada pode passar pelo guard
- React state updates são assíncronos

### Problema 2: Token Rejeitado no Backend

O backend retorna 401 com "Invalid or expired token". Possíveis causas:

1. **token_version mismatch** - O token foi gerado com token_version X mas o banco tem Y
2. **JWT expirado** - Token expirou
3. **Timing issue** - Token foi gerado mas banco ainda não está sincronizado

### Problema 3: Inconsistência no Grace Period

A segunda request limpa o token mesmo tendo sido feita logo após a primeira.

**Código no client.ts:**
```typescript
const inBootstrap = isInBootstrapGracePeriod();

if (inBootstrap) {
  console.warn('[API] ⚠️ 401 durante bootstrap - ignorando');
  throw error; // Não limpa token
}

// Se chegar aqui, limpa o token
if (isExpired) {
  clearAuthToken();
}
```

O problema é que `setBootstraping(false)` é chamado no `finally` do bootstrap #1, o que encerra o grace period antes do bootstrap #2 terminar.

---

## 🛠️ SOLUÇÕES

### Solução A: Usar Ref para Guard (Síncrono)

**Arquivo:** `SessionProvider.tsx`

```typescript
// ANTES (assíncrono - race condition)
const [isBootstrapping, setIsBootstrapping] = useState(false);

// DEPOIS (síncrono - sem race condition)
const isBootstrappingRef = useRef(false);

const bootstrapSession = async () => {
  // Guard síncrono
  if (isBootstrappingRef.current) {
    console.warn('[SessionProvider] Bootstrap já em andamento, ignorando');
    return;
  }
  isBootstrappingRef.current = true;
  
  try {
    // ... resto do código
  } finally {
    isBootstrappingRef.current = false;
  }
};
```

### Solução B: Debounce no Bootstrap

**Arquivo:** `SessionProvider.tsx`

```typescript
const bootstrapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const bootstrapSession = useCallback(() => {
  // Cancelar qualquer bootstrap pendente
  if (bootstrapTimeoutRef.current) {
    clearTimeout(bootstrapTimeoutRef.current);
  }
  
  // Debounce de 100ms
  bootstrapTimeoutRef.current = setTimeout(async () => {
    // ... código do bootstrap
  }, 100);
}, []);
```

### Solução C: Grace Period por Request (não global)

**Arquivo:** `client.ts`

O grace period atual é global. Se um bootstrap termina, o grace period acaba para TODOS.

**Melhor:** Usar um timestamp por request ou não limpar token em 401 durante QUALQUER bootstrap ativo.

---

## 📋 PROMPT PARA CURSOR (Solução A - Recomendada)

```markdown
CONTEXTO
O SessionProvider.tsx está sofrendo race condition no bootstrap.
Duas chamadas simultâneas para bootstrapSession() causam 401 no primeiro request
e comportamento inconsistente.

O guard atual usa useState que é assíncrono e não previne a race condition.

OBJETIVO
Substituir o guard assíncrono por um ref síncrono.

ARQUIVO A MODIFICAR

backend/frontend/src/contexts/SessionProvider.tsx

MUDANÇAS

1. Adicionar import de useRef:
```typescript
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
```

2. Substituir useState por useRef para o guard:

ANTES (linha 26):
```typescript
const [isBootstrapping, setIsBootstrapping] = useState(false);
```

DEPOIS:
```typescript
const isBootstrappingRef = useRef(false);
```

3. Modificar o guard no início de bootstrapSession():

ANTES (linhas 29-33):
```typescript
// Prevenir múltiplas chamadas simultâneas
if (isBootstrapping) {
  console.warn('[SessionProvider] Bootstrap já em andamento, ignorando chamada duplicada');
  return;
}
```

DEPOIS:
```typescript
// Guard SÍNCRONO para prevenir race condition
if (isBootstrappingRef.current) {
  console.warn('[SessionProvider] Bootstrap já em andamento, ignorando chamada duplicada');
  return;
}
isBootstrappingRef.current = true;
```

4. Remover setIsBootstrapping(true) da linha 58 (já feito acima)

5. Substituir setIsBootstrapping(false) por isBootstrappingRef.current = false nos locais:
- Linha 103-104: dentro do `if (postableActors.length === 0)`
- Linha 161-162: no `finally`

RESULTADO ESPERADO
- Bootstrap roda apenas UMA vez por ciclo
- Race condition eliminada
- Apenas um request para /social/actors/available
```

---

## ⚠️ INVESTIGAÇÃO ADICIONAL NECESSÁRIA

Se a race condition for corrigida e o 401 ainda acontecer, o problema está no **backend**.

**Para verificar:**
1. Ver log do backend quando retorna 401
2. Verificar se `token_version` do JWT bate com o do banco
3. Verificar se JWT não expirou

**Comando para verificar no PostgreSQL:**
```sql
SELECT user_id, email, token_version 
FROM users 
WHERE email = 'seu-email@exemplo.com';
```

---

## 🎯 RESUMO

| Problema | Causa | Solução |
|----------|-------|---------|
| Múltiplos bootstraps | Race condition com useState | Usar useRef |
| 401 intermitente | Requests duplicados | Corrigir race condition |
| Grace period inconsistente | Bootstrap #1 termina antes de #2 | Ref resolve |

**Prioridade:** Aplicar Solução A primeiro. Se ainda falhar, investigar backend.
