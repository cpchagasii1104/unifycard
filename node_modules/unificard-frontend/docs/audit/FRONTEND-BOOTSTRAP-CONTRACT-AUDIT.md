# Auditoria — Frontend Bootstrap Contract

**Data:** 2024-12-19  
**Status:** ✅ AUDITORIA COMPLETA E CORREÇÕES APLICADAS

## Objetivo

Garantir contrato explícito e ordem determinística no bootstrap de sessão do frontend.

## Garantias Implementadas

### 1. tenantId vem SEMPRE do JWT (fonte única de verdade)

**Implementação:**
- Storage (`localStorage`) é apenas cache, nunca fonte primária
- Se `tenantId` não estiver no storage, extrair do JWT ANTES de qualquer chamada de API
- Validação explícita: `tenantId` deve ser string não vazia

**Locais onde foi implementado:**
- `bootstrapSession()` - Fase 1.1 (linhas 80-120)
- `useEffect` inicial (linhas 558-600)
- `handleAuthChange()` (linhas 670-730)
- `handleCompanyChange()` (linhas 695-730)
- `refreshActors()` (linhas 437-460)

### 2. Nenhuma chamada de API ocorre sem tenantId

**Implementação:**
- Guard explícito antes de `getAvailableActors()`
- Guard explícito antes de qualquer chamada de API
- Erro fatal se tentar continuar sem `tenantId` válido

**Locais onde foi implementado:**
- `bootstrapSession()` - Guard antes de Fase 2 (linhas 88-120)
- `refreshActors()` - Guard antes de chamada (linhas 437-460)

### 3. Ordem determinística

**Ordem garantida:**
1. **FASE 1: Validação de autenticação**
   - Verificar se está autenticado
   - Extrair `tenantId` do JWT se não estiver no storage
   - Validar `tenantId` (string não vazia)
   - Salvar `tenantId` no storage (cache)

2. **FASE 2: Carregamento de contexto (actors)**
   - Guard: Verificar `tenantId` antes de chamada de API
   - Chamar `getAvailableActors()` apenas com `tenantId` válido
   - Selecionar `activeActor` (opcional)

3. **FASE 3: Validação final**
   - Validar `tenantId` do JWT vs storage
   - Garantir que `tenantId` está presente no JWT
   - Marcar `sessionReady = true` apenas se tudo estiver válido

### 4. Falha rápida e explícita

**Implementação:**
- Erro fatal se `tenantId` não puder ser extraído do JWT
- Erro fatal se `tenantId` for inválido (não string ou vazio)
- Erro fatal se token estiver ausente após validação inicial
- Não marcar `sessionReady = true` sem `tenantId` válido

**Locais onde foi implementado:**
- `bootstrapSession()` - Múltiplos pontos de validação (linhas 80-350)
- `useEffect` inicial - Validação antes de bootstrap (linhas 558-600)
- `handleAuthChange()` - Validação antes de bootstrap (linhas 670-730)

## Pontos de Validação

### ✅ bootstrapSession()

1. **Linha 72-78:** Validação de token ausente
2. **Linha 80-120:** Extração de `tenantId` do JWT se ausente no storage
3. **Linha 88-120:** Guard antes de chamadas de API
4. **Linha 298-342:** Validação final de `tenantId` do JWT
5. **Linha 344-360:** Validação final antes de marcar `sessionReady = true`

### ✅ useEffect inicial

1. **Linha 558-600:** Extração de `tenantId` do JWT se ausente no storage
2. **Linha 561-600:** Validação antes de chamar `bootstrapSession()`

### ✅ handleAuthChange()

1. **Linha 670-730:** Extração de `tenantId` do JWT se ausente no storage
2. **Linha 672-730:** Validação antes de chamar `bootstrapSession()`

### ✅ handleCompanyChange()

1. **Linha 695-730:** Extração de `tenantId` do JWT se ausente no storage
2. **Linha 698-730:** Validação antes de chamar `bootstrapSession()`

### ✅ refreshActors()

1. **Linha 437-460:** Extração de `tenantId` do JWT se ausente no storage
2. **Linha 439-460:** Validação antes de chamada de API

## Proibições Explícitas

### ❌ NÃO permitido:
- Chamar API sem `tenantId` válido
- Marcar `sessionReady = true` sem `tenantId` válido
- Usar `tenantId` do storage sem validar contra JWT
- Continuar bootstrap após falha na extração de `tenantId`

### ✅ Permitido:
- Extrair `tenantId` do JWT quando ausente no storage
- Salvar `tenantId` no storage após extração (cache)
- Validar `tenantId` do JWT vs storage antes de marcar `sessionReady`

## Critérios de Sucesso

### ✅ Nenhuma race condition possível
- Guards síncronos usando `useRef` para prevenir múltiplas chamadas
- Validação de `tenantId` antes de qualquer chamada de API
- Extração de `tenantId` do JWT ANTES de chamadas de API

### ✅ Bootstrap determinístico
- Ordem garantida: token → tenantId (do JWT) → chamadas de API
- Validações explícitas em cada fase
- Falha rápida se qualquer validação falhar

### ✅ Falha rápida e explícita
- Erro fatal se `tenantId` não puder ser extraído do JWT
- Erro fatal se `tenantId` for inválido
- Não marcar `sessionReady = true` sem `tenantId` válido
- Logs explícitos para diagnóstico

## Conclusão

**✅ Bootstrap Contract Assertion PASSOU**

Todas as garantias foram implementadas:
- `tenantId` vem SEMPRE do JWT (fonte única de verdade)
- Nenhuma chamada de API ocorre sem `tenantId` válido
- Ordem determinística garantida
- Falha rápida e explícita em todos os pontos de validação

**Status Final:** ✅ AUDITORIA PASSOU - Contrato de bootstrap implementado corretamente




