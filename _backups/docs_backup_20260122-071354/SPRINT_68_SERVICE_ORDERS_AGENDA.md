# SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA

**Data:** 2024-12-19  
**Objetivo:** Criar sistema base de Ordens de Serviço e Agenda, sem executar pagamentos, fiscal ou automações econômicas.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migrations Criadas

**Arquivos:**
- `backend/migrations/194_create_service_orders.sql` - Tabela `service_orders`
- `backend/migrations/195_create_calendar_events.sql` - Tabela `calendar_events`

**Estrutura:**

**service_orders:**
- Status: `DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Campos: service_id, worker_actor_id, customer_actor_id, booking_id (opcional), scheduled_start, scheduled_end, location, notes, etc.
- RLS habilitado
- Índices para performance

**calendar_events:**
- Tipo: `SERVICE_ORDER`, `BLOCK`, `UNAVAILABLE`, `OTHER`
- Status: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Campos: actor_id (worker), service_order_id (opcional), start_time, end_time, location, etc.
- RLS habilitado
- Índices para verificação de conflitos (range overlap)

### 1.2. Services Criados

**ServiceOrderService:**
- `createOrder()` - Cria ordem (status: DRAFT)
- `confirmOrder()` - Confirma ordem (DRAFT → CONFIRMED) + cria evento de agenda
- `startOrder()` - Inicia ordem (CONFIRMED → IN_PROGRESS) + atualiza evento
- `completeOrder()` - Completa ordem (IN_PROGRESS → COMPLETED) + atualiza evento
- `cancelOrder()` - Cancela ordem + cancela evento
- `listOrders()` - Lista ordens com filtros
- `getOrderById()` - Busca ordem por ID

**CalendarService:**
- `createEvent()` - Cria evento de agenda (verifica conflitos)
- `checkAvailability()` - Verifica disponibilidade (conflitos de horário)
- `listEvents()` - Lista eventos com filtros
- `getEventById()` - Busca evento por ID

### 1.3. Integração

**Criação de Evento ao Confirmar OS:**
- Quando ordem é confirmada (DRAFT → CONFIRMED), evento de agenda é criado automaticamente
- Evento vinculado à ordem via `service_order_id`
- Tipo: `SERVICE_ORDER`
- Bloqueia conflitos de horário

**Sincronização de Status:**
- Quando ordem inicia (CONFIRMED → IN_PROGRESS), evento atualiza para `IN_PROGRESS`
- Quando ordem completa (IN_PROGRESS → COMPLETED), evento atualiza para `COMPLETED`
- Quando ordem cancela, evento cancela também

**Verificação de Conflitos:**
- Antes de confirmar ordem, verifica disponibilidade na agenda
- Se houver conflito, ordem não é confirmada
- Conflito detectado via overlap de horários (start_time < end AND end_time > start)

### 1.4. Rotas REST

**Service Orders:**
- `POST /service-orders` - Cria ordem
- `GET /service-orders` - Lista ordens
- `GET /service-orders/:id` - Busca ordem
- `POST /service-orders/:id/confirm` - Confirma ordem
- `POST /service-orders/:id/start` - Inicia ordem
- `POST /service-orders/:id/complete` - Completa ordem
- `POST /service-orders/:id/cancel` - Cancela ordem

**Calendar:**
- `POST /calendar/events` - Cria evento
- `GET /calendar/events` - Lista eventos
- `GET /calendar/events/:id` - Busca evento
- `POST /calendar/availability/check` - Verifica disponibilidade

---

## 2. ESTRUTURA DE DADOS

### 2.1. service_orders

```sql
CREATE TABLE service_orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    service_id UUID NOT NULL,
    worker_actor_id UUID NOT NULL,
    customer_actor_id UUID NOT NULL,
    booking_id UUID, -- Opcional: referência ao booking original
    status service_order_status NOT NULL DEFAULT 'DRAFT',
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,
    location_address TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    description TEXT,
    customer_notes TEXT,
    worker_notes TEXT,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by_actor_id UUID,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.2. calendar_events

```sql
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID NOT NULL, -- Worker/owner da agenda
    service_order_id UUID, -- Opcional: referência à ordem
    event_type calendar_event_type NOT NULL,
    status calendar_event_status NOT NULL DEFAULT 'SCHEDULED',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location_address TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. LIFECYCLE DE ORDEM DE SERVIÇO

### 3.1. Transições de Status

```
DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED
  ↓         ↓            ↓
CANCELLED CANCELLED  CANCELLED
```

**Regras:**
- DRAFT: Ordem criada, não confirmada
- CONFIRMED: Ordem confirmada, evento de agenda criado
- IN_PROGRESS: Ordem em execução
- COMPLETED: Ordem concluída
- CANCELLED: Ordem cancelada (pode cancelar de DRAFT, CONFIRMED ou IN_PROGRESS)

### 3.2. Validações

**Ao Criar:**
- `scheduled_start` deve ser no futuro
- `scheduled_end` > `scheduled_start` (se fornecido)

**Ao Confirmar:**
- Status deve ser `DRAFT`
- Verifica disponibilidade na agenda (conflitos)
- Se conflito detectado, não confirma

**Ao Iniciar:**
- Status deve ser `CONFIRMED`

**Ao Completar:**
- Status deve ser `IN_PROGRESS`

**Ao Cancelar:**
- Status deve ser `DRAFT`, `CONFIRMED` ou `IN_PROGRESS`

---

## 4. VERIFICAÇÃO DE DISPONIBILIDADE

### 4.1. Algoritmo de Conflito

**Query SQL:**
```sql
SELECT * FROM calendar_events
WHERE tenant_id = $1
  AND actor_id = $2
  AND status IN ('SCHEDULED', 'IN_PROGRESS')
  AND (start_time < $4 AND end_time > $3)
```

**Lógica:**
- Dois intervalos conflitam se: `start_time < end AND end_time > start`
- Apenas eventos com status `SCHEDULED` ou `IN_PROGRESS` são considerados
- Eventos `COMPLETED` ou `CANCELLED` não bloqueiam

### 4.2. Uso

**Ao Confirmar Ordem:**
- Verifica disponibilidade antes de confirmar
- Se conflito, retorna erro com lista de eventos conflitantes

**Ao Criar Evento:**
- Verifica disponibilidade antes de criar
- Se conflito, retorna erro

**Endpoint Dedicado:**
- `POST /calendar/availability/check` - Verifica disponibilidade sem criar evento

---

## 5. INTEGRAÇÃO COM AGENDA

### 5.1. Criação Automática de Evento

**Quando:** Ordem confirmada (DRAFT → CONFIRMED)

**O que é criado:**
- Evento tipo `SERVICE_ORDER`
- Vinculado à ordem via `service_order_id`
- Horário: `scheduled_start` até `scheduled_end` (ou calculado)
- Localização: mesma da ordem
- Status: `SCHEDULED`

**Se falhar:**
- Não bloqueia confirmação da ordem
- Erro é logado, mas ordem é confirmada

### 5.2. Sincronização de Status

**Ordem IN_PROGRESS:**
- Evento atualiza para `IN_PROGRESS`
- `started_at` preenchido

**Ordem COMPLETED:**
- Evento atualiza para `COMPLETED`
- `completed_at` preenchido

**Ordem CANCELLED:**
- Evento cancela também
- `cancelled_at` preenchido
- `cancellation_reason` copiado

---

## 6. AUDITORIA

### 6.1. Eventos Registrados

**Service Orders:**
- `SERVICE_ORDER_CREATED` - Quando ordem é criada
- `SERVICE_ORDER_CONFIRMED` - Quando ordem é confirmada
- `SERVICE_ORDER_STARTED` - Quando ordem inicia
- `SERVICE_ORDER_COMPLETED` - Quando ordem completa
- `SERVICE_ORDER_CANCELLED` - Quando ordem cancela

**Calendar Events:**
- `CALENDAR_EVENT_CREATED` - Quando evento é criado

### 6.2. Contexto de Auditoria

Cada evento inclui:
- `order_id` / `event_id`
- `status`
- `created_by_user_id` / `confirmed_by_user_id` / etc.
- `cancellation_reason` (se cancelado)

---

## 7. GUARDRAILS RESPEITADOS

### 7.1. Append-Only

- ✅ Status muda, mas registros não desaparecem
- ✅ Histórico completo preservado
- ✅ `cancelled_at`, `completed_at`, etc. preenchidos, mas registro permanece

### 7.2. Status Declarativos

- ✅ Status é apenas declarativo (não executa ações)
- ✅ Transições explícitas e validadas
- ✅ Nenhuma transição automática

### 7.3. Audit em Todas as Mudanças

- ✅ Todas as mudanças de status geram audit event
- ✅ Contexto completo registrado
- ✅ Falha de auditoria não bloqueia operação

### 7.4. Nada Automático sem Ação Explícita

- ✅ Criação de evento ao confirmar é explícita (chamada direta)
- ✅ Sincronização de status é explícita
- ✅ Nenhuma automação em background

### 7.5. Nenhuma Execução Financeira

- ✅ Nenhum pagamento executado
- ✅ Nenhuma emissão fiscal
- ✅ Nenhuma criação de split/payout

---

## 8. ARQUIVOS CRIADOS

### 8.1. Migrations

1. `backend/migrations/194_create_service_orders.sql`
2. `backend/migrations/195_create_calendar_events.sql`

### 8.2. Types

3. `backend/src/modules/services/service-order.types.ts`
4. `backend/src/modules/services/calendar-event.types.ts`

### 8.3. Repositories

5. `backend/src/modules/services/service-order.repository.ts`
6. `backend/src/modules/services/calendar-event.repository.ts`

### 8.4. Services

7. `backend/src/modules/services/service-order.service.ts`
8. `backend/src/modules/services/calendar.service.ts`

### 8.5. Routes

9. `backend/src/modules/services/service-order.routes.ts`
10. `backend/src/modules/services/calendar.routes.ts`

---

## 9. EXEMPLOS DE USO

### 9.1. Criar e Confirmar Ordem

```typescript
// 1. Criar ordem (DRAFT)
const order = await serviceOrderService.createOrder(tenantId, {
  serviceId: 'service-123',
  workerActorId: 'worker-actor-123',
  customerActorId: 'customer-actor-123',
  scheduledStart: new Date('2024-12-20T10:00:00Z'),
  scheduledEnd: new Date('2024-12-20T11:00:00Z'),
  description: 'Serviço de limpeza',
}, 'created-by-actor-123', 'user-123');

// 2. Confirmar ordem (DRAFT → CONFIRMED)
// Isso cria evento de agenda automaticamente
const confirmedOrder = await serviceOrderService.confirmOrder(tenantId, order.id, {
  confirmedByActorId: 'confirmed-by-actor-123',
  confirmedByUserId: 'user-123',
});
```

### 9.2. Verificar Disponibilidade

```typescript
// Verificar se worker está disponível
const availability = await calendarService.checkAvailability(tenantId, {
  actorId: 'worker-actor-123',
  startTime: new Date('2024-12-20T10:00:00Z'),
  endTime: new Date('2024-12-20T11:00:00Z'),
});

if (!availability.available) {
  console.log('Conflitos:', availability.conflictingEvents);
}
```

### 9.3. Criar Bloqueio Manual

```typescript
// Criar bloqueio manual na agenda
const block = await calendarService.createEvent(tenantId, {
  actorId: 'worker-actor-123',
  eventType: 'BLOCK',
  title: 'Férias',
  startTime: new Date('2024-12-25T00:00:00Z'),
  endTime: new Date('2025-01-05T00:00:00Z'),
}, 'created-by-actor-123', 'user-123');
```

---

## 10. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **É possível criar ordem de serviço:**
   - ✅ `POST /service-orders` cria ordem em DRAFT

2. **É possível confirmar ordem:**
   - ✅ `POST /service-orders/:id/confirm` confirma ordem
   - ✅ Cria evento de agenda automaticamente

3. **É possível verificar disponibilidade:**
   - ✅ `POST /calendar/availability/check` verifica conflitos
   - ✅ Conflitos bloqueiam confirmação

4. **É possível gerenciar lifecycle:**
   - ✅ Start, Complete, Cancel implementados
   - ✅ Status sincronizado com agenda

5. **Nenhuma execução financeira:**
   - ✅ Nenhum pagamento executado
   - ✅ Nenhuma emissão fiscal
   - ✅ Nenhuma criação de split/payout

6. **Tudo auditável:**
   - ✅ Todas as mudanças geram audit event
   - ✅ Contexto completo registrado

---

## 11. PRÓXIMOS PASSOS (FUTURO)

### 11.1. Integração com Pagamento (Futuro)

- Quando ordem completa, pode criar `PaymentIntent` (não executar)
- Quando ordem cancela, pode cancelar `PaymentIntent` (se existir)

### 11.2. Integração com Fiscal (Futuro)

- Quando ordem completa, pode criar `FiscalDocument` (não emitir)
- Emissão fiscal via `ScheduledAction` (SPRINT 67)

### 11.3. Notificações (Futuro)

- Notificar worker quando ordem é criada
- Notificar customer quando ordem é confirmada
- Notificar ambos quando ordem inicia/completa

---

**Fim do Relatório**




