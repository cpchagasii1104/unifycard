# Implementação: Domínio de BOOKING / RESERVA

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de BOOKING / RESERVA para serviços

---

## 1. DEFINIÇÃO CANÔNICA

### Booking NÃO é:
- ❌ Confirmação
- ❌ Cobrança
- ❌ Bloqueio de agenda
- ❌ Escolha de prioridade
- ❌ Matching
- ❌ Auto-accept
- ❌ Vínculo com educação, aprendizado ou score

### Booking É:
- ✅ Um PEDIDO
- ✅ Intenção de reservar uma disponibilidade
- ✅ Pertence a um Service, Availability e RequesterActor
- ✅ Status: requested, cancelled, expired

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/138_service_booking.sql`):
   - Tabela `service_bookings` com relacionamentos obrigatórios:
     - `service_id` → `services` (FK com CASCADE)
     - `availability_id` → `service_availability` (FK com CASCADE)
     - `requester_actor_id` → `actors` (FK com CASCADE)
   - Enum: `booking_status` (requested, cancelled, expired)
   - Campos: `requested_at`, `notes` (opcional), `cancelled_at`, `expired_at`
   - Triggers para `updated_at`, `cancelled_at`, `expired_at`
   - Índices para performance

2. **Tipos** (`src/modules/services/service-booking.types.ts`):
   - `BookingStatus` enum
   - `ServiceBooking` interface
   - `CreateServiceBookingInput` interface
   - `UpdateServiceBookingInput` interface

3. **Repository** (`src/modules/services/service-booking.repository.ts`):
   - `findById()` - Busca booking por ID
   - `findByService()` - Lista bookings de um Service
   - `findByRequesterActor()` - Lista bookings de um Actor (requester)
   - `create()` - Cria novo booking (valida IDs obrigatórios)
   - `update()` - Atualiza booking

4. **Service** (`src/modules/services/service-booking.service.ts`):
   - `createBooking()` - Cria booking com validação de service, availability e requester_actor
   - `getBooking()` - Busca booking por ID
   - `getServiceBookings()` - Lista bookings de um Service
   - `getActorBookings()` - Lista bookings de um Actor (requester)
   - `updateBooking()` - Atualiza booking (apenas status e notes)

5. **Routes** (`src/modules/services/service-booking.routes.ts`):
   - `POST /services/:id/bookings` - Criar novo booking
   - `GET /services/:id/bookings` - Listar bookings de um serviço
   - `GET /actors/:id/bookings` - Listar bookings de um actor (requester)
   - `PUT /services/:serviceId/bookings/:bookingId` - Atualizar booking

6. **Module** (`src/modules/services/services.module.ts`):
   - Registrado rotas de booking

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_BOOKING_REQUESTED`**:
   - Emitido quando booking é criado (status = 'requested')
   - Afeta: `BOOKING_READ_MODEL`, `BOOKING_LIST_READ_MODEL`, `SERVICE_READ_MODEL`, `FEED_READ_MODEL`

2. **`SERVICE_BOOKING_CANCELLED`**:
   - Emitido quando booking é cancelado (status muda para 'cancelled')
   - Afeta: `BOOKING_READ_MODEL`, `BOOKING_LIST_READ_MODEL`, `SERVICE_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_BOOKING_REQUESTED]: [
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.BOOKING_LIST_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
]
[ActorEffect.SERVICE_BOOKING_CANCELLED]: [
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.BOOKING_LIST_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`BOOKING_READ_MODEL`**:
   - Projeção de um booking individual
   - Atualizado quando: `SERVICE_BOOKING_REQUESTED`, `SERVICE_BOOKING_CANCELLED`

2. **`BOOKING_LIST_READ_MODEL`**:
   - Projeção de lista de bookings
   - Atualizado quando: `SERVICE_BOOKING_REQUESTED`, `SERVICE_BOOKING_CANCELLED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`service-booking.types.ts`**:
   - Explica que booking é um PEDIDO, não confirmação
   - Explica que booking NÃO confirma, NÃO cobra, NÃO bloqueia agenda, NÃO escolhe prioridade, NÃO faz matching

2. **`service-booking.repository.ts`**:
   - Valida que `serviceId`, `availabilityId` e `requesterActorId` são obrigatórios
   - Comentário: "Nenhum booking deve ser criado sem service, availability e requester_actor"
   - Comentário: "Nenhuma query deve usar booking como filtro decisório"

3. **`service-booking.service.ts`**:
   - Valida que todos os IDs foram fornecidos
   - Valida que service existe
   - Valida que availability existe e pertence ao service
   - Valida que requester_actor existe
   - Comentários explicando que booking é um PEDIDO, não confirmação
   - Comentários: "Nenhuma lógica de aprovação"
   - Comentários: "Nenhuma lógica de pagamento"
   - Comentários: "Nenhuma lógica de exclusão de slots"

4. **`service-booking.routes.ts`**:
   - Comentário: "serviceId, availabilityId e requesterActorId são OBRIGATÓRIOS"
   - Comentário: "Booking é um PEDIDO, não confirmação"
   - Comentário: "Nenhuma query deve usar booking como filtro decisório"
   - Comentário: "Nenhuma lógica de aprovação"
   - Comentário: "Nenhuma lógica de pagamento"
   - Comentário: "Nenhuma lógica de exclusão de slots"

---

## 6. ENDPOINTS

### Backend

1. **`POST /services/:id/bookings`**:
   - Cria novo booking para um serviço
   - Requer: `serviceId` (da URL), `availabilityId`, `requesterActorId`
   - Opcional: `notes`, `metadata`
   - Emite effect: `SERVICE_BOOKING_REQUESTED`

2. **`GET /services/:id/bookings`**:
   - Lista bookings de um serviço
   - Filtros opcionais: `status` (requested, cancelled, expired)
   - Retorna: Array de `ServiceBooking`

3. **`GET /actors/:id/bookings`**:
   - Lista bookings de um actor (requester)
   - Filtros opcionais: `status` (requested, cancelled, expired)
   - Retorna: Array de `ServiceBooking`

4. **`PUT /services/:serviceId/bookings/:bookingId`**:
   - Atualiza booking (apenas status e notes)
   - Valida permissão (owner do service ou requester)
   - Emite effect: `SERVICE_BOOKING_CANCELLED` (se status mudou para 'cancelled')

---

## 7. RELACIONAMENTOS

### Booking ↔ Service

- **Obrigatório**: `service_id` (FK para `services`)
- **Cascade**: `ON DELETE CASCADE` (se service for deletado, bookings são deletados)

### Booking ↔ Availability

- **Obrigatório**: `availability_id` (FK para `service_availability`)
- **Cascade**: `ON DELETE CASCADE` (se availability for deletada, bookings são deletados)
- **Validação**: Availability deve existir e pertencer ao service

### Booking ↔ RequesterActor

- **Obrigatório**: `requester_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, bookings são deletados)
- **Validação**: Actor deve existir

---

## 8. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/138_service_booking.sql`
   - Migration para criar tabela `service_bookings`
   - Enum `booking_status`
   - Triggers e índices

2. `src/modules/services/service-booking.types.ts`
   - Tipos do domínio de booking

3. `src/modules/services/service-booking.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/services/service-booking.service.ts`
   - Service com lógica de negócio

5. `src/modules/services/service-booking.routes.ts`
   - Rotas Fastify

### Backend (alterados)

6. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `SERVICE_BOOKING_REQUESTED`, `SERVICE_BOOKING_CANCELLED`

7. `src/core/read-models/read-model.types.ts`
   - Adicionado: `BOOKING_READ_MODEL`, `BOOKING_LIST_READ_MODEL`

8. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para booking

9. `src/modules/services/services.module.ts`
   - Registrado rotas de booking

---

## 10. PRÓXIMOS PASSOS (NÃO IMPLEMENTADOS)

- ❌ Lógica de aprovação (futuro)
- ❌ Lógica de pagamento (futuro)
- ❌ Lógica de exclusão de slots (futuro)
- ❌ Auto-accept (NÃO será implementado - blindagem)
- ❌ Matching automático (NÃO será implementado - blindagem)
- ❌ UI (futuro)

---

## 11. EXEMPLOS DE USO

### Criar Booking

```typescript
POST /services/{serviceId}/bookings
{
  "availabilityId": "uuid-da-disponibilidade",
  "requesterActorId": "uuid-do-actor-solicitante",
  "notes": "Preciso de ajuda com..."
}
```

### Listar Bookings de um Serviço

```typescript
GET /services/{serviceId}/bookings?status=requested
```

### Listar Bookings de um Actor

```typescript
GET /actors/{actorId}/bookings?status=requested
```

### Cancelar Booking

```typescript
PUT /services/{serviceId}/bookings/{bookingId}
{
  "status": "cancelled"
}
```

---

**Status Final**: ✅ **DOMÍNIO DE BOOKING / RESERVA IMPLEMENTADO E VALIDADO**

