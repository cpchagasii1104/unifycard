# Integração: Alertas de Conflito de Agenda → Inbox Social

**Data**: 2024-12-19  
**Escopo**: Conectar detecção de conflitos de disponibilidade ao Inbox Social

---

## 1. OBJETIVO

Conectar alertas de conflito de agenda ao **INBOX SOCIAL**, sem criar decisão automática.

Quando ocorrer detecção de conflito relevante em ações do sistema, criar um "inbox item" para o actor afetado, apenas como organização/alerta.

---

## 2. FONTES QUE GERAM ALERTA

### 2.1. Adicionar Participante em Availability

**Endpoint**: `POST /availability/:availabilityId/participants`

**Fluxo**:
1. Criar participante (NÃO bloqueia conflitos)
2. Detectar conflitos via `detectConflicts()`
3. Se houver conflitos, emitir effect `AVAILABILITY_CONFLICT_DETECTED`
4. Effect é projetado para criar item no inbox

**Payload do Effect**:
```typescript
{
  actorId: string, // Actor participante (quem deve ser alertado)
  actorType: string,
  sourceId: string, // availability_id (principal)
  sourceType: 'availability',
  metadata: {
    availabilityId: string,
    conflictingAvailabilityIds: string[],
    windowStart: string, // ISO 8601
    windowEnd: string, // ISO 8601
    source: 'participant_added',
    conflicts: Array<{
      conflictingAvailabilityId: string,
      conflictingOwnerType: string,
      conflictingOwnerId: string,
      conflictingStartDatetime: string,
      conflictingEndDatetime: string,
    }>,
  },
}
```

### 2.2. Criar Booking

**Endpoint**: `POST /availability/bookings`

**Fluxo**:
1. Criar booking (NÃO bloqueia conflitos)
2. Se `availability.ownerType === 'user'`, detectar conflitos para `requesterActorId`
3. Se houver conflitos, emitir effect `AVAILABILITY_CONFLICT_DETECTED`
4. Effect é projetado para criar item no inbox

**Payload do Effect**:
```typescript
{
  actorId: string, // Actor requester (quem deve ser alertado)
  actorType: string,
  sourceId: string, // availability_id (principal)
  sourceType: 'availability',
  metadata: {
    availabilityId: string,
    bookingId: string,
    conflictingAvailabilityIds: string[],
    windowStart: string, // ISO 8601
    windowEnd: string, // ISO 8601
    source: 'booking_created',
    conflicts: Array<{...}>,
  },
}
```

---

## 3. EFFECT CANÔNICO

### 3.1. Enum

**Arquivo**: `src/modules/social/actor-effects.types.ts`

```typescript
export enum ActorEffect {
  // ...
  AVAILABILITY_CONFLICT_DETECTED = 'AVAILABILITY_CONFLICT_DETECTED',
}
```

### 3.2. Payload Mínimo

- `tenant_id`: UUID do tenant
- `actor_id`: UUID do actor que deve ser alertado
- `availability_id`: UUID da availability principal
- `conflicting_availability_ids[]`: Lista de IDs de disponibilidades conflitantes
- `window_start`: ISO 8601 (início da janela da availability principal)
- `window_end`: ISO 8601 (fim da janela da availability principal)
- `source`: `'participant_added'` | `'booking_created'`

---

## 4. INTEGRAÇÃO COM INBOX

### 4.1. InboxSourceType

**Arquivo**: `src/modules/inbox/social-inbox.types.ts`

```typescript
export enum InboxSourceType {
  // ...
  AVAILABILITY_CONFLICT = 'availability_conflict',
}
```

### 4.2. Projector

**Arquivo**: `src/modules/inbox/social-inbox.projector.ts`

**Mapeamento**:
- `AVAILABILITY_CONFLICT_DETECTED` → `InboxSourceType.AVAILABILITY_CONFLICT`
- `targetActorId`: `payload.actorId` (actor que deve ser alertado)
- `sourceId`: `metadata.availabilityId` (availability principal)
- `status`: `unread` (padrão)

### 4.3. Ordenação

**🔴 BLINDAGEM**: Ordenação apenas por `created_at DESC`

**Proibições**:
- ❌ NÃO ordenar por score
- ❌ NÃO ordenar por importância
- ❌ NÃO ordenar por prioridade

---

## 5. BLINDAGENS IMPLEMENTADAS

### 5.1. Alerta ≠ Decisão

- ✅ Conflitos são **ALERTAS**, não bloqueios
- ✅ Criação de participant/booking **continua** mesmo com conflito
- ✅ Effect apenas **registra** o alerta, não bloqueia

### 5.2. Inbox Não Executa

- ✅ Inbox é **READ MODEL** (derivado de effects)
- ✅ Inbox **NÃO decide** nada
- ✅ Inbox **NÃO cria** ação automática
- ✅ Inbox apenas **ORGANIZA** o que já aconteceu

### 5.3. Comentários Explícitos

Todos os pontos críticos têm comentários `🔴 BLINDAGEM` explicando:
- Que alerta ≠ decisão
- Que inbox não executa nada
- Que ordenação é apenas por `created_at DESC`

---

## 6. ARQUIVOS MODIFICADOS

### 6.1. Backend

1. **`src/modules/social/actor-effects.types.ts`**
   - Adicionado `AVAILABILITY_CONFLICT_DETECTED` ao enum

2. **`src/modules/inbox/social-inbox.types.ts`**
   - Adicionado `AVAILABILITY_CONFLICT` ao enum `InboxSourceType`

3. **`src/modules/inbox/social-inbox.projector.ts`**
   - Adicionado case para `AVAILABILITY_CONFLICT_DETECTED`
   - Mapeia para `InboxSourceType.AVAILABILITY_CONFLICT`

4. **`src/core/availability/unified-availability.service.ts`**
   - Modificado `createParticipant()` para emitir effect quando houver conflitos
   - Modificado `createBooking()` para emitir effect quando houver conflitos (se `ownerType === 'user'`)

5. **`src/core/read-models/read-model.projector.ts`**
   - Adicionado `AVAILABILITY_CONFLICT_DETECTED` ao `EFFECT_READ_MODEL_MAP`
   - Mapeia para `INBOX_READ_MODEL` e `INBOX_COUNTER_READ_MODEL`

---

## 7. FLUXO COMPLETO

### 7.1. Adicionar Participante com Conflito

```
1. POST /availability/:availabilityId/participants
   ↓
2. unifiedAvailabilityService.createParticipant()
   ↓
3. unifiedAvailabilityRepository.createParticipant() (cria participante)
   ↓
4. unifiedAvailabilityService.detectConflicts() (detecta conflitos)
   ↓
5. Se hasConflicts === true:
   ↓
6. eventBus.publish(AVAILABILITY_CONFLICT_DETECTED)
   ↓
7. socialInboxProjector.projectInboxItem()
   ↓
8. socialInboxRepository.upsert() (cria item no inbox)
   ↓
9. Actor recebe alerta no inbox (status: unread)
```

### 7.2. Criar Booking com Conflito

```
1. POST /availability/bookings
   ↓
2. unifiedAvailabilityService.createBooking()
   ↓
3. unifiedAvailabilityRepository.createBooking() (cria booking)
   ↓
4. Se availability.ownerType === 'user':
   ↓
5. unifiedAvailabilityService.detectConflicts() (detecta conflitos)
   ↓
6. Se hasConflicts === true:
   ↓
7. eventBus.publish(AVAILABILITY_CONFLICT_DETECTED)
   ↓
8. socialInboxProjector.projectInboxItem()
   ↓
9. socialInboxRepository.upsert() (cria item no inbox)
   ↓
10. Actor recebe alerta no inbox (status: unread)
```

---

## 8. VALIDAÇÕES

- ✅ `pnpm run build:check` → PASS
- ✅ `pnpm run build` → PASS

---

## 9. OBSERVAÇÕES

### 9.1. Não Bloqueia

- ✅ Criação de participant/booking **sempre** continua, mesmo com conflito
- ✅ Effect é emitido **após** criar participant/booking
- ✅ Se emissão de effect falhar, **não quebra** o fluxo principal

### 9.2. Apenas Alerta

- ✅ Conflitos são **informação**, não decisão
- ✅ Confirmação de sobreposição **cabe ao usuário**
- ✅ Inbox apenas **organiza** os alertas

### 9.3. Ordenação

- ✅ Items do inbox são ordenados por `created_at DESC`
- ❌ **NÃO** ordena por score, importância ou prioridade

---

## 10. PRÓXIMOS PASSOS (FUTURO)

- [ ] Frontend pode exibir alertas de conflito no inbox
- [ ] Frontend pode permitir ação do usuário sobre conflitos (ex: confirmar, ignorar)
- [ ] Frontend pode navegar para agenda a partir do alerta

---

**Status**: ✅ Implementação completa e validada

