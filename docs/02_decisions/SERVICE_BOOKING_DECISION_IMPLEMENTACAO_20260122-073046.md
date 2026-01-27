# Implementação: Domínio de CONFIRMAÇÃO DE BOOKING (Booking Decision)

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING

---

## 1. DEFINIÇÃO CANÔNICA

### Booking Decision NÃO é:
- ❌ Automática
- ❌ Baseada em score
- ❌ Baseada em educação
- ❌ Baseada em aprendizado
- ❌ Baseada em reputação
- ❌ Fila de prioridade
- ❌ Lógica de "melhor candidato"
- ❌ Ligação com pagamento
- ❌ Ligação com educação ou aprendizado

### Booking Decision É:
- ✅ Decisão humana explícita
- ✅ Separada do Booking
- ✅ Booking continua existindo mesmo se rejeitado
- ✅ Decisão não apaga booking
- ✅ Nada é sobrescrito

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/139_service_booking_decision.sql`):
   - Tabela `service_booking_decisions` com relacionamentos obrigatórios:
     - `booking_id` → `service_bookings` (FK com CASCADE)
     - `decided_by_actor_id` → `actors` (FK com CASCADE)
   - Enum: `booking_decision_status` (accepted, rejected)
   - Campos: `decided_at`, `reason` (opcional)
   - Constraint UNIQUE: apenas uma decisão por booking
   - Triggers para `updated_at`
   - Índices para performance

2. **Tipos** (`src/modules/services/service-booking-decision.types.ts`):
   - `BookingDecisionStatus` enum
   - `ServiceBookingDecision` interface
   - `CreateServiceBookingDecisionInput` interface

3. **Repository** (`src/modules/services/service-booking-decision.repository.ts`):
   - `findById()` - Busca decisão por ID
   - `findByBookingId()` - Busca decisão por Booking ID
   - `create()` - Cria nova decisão (valida IDs obrigatórios, constraint UNIQUE)

4. **Service** (`src/modules/services/service-booking-decision.service.ts`):
   - `createDecision()` - Cria decisão com validação:
     - Booking existe
     - Service existe
     - DecidedByActor é dono do service
     - Não existe decisão anterior para este booking
   - `getDecision()` - Busca decisão por ID
   - `getDecisionByBooking()` - Busca decisão por Booking ID

5. **Routes** (`src/modules/services/service-booking-decision.routes.ts`):
   - `POST /services/:serviceId/bookings/:bookingId/decision` - Criar nova decisão
   - `GET /services/:serviceId/bookings/:bookingId/decision` - Buscar decisão de um booking

6. **Module** (`src/modules/services/services.module.ts`):
   - Registrado rotas de decisão de booking

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_BOOKING_ACCEPTED`**:
   - Emitido quando booking é aceito (status = 'accepted')
   - Afeta: `BOOKING_DECISION_READ_MODEL`, `BOOKING_READ_MODEL`, `BOOKING_LIST_READ_MODEL`, `SERVICE_READ_MODEL`, `FEED_READ_MODEL`

2. **`SERVICE_BOOKING_REJECTED`**:
   - Emitido quando booking é rejeitado (status = 'rejected')
   - Afeta: `BOOKING_DECISION_READ_MODEL`, `BOOKING_READ_MODEL`, `BOOKING_LIST_READ_MODEL`, `SERVICE_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_BOOKING_ACCEPTED]: [
  ReadModelType.BOOKING_DECISION_READ_MODEL,
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.BOOKING_LIST_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
]
[ActorEffect.SERVICE_BOOKING_REJECTED]: [
  ReadModelType.BOOKING_DECISION_READ_MODEL,
  ReadModelType.BOOKING_READ_MODEL,
  ReadModelType.BOOKING_LIST_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`BOOKING_DECISION_READ_MODEL`**:
   - Projeção de uma decisão de booking individual
   - Atualizado quando: `SERVICE_BOOKING_ACCEPTED`, `SERVICE_BOOKING_REJECTED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`service-booking-decision.types.ts`**:
   - Explica que Booking Decision = decisão humana explícita
   - Explica que nunca automática
   - Explica que nunca baseada em score, educação, aprendizado ou reputação
   - Explica que booking continua existindo mesmo se rejeitado
   - Explica que decisão não apaga booking
   - Explica que nada é sobrescrito

2. **`service-booking-decision.repository.ts`**:
   - Valida que `bookingId` e `decidedByActorId` são obrigatórios
   - Comentário: "Nenhuma decisão deve ser criada sem booking e decided_by_actor"
   - Comentário: "Decisão é humana explícita, nunca automática"
   - Comentário: "Apenas uma decisão por booking (constraint UNIQUE)"
   - Comentário: "Booking continua existindo mesmo se rejeitado"
   - Comentário: "Decisão não apaga booking"

3. **`service-booking-decision.service.ts`**:
   - Valida que todos os IDs foram fornecidos
   - Valida que booking existe
   - Valida que service existe
   - Valida que decided_by_actor é dono do service
   - Valida que não existe decisão anterior para este booking
   - Comentários explicando que decisão é humana explícita, nunca automática
   - Comentários: "Nenhuma decisão automática"
   - Comentários: "Nenhuma fila de prioridade"
   - Comentários: "Nenhuma lógica de 'melhor candidato'"
   - Comentários: "Nenhuma ligação com pagamento"
   - Comentários: "Nenhuma ligação com educação ou aprendizado"

4. **`service-booking-decision.routes.ts`**:
   - Comentário: "bookingId e decidedByActorId são OBRIGATÓRIOS"
   - Comentário: "Decisão é humana explícita, nunca automática"
   - Comentário: "Apenas dono do service pode decidir"
   - Comentário: "Apenas uma decisão por booking"
   - Comentário: "Booking continua existindo mesmo se rejeitado"
   - Comentário: "Decisão não apaga booking"

---

## 6. ENDPOINTS

### Backend

1. **`POST /services/:serviceId/bookings/:bookingId/decision`**:
   - Cria nova decisão para um booking
   - Requer: `bookingId` (da URL), `decidedByActorId`, `status` (accepted ou rejected)
   - Opcional: `reason`, `metadata`
   - Valida: apenas dono do service pode decidir
   - Valida: apenas uma decisão por booking
   - Emite effect: `SERVICE_BOOKING_ACCEPTED` ou `SERVICE_BOOKING_REJECTED`

2. **`GET /services/:serviceId/bookings/:bookingId/decision`**:
   - Busca decisão de um booking
   - Retorna: `ServiceBookingDecision` ou 404 se não encontrado

---

## 7. RELACIONAMENTOS

### Decision ↔ Booking

- **Obrigatório**: `booking_id` (FK para `service_bookings`)
- **Cascade**: `ON DELETE CASCADE` (se booking for deletado, decisão é deletada)
- **Constraint UNIQUE**: apenas uma decisão por booking
- **Validação**: Booking deve existir antes de criar decisão

### Decision ↔ DecidedByActor

- **Obrigatório**: `decided_by_actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, decisão é deletada)
- **Validação**: Actor deve existir e ser dono do service

---

## 8. REGRAS DE NEGÓCIO

### Separação Booking ↔ Decision

- ✅ Booking continua existindo mesmo se rejeitado
- ✅ Decisão não apaga booking
- ✅ Nada é sobrescrito
- ✅ Apenas uma decisão por booking (constraint UNIQUE)

### Permissões

- ✅ Apenas dono do service pode decidir sobre bookings
- ✅ Validação explícita: `service.actorId === decidedByActorId`

### Decisão Humana

- ✅ Decisão é sempre humana explícita
- ✅ Nunca automática
- ✅ Nunca baseada em score, educação, aprendizado ou reputação
- ✅ Nunca fila de prioridade
- ✅ Nunca lógica de "melhor candidato"

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/139_service_booking_decision.sql`
   - Migration para criar tabela `service_booking_decisions`
   - Enum `booking_decision_status`
   - Constraint UNIQUE por booking
   - Triggers e índices

2. `src/modules/services/service-booking-decision.types.ts`
   - Tipos do domínio de decisão de booking

3. `src/modules/services/service-booking-decision.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/services/service-booking-decision.service.ts`
   - Service com lógica de negócio

5. `src/modules/services/service-booking-decision.routes.ts`
   - Rotas Fastify

### Backend (alterados)

6. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `SERVICE_BOOKING_ACCEPTED`, `SERVICE_BOOKING_REJECTED`

7. `src/core/read-models/read-model.types.ts`
   - Adicionado: `BOOKING_DECISION_READ_MODEL`

8. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para decisão de booking

9. `src/modules/services/services.module.ts`
   - Registrado rotas de decisão de booking

---

## 11. EXEMPLOS DE USO

### Aceitar Booking

```typescript
POST /services/{serviceId}/bookings/{bookingId}/decision
{
  "decidedByActorId": "uuid-do-dono-do-service",
  "status": "accepted",
  "reason": "Disponibilidade confirmada"
}
```

### Rejeitar Booking

```typescript
POST /services/{serviceId}/bookings/{bookingId}/decision
{
  "decidedByActorId": "uuid-do-dono-do-service",
  "status": "rejected",
  "reason": "Horário não disponível"
}
```

### Buscar Decisão de um Booking

```typescript
GET /services/{serviceId}/bookings/{bookingId}/decision
```

---

**Status Final**: ✅ **DOMÍNIO DE CONFIRMAÇÃO DE BOOKING IMPLEMENTADO E VALIDADO**

