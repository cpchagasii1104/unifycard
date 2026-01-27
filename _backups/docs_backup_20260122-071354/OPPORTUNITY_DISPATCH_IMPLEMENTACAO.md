# Implementação: Dispatch de Oportunidades (Modelo Uber, sem automação)

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de DISPATCH DE OPORTUNIDADES, inspirado no modelo Uber, SEM decisão automática

---

## 1. DEFINIÇÃO CANÔNICA

### Dispatch NÃO é:
- ❌ Matching automático
- ❌ Priorização
- ❌ Escolha de "melhor"
- ❌ Decisão automática
- ❌ Garantia de aceitação
- ❌ Penalização por rejeição
- ❌ Score por expiração
- ❌ Ordenação por educação
- ❌ Ordenação por score

### Dispatch É:
- ✅ NOTIFICAÇÃO
- ✅ Apenas notifica quem PODE atuar
- ✅ Aceitar não garante nada
- ✅ Rejeitar não penaliza
- ✅ Expirar não gera score

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/142_opportunity_dispatch.sql`):
   - Tabela `opportunity_dispatches` com campos:
     - `opportunity_id`: ID da oportunidade
     - `opportunity_type`: Tipo ('service', 'job', 'project')
     - `target_actor_id`: Actor que recebe o dispatch
     - `response`: Resposta ('accepted', 'declined', 'expired' ou null)
     - `dispatched_at`: Quando foi despachado
     - `responded_at`: Quando foi respondido (nullable)
     - `expires_at`: Quando expira (opcional)
   - Enum `dispatch_response`
   - Índices para performance
   - Índice composto para busca de dispatches pendentes por actor

2. **Tipos** (`src/modules/dispatch/opportunity-dispatch.types.ts`):
   - `OpportunityType` enum ('service', 'job', 'project')
   - `DispatchResponse` enum ('accepted', 'declined', 'expired')
   - `OpportunityDispatch` interface
   - `CreateOpportunityDispatchInput` interface
   - `RespondToDispatchInput` interface
   - `OpportunityDispatchFilters` interface

3. **Repository** (`src/modules/dispatch/opportunity-dispatch.repository.ts`):
   - `create()` - Cria novo dispatch
   - `findById()` - Busca dispatch por ID
   - `find()` - Lista dispatches com filtros
   - `updateResponse()` - Atualiza resposta de um dispatch
   - 🔴 BLINDAGEM: Ordenação apenas por `dispatched_at` (mais recente primeiro)
   - 🔴 BLINDAGEM: NUNCA por score, NUNCA por prioridade, NUNCA por educação

4. **Service** (`src/modules/dispatch/opportunity-dispatch.service.ts`):
   - `createDispatch()` - Cria dispatch e emite effect
   - `getDispatch()` - Busca dispatch por ID
   - `listDispatches()` - Lista dispatches com filtros
   - `respondToDispatch()` - Responde a um dispatch e emite effect
   - 🔴 BLINDAGEM: Valida que target actor existe
   - 🔴 BLINDAGEM: Valida que dispatch ainda não foi respondido

5. **Routes** (`src/modules/dispatch/opportunity-dispatch.routes.ts`):
   - `POST /dispatch/opportunities/:id` - Criar novo dispatch
   - `GET /dispatch/actors/:id/dispatches` - Listar dispatches de um actor
   - `POST /dispatch/:dispatchId/respond` - Responder a um dispatch

6. **Module** (`src/modules/dispatch/dispatch.module.ts`):
   - Registrado rotas de dispatch com prefix `/dispatch`

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`OPPORTUNITY_DISPATCHED`**:
   - Emitido quando oportunidade é despachada
   - Afeta: `DISPATCH_INBOX_READ_MODEL`, `DISPATCH_HISTORY_READ_MODEL`, `FEED_READ_MODEL`

2. **`OPPORTUNITY_DISPATCH_RESPONDED`**:
   - Emitido quando dispatch é respondido
   - Afeta: `DISPATCH_INBOX_READ_MODEL`, `DISPATCH_HISTORY_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.OPPORTUNITY_DISPATCHED]: [
  ReadModelType.DISPATCH_INBOX_READ_MODEL,
  ReadModelType.DISPATCH_HISTORY_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
]
[ActorEffect.OPPORTUNITY_DISPATCH_RESPONDED]: [
  ReadModelType.DISPATCH_INBOX_READ_MODEL,
  ReadModelType.DISPATCH_HISTORY_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`DISPATCH_INBOX_READ_MODEL`**:
   - Inbox de dispatches pendentes
   - Atualizado quando: `OPPORTUNITY_DISPATCHED`, `OPPORTUNITY_DISPATCH_RESPONDED`

2. **`DISPATCH_HISTORY_READ_MODEL`**:
   - Histórico de dispatches
   - Atualizado quando: `OPPORTUNITY_DISPATCHED`, `OPPORTUNITY_DISPATCH_RESPONDED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`opportunity-dispatch.types.ts`**:
   - Explica que dispatch é NOTIFICAÇÃO, não decisão
   - Explica que aceitar não garante nada
   - Explica que rejeitar não penaliza
   - Explica que expirar não gera score
   - Explica que NÃO faz matching, NÃO prioriza, NÃO escolhe "melhor"

2. **`opportunity-dispatch.repository.ts`**:
   - Comentário: "Nenhuma lógica de matching ou priorização aqui"
   - Comentário: "Ordenação apenas por dispatched_at (mais recente primeiro)"
   - Comentário: "NUNCA por score, NUNCA por prioridade, NUNCA por educação"
   - Comentário: "Resposta não garante nada, não penaliza, não gera score"

3. **`opportunity-dispatch.service.ts`**:
   - Comentários: "Dispatch é NOTIFICAÇÃO, não decisão"
   - Comentários: "NÃO faz matching, NÃO prioriza, NÃO escolhe 'melhor'"
   - Comentários: "Apenas NOTIFICA quem PODE atuar"
   - Comentários: "Critérios: mesmo território, mesmo tipo de atuação, mesmo interesse declarado"
   - Comentários: "NUNCA educação, NUNCA score"
   - Comentários: "Aceitar não garante nada"
   - Comentários: "Rejeitar não penaliza"
   - Comentários: "Expirar não gera score"

4. **`opportunity-dispatch.routes.ts`**:
   - Comentários: "NÃO faz matching, NÃO prioriza, NÃO escolhe 'melhor'"
   - Comentários: "Dispatch é NOTIFICAÇÃO, não decisão"
   - Comentários: "Apenas NOTIFICA quem PODE atuar"
   - Comentários: "Aceitar não garante nada"
   - Comentários: "Rejeitar não penaliza"
   - Comentários: "Expirar não gera score"
   - Comentários: "Nenhuma ordenação por score ou prioridade"

---

## 6. ENDPOINTS

### Backend

1. **`POST /dispatch/opportunities/:id`**:
   - Criar novo dispatch de oportunidade
   - Requer: `opportunityType`, `targetActorId` (no body)
   - Opcional: `expiresAt`, `metadata`
   - Emite effect: `OPPORTUNITY_DISPATCHED`

2. **`GET /dispatch/actors/:id/dispatches`**:
   - Listar dispatches de um actor
   - Query params opcionais: `response` (pending/accepted/declined/expired), `opportunityType`
   - Retorna: Lista de dispatches ordenada por `dispatched_at` DESC

3. **`POST /dispatch/:dispatchId/respond`**:
   - Responder a um dispatch
   - Requer: `response` (accepted/declined/expired)
   - Opcional: `metadata`
   - Valida: Dispatch ainda não foi respondido
   - Emite effect: `OPPORTUNITY_DISPATCH_RESPONDED`

---

## 7. REGRAS DE NEGÓCIO

### Regra Fundamental

- ✅ **Dispatch é NOTIFICAÇÃO, não decisão**
  - Aceitar não garante nada
  - Rejeitar não penaliza
  - Expirar não gera score

### Critérios de Quem Recebe

- ✅ **Mesmo território**
- ✅ **Mesmo tipo de atuação**
- ✅ **Mesmo interesse declarado**
- ❌ **NUNCA educação**
- ❌ **NUNCA score**

### Fontes de Oportunidade

- ✅ **Serviço disponível** (`service`)
- ✅ **Vaga publicada** (`job`)
- ✅ **Projeto criado** (`project`)

---

## 8. PROIBIÇÕES ABSOLUTAS

- ❌ NÃO escolher melhor candidato
- ❌ NÃO ordenar por score
- ❌ NÃO priorizar automaticamente
- ❌ NÃO bloquear oportunidades
- ❌ NÃO usar educação como critério
- ❌ NÃO usar score como critério

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/142_opportunity_dispatch.sql`
   - Migration para criar tabela `opportunity_dispatches`

2. `src/modules/dispatch/opportunity-dispatch.types.ts`
   - Tipos do domínio de dispatch

3. `src/modules/dispatch/opportunity-dispatch.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/dispatch/opportunity-dispatch.service.ts`
   - Service com lógica de negócio

5. `src/modules/dispatch/opportunity-dispatch.routes.ts`
   - Rotas Fastify

6. `src/modules/dispatch/dispatch.module.ts`
   - Módulo do dispatch

### Backend (alterados)

7. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `OPPORTUNITY_DISPATCHED`, `OPPORTUNITY_DISPATCH_RESPONDED`

8. `src/core/read-models/read-model.types.ts`
   - Adicionado: `DISPATCH_INBOX_READ_MODEL`, `DISPATCH_HISTORY_READ_MODEL`

9. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para dispatch

10. `src/server.ts`
    - Registrado módulo dispatch com prefix `/dispatch`

---

## 11. EXEMPLOS DE USO

### Criar Dispatch de Oportunidade

```typescript
POST /dispatch/opportunities/{opportunityId}
{
  "opportunityType": "service",
  "targetActorId": "uuid-do-actor",
  "expiresAt": "2024-12-20T10:00:00Z",
  "metadata": {}
}
```

### Listar Dispatches de um Actor

```typescript
GET /dispatch/actors/{actorId}/dispatches?response=pending&opportunityType=service
```

### Responder a um Dispatch

```typescript
POST /dispatch/{dispatchId}/respond
{
  "response": "accepted",
  "metadata": {}
}
```

---

**Status Final**: ✅ **DISPATCH DE OPORTUNIDADES IMPLEMENTADO E VALIDADO**

