# Implementação: Inbox Social & Notificações de Ação

**Data**: 2024-12-19  
**Escopo**: Criação do INBOX SOCIAL DE AÇÕES, consumindo Dispatch, Bookings, Decisões e Pagamentos

---

## 1. DEFINIÇÃO CANÔNICA

### Inbox Social NÃO é:
- ❌ Decisão
- ❌ Ação automática
- ❌ Alteração de estado de domínio
- ❌ Ordenação por score
- ❌ Ordenação por importância
- ❌ Fonte de verdade

### Inbox Social É:
- ✅ READ MODEL (derivado de effects)
- ✅ Organização do que já aconteceu
- ✅ Visualização histórica
- ✅ Apenas ORGANIZA

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/143_social_inbox.sql`):
   - Tabela `social_inbox_items` com campos:
     - `actor_id`: Actor destinatário
     - `source_type`: Tipo da fonte ('dispatch', 'booking', 'decision', 'payment')
     - `source_id`: ID da entidade fonte
     - `status`: Status ('unread', 'read', 'archived')
     - `created_at`, `read_at`, `archived_at`
   - Enums: `inbox_item_status`, `inbox_source_type`
   - Constraint UNIQUE: apenas um item por actor + source_type + source_id
   - Índices para performance

2. **Tipos** (`src/modules/inbox/social-inbox.types.ts`):
   - `InboxSourceType` enum ('dispatch', 'booking', 'decision', 'payment')
   - `InboxItemStatus` enum ('unread', 'read', 'archived')
   - `SocialInboxItem` interface
   - `InboxCounter` interface
   - `SocialInboxFilters` interface

3. **Repository** (`src/modules/inbox/social-inbox.repository.ts`):
   - `upsert()` - Cria ou atualiza item do inbox
   - `findById()` - Busca item por ID
   - `find()` - Lista items com filtros
   - `updateStatus()` - Atualiza status (read/archived)
   - `getCounter()` - Calcula contador de inbox
   - 🔴 BLINDAGEM: Ordenação apenas por `created_at` DESC (mais recente primeiro)
   - 🔴 BLINDAGEM: NUNCA por score, NUNCA por importância

4. **Projector** (`src/modules/inbox/social-inbox.projector.ts`):
   - `projectInboxItem()` - Projeta item do inbox a partir de effect
   - Mapeia effects para criar items do inbox:
     - `OPPORTUNITY_DISPATCHED` → `dispatch`
     - `OPPORTUNITY_DISPATCH_RESPONDED` → `dispatch`
     - `SERVICE_BOOKING_REQUESTED` → `booking`
     - `SERVICE_BOOKING_ACCEPTED/REJECTED` → `decision`
     - `SERVICE_PAYMENT_REQUESTED` → `payment`
     - `SERVICE_PAYMENT_EXECUTED` → `payment`

5. **Service** (`src/modules/inbox/social-inbox.service.ts`):
   - `getInboxItems()` - Busca items do inbox de um actor
   - `getInboxCounter()` - Busca contador de inbox
   - `markAsRead()` - Marca item como lido
   - `archive()` - Arquivar item
   - 🔴 BLINDAGEM: Apenas organização, não decisão

6. **Routes** (`src/modules/inbox/social-inbox.routes.ts`):
   - `GET /inbox/actors/:id` - Listar items do inbox
   - `GET /inbox/actors/:id/counter` - Buscar contador
   - `POST /inbox/:itemId/read` - Marcar como lido
   - `POST /inbox/:itemId/archive` - Arquivar item

7. **Module** (`src/modules/inbox/inbox.module.ts`):
   - Registrado rotas de inbox com prefix `/inbox`

---

## 3. FONTES OBRIGATÓRIAS

### Effects que Geram Items do Inbox

1. **`OPPORTUNITY_DISPATCHED`**:
   - Tipo: `dispatch`
   - Destinatário: Actor que recebeu o dispatch

2. **`OPPORTUNITY_DISPATCH_RESPONDED`**:
   - Tipo: `dispatch`
   - Destinatário: Actor que recebeu o dispatch

3. **`SERVICE_BOOKING_REQUESTED`**:
   - Tipo: `booking`
   - Destinatário: Dono do service

4. **`SERVICE_BOOKING_ACCEPTED`**:
   - Tipo: `decision`
   - Destinatário: Requester do booking

5. **`SERVICE_BOOKING_REJECTED`**:
   - Tipo: `decision`
   - Destinatário: Requester do booking

6. **`SERVICE_PAYMENT_REQUESTED`**:
   - Tipo: `payment`
   - Destinatário: Payer

7. **`SERVICE_PAYMENT_EXECUTED`**:
   - Tipo: `payment`
   - Destinatário: Receiver

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`INBOX_READ_MODEL`**:
   - Inbox social de ações
   - Atualizado quando: Todos os effects de dispatch, booking, decision, payment

2. **`INBOX_COUNTER_READ_MODEL`**:
   - Contador de inbox (quantidade de pendentes)
   - Atualizado quando: Todos os effects de dispatch, booking, decision, payment

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.OPPORTUNITY_DISPATCHED]: [
  ReadModelType.INBOX_READ_MODEL,
  ReadModelType.INBOX_COUNTER_READ_MODEL,
  // ... outros read models
]
[ActorEffect.SERVICE_BOOKING_REQUESTED]: [
  ReadModelType.INBOX_READ_MODEL,
  ReadModelType.INBOX_COUNTER_READ_MODEL,
  // ... outros read models
]
// ... outros effects
```

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`social-inbox.types.ts`**:
   - Explica que inbox é READ MODEL (derivado de effects)
   - Explica que inbox NÃO decide nada
   - Explica que inbox NÃO cria ação automática
   - Explica que inbox apenas ORGANIZA o que já aconteceu

2. **`social-inbox.repository.ts`**:
   - Comentário: "Inbox é READ MODEL (derivado de effects)"
   - Comentário: "Nenhuma lógica de decisão ou ação automática aqui"
   - Comentário: "Ordenação apenas por created_at DESC (mais recente primeiro)"
   - Comentário: "NUNCA por score, NUNCA por importância"
   - Comentário: "Apenas organização, não decisão"

3. **`social-inbox.projector.ts`**:
   - Comentários: "Inbox é READ MODEL (derivado de effects)"
   - Comentários: "Inbox NÃO decide nada"
   - Comentários: "Inbox NÃO cria ação automática"
   - Comentários: "Inbox apenas ORGANIZA o que já aconteceu"
   - Comentários: "Não decide nada, apenas organiza o que já aconteceu"

4. **`social-inbox.service.ts`**:
   - Comentários: "Apenas organização, não decisão"
   - Comentários: "NÃO cria ação automática"
   - Comentários: "Apenas ORGANIZA o que já aconteceu"

5. **`social-inbox.routes.ts`**:
   - Comentários: "NÃO cria decisão, NÃO executa ação, NÃO altera estado de domínio"
   - Comentários: "Apenas organização, não decisão"
   - Comentários: "NUNCA ordenar por score ou importância"

---

## 6. ENDPOINTS

### Backend

1. **`GET /inbox/actors/:id`**:
   - Listar items do inbox de um actor
   - Query params opcionais: `status` (unread/read/archived), `sourceType` (dispatch/booking/decision/payment)
   - Retorna: Lista de items ordenada por `created_at` DESC

2. **`GET /inbox/actors/:id/counter`**:
   - Buscar contador de inbox de um actor
   - Retorna: `{ unreadCount, readCount, archivedCount, totalCount }`

3. **`POST /inbox/:itemId/read`**:
   - Marcar item do inbox como lido
   - Atualiza: `status = 'read'`, `read_at = now()`
   - 🔴 BLINDAGEM: Apenas organização, não decisão

4. **`POST /inbox/:itemId/archive`**:
   - Arquivar item do inbox
   - Atualiza: `status = 'archived'`, `archived_at = now()`
   - 🔴 BLINDAGEM: Apenas organização, não decisão

---

## 7. REGRAS DE NEGÓCIO

### Regra Fundamental

- ✅ **Inbox é READ MODEL (derivado de effects)**
  - Criado automaticamente quando effects são emitidos
  - Não decide nada
  - Não cria ação automática
  - Apenas ORGANIZA o que já aconteceu

### Status do Item

- ✅ **unread**: Item não lido (padrão)
- ✅ **read**: Item lido (marcado pelo usuário)
- ✅ **archived**: Item arquivado (marcado pelo usuário)

### Constraint UNIQUE

- ✅ **Apenas um item por actor + source_type + source_id**
  - Evita duplicação de items
  - Usa `ON CONFLICT` para atualizar se já existir

---

## 8. PROIBIÇÕES ABSOLUTAS

- ❌ NÃO criar decisão
- ❌ NÃO executar ação
- ❌ NÃO alterar estado de domínio
- ❌ NÃO ordenar por score ou importância
- ❌ NÃO usar educação como critério
- ❌ NÃO usar score como critério

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/143_social_inbox.sql`
   - Migration para criar tabela `social_inbox_items`

2. `src/modules/inbox/social-inbox.types.ts`
   - Tipos do domínio de inbox

3. `src/modules/inbox/social-inbox.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/inbox/social-inbox.projector.ts`
   - Projector para criar items do inbox a partir de effects

5. `src/modules/inbox/social-inbox.service.ts`
   - Service com lógica de negócio

6. `src/modules/inbox/social-inbox.routes.ts`
   - Rotas Fastify

7. `src/modules/inbox/inbox.module.ts`
   - Módulo do inbox

### Backend (alterados)

8. `src/core/read-models/read-model.types.ts`
   - Adicionado: `INBOX_READ_MODEL`, `INBOX_COUNTER_READ_MODEL`

9. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para inbox
   - Adicionado projeção específica para INBOX_READ_MODEL
   - Adicionado INBOX_READ_MODEL e INBOX_COUNTER_READ_MODEL aos effects relevantes

10. `src/server.ts`
    - Registrado módulo inbox com prefix `/inbox`

---

## 11. EXEMPLOS DE USO

### Listar Items do Inbox

```typescript
GET /inbox/actors/{actorId}?status=unread&sourceType=booking
```

Resposta:
```json
{
  "ok": true,
  "data": [
    {
      "inboxItemId": "uuid-do-item",
      "actorId": "uuid-do-actor",
      "sourceType": "booking",
      "sourceId": "uuid-do-booking",
      "status": "unread",
      "createdAt": "2024-12-19T10:00:00Z",
      "metadata": {}
    }
  ]
}
```

### Buscar Contador de Inbox

```typescript
GET /inbox/actors/{actorId}/counter
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "actorId": "uuid-do-actor",
    "tenantId": "uuid-do-tenant",
    "unreadCount": 5,
    "readCount": 10,
    "archivedCount": 2,
    "totalCount": 17,
    "lastUpdated": "2024-12-19T10:00:00Z"
  }
}
```

### Marcar Item como Lido

```typescript
POST /inbox/{itemId}/read
```

### Arquivar Item

```typescript
POST /inbox/{itemId}/archive
```

---

**Status Final**: ✅ **INBOX SOCIAL DE AÇÕES IMPLEMENTADO E VALIDADO**

