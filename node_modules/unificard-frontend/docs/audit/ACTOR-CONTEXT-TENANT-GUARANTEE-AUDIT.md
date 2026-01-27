# Auditoria — Actor Context × Tenant Guarantee

**Data:** 2024-12-19  
**Status:** ✅ AUDITORIA COMPLETA E CORREÇÕES APLICADAS

## Objetivo

Garantir que `x-acting-actor-id` nunca seja enviado sem `tenantId` válido e que actor nunca exista fora de tenant válido.

## Garantias Implementadas

### 1. Frontend: Actor só é enviado após tenantId estar validado

**Implementação:**
- `x-acting-actor-id` só é enviado APÓS `x-tenant-id` estar validado
- Ordem determinística garantida: `tenantId` validado → `actorId` enviado
- Comentário explícito documentando a invariante

**Localização:** `frontend/src/api/client.ts` (linhas 169-185)

**Código:**
```typescript
// 🔴 GARANTIA FINAL: tenantId válido - sempre enviar header
headers['x-tenant-id'] = tenantId;

// 🔴 INVARIANTE ABSOLUTA: x-acting-actor-id só é enviado APÓS tenantId estar validado
// Actor nunca existe fora de tenant válido - garantir ordem determinística
```

### 2. Backend: Validação explícita de coerência actor × tenant

**Implementação:**
- Validação explícita de que actor pertence ao tenant correto
- Erro HTTP 403 se actor não pertence ao tenant
- Detalhes incluídos no erro para diagnóstico

**Localização:** `backend/src/core/action-context/action-context.middleware.ts` (linhas 89-110)

**Código:**
```typescript
// 🔴 GARANTIA CANÔNICA: Verificar se actor existe E pertence ao tenant correto
// Actor nunca existe fora de tenant válido - validação explícita de coerência
const actor = await actorRepository.findById(tenantId, actingActorId);
if (!actor) {
  return reply.status(404).send({ 
    error: 'Acting actor not found',
    details: { actingActorId, tenantId, reason: 'Actor não encontrado ou não pertence ao tenant' }
  });
}

// 🔴 VALIDAÇÃO EXPLÍCITA: Garantir que actor pertence ao tenant correto
if (actor.tenant_id !== tenantId) {
  return reply.status(403).send({ 
    error: 'Actor tenant mismatch',
    details: { actingActorId, actorTenantId: actor.tenant_id, requestTenantId: tenantId }
  });
}
```

### 3. Troca de actor invalida queries corretamente

**Implementação:**
- Dispara evento `invalidate-queries` quando actor muda
- Dispara evento `active-actor-changed` para componentes reagirem
- Múltiplos componentes escutam esses eventos

**Localização:** `frontend/src/contexts/SessionProvider.tsx` (linhas 420-428)

**Componentes que escutam:**
- `SocialLayout.tsx` - escuta `active-actor-changed`
- `HomeContextual.tsx` - escuta `active-actor-changed` e `invalidate-queries`
- `WorkflowAssistant.tsx` - escuta `invalidate-queries`
- `PendingActionsCenter.tsx` - escuta `invalidate-queries`
- `SocialFeed2.tsx` - escuta `active-actor-changed`
- `DisputePanel.tsx` - escuta `invalidate-queries`

## Fluxo de Execução

### Frontend (apiFetch):

1. **FASE 1: Validar tenantId**
   - Extrair do storage ou JWT
   - Validar (string não vazia)
   - Erro fatal se ausente

2. **FASE 2: Enviar x-tenant-id**
   - `headers['x-tenant-id'] = tenantId`
   - Garantido válido

3. **FASE 3: Enviar x-acting-actor-id (se disponível)**
   - Apenas APÓS `tenantId` estar validado
   - Prioridade: header explícito > localStorage
   - Não enviar se ausente (backend trata)

### Backend (action-context.middleware):

1. **FASE 1: Validar tenant**
   - `req.tenant.id` obrigatório
   - Erro HTTP 400 se ausente

2. **FASE 2: Resolver actingActorId**
   - Header `x-acting-actor-id` > body `actingActorId` > user actor default

3. **FASE 3: Validar actor existe**
   - `actorRepository.findById(tenantId, actingActorId)`
   - Erro HTTP 404 se não encontrado

4. **FASE 4: Validar coerência actor × tenant**
   - `actor.tenant_id === tenantId`
   - Erro HTTP 403 se não corresponder

5. **FASE 5: Validar autoridade**
   - Ownership, delegação ou system
   - Erro HTTP 403 se não autorizado

## Pontos de Validação

### ✅ Frontend (apiFetch)

1. **Linha 169:** `tenantId` validado antes de enviar header
2. **Linha 170:** `x-tenant-id` enviado (garantido válido)
3. **Linha 172-185:** `x-acting-actor-id` enviado APÓS `tenantId` validado
4. **Comentário explícito:** Documenta invariante de ordem

### ✅ Backend (action-context.middleware)

1. **Linha 47-49:** Validação de `req.tenant.id` obrigatório
2. **Linha 89-94:** Validação de que actor existe
3. **Linha 96-110:** Validação explícita de coerência actor × tenant
4. **Erro HTTP 403:** Se actor não pertence ao tenant

### ✅ Troca de Actor (SessionProvider)

1. **Linha 420-422:** Dispara `active-actor-changed`
2. **Linha 426-428:** Dispara `invalidate-queries`
3. **Múltiplos listeners:** Componentes reagem corretamente

## Proibições Explícitas

### ❌ NÃO permitido:
- Enviar `x-acting-actor-id` sem `tenantId` válido
- Actor existir fora de tenant válido
- Continuar requisição com actor de tenant diferente
- Trocar actor sem invalidar queries

### ✅ Permitido:
- Enviar `x-acting-actor-id` APÓS `tenantId` validado
- Actor pertencer ao tenant correto
- Erro explícito se inconsistência ocorrer
- Invalidar queries ao trocar actor

## Critérios de Sucesso

### ✅ Nenhuma ação com actor fora de tenant
- Frontend: `actorId` só enviado após `tenantId` validado
- Backend: Validação explícita de coerência actor × tenant
- Erro HTTP 403 se inconsistência ocorrer

### ✅ Falhas explícitas se inconsistência ocorrer
- Erro HTTP 404 se actor não encontrado
- Erro HTTP 403 se actor não pertence ao tenant
- Detalhes incluídos no erro para diagnóstico

### ✅ Troca de actor invalida queries corretamente
- Dispara `invalidate-queries` quando actor muda
- Dispara `active-actor-changed` para componentes reagirem
- Múltiplos componentes escutam e reagem

## Conclusão

**✅ Actor Context × Tenant Guarantee PASSOU**

Todas as garantias foram implementadas:
- Actor só é enviado após `tenantId` estar validado (frontend)
- Validação explícita de coerência actor × tenant (backend)
- Troca de actor invalida queries corretamente
- Falhas explícitas se inconsistência ocorrer

**Status Final:** ✅ AUDITORIA PASSOU - Actor nunca existe fora de tenant válido




