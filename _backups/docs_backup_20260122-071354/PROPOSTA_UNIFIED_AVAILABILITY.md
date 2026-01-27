# ARQUITETURA DE AGENDA UNIFICADA
## Análise Crítica e Proposta de Refatoração

**Data:** 11 de Janeiro de 2026  
**Problema Identificado:** Fragmentação da lógica de agenda  
**Criticidade:** ALTA - Afeta escalabilidade e manutenibilidade  

---

## 🔴 PROBLEMA ATUAL: FRAGMENTAÇÃO

### Estado Atual - 3 Sistemas de Agenda Diferentes

#### 1. Schedule Universal (Migration 032) ✅
**Localização:** `/backend/migrations/032_schedule_universal.sql`  
**Tabelas:** `schedules`, `schedule_slots`  

**Características:**
- ✅ Sistema universal e flexível
- ✅ Pertence a: user, company OU service
- ✅ Slots com status (available, reserved, blocked)
- ✅ Integração com social_actions
- ✅ Proteção contra sobreposição (EXCLUDE constraint)
- ✅ RLS completo

**Uso atual:**
- Agenda de profissionais
- ❌ Pouco utilizado no código

#### 2. Service Availability (Migration 137) ⚠️
**Localização:** `/backend/migrations/137_service_availability.sql`  
**Tabelas:** `service_availability`  

**Características:**
- ⚠️ Específico para serviços
- ⚠️ Estrutura diferente de schedules
- ✅ Tipos: fixed, recurring, on_demand
- ✅ Capacidade configurável
- ✅ Timezone aware

**Uso atual:**
- Módulo de Services
- ✅ Implementação completa

#### 3. Event Availability ⚠️
**Localização:** Tabela `events` tem campos próprios  
**Características:**
- ⚠️ Campos dentro da tabela events
- ⚠️ Lógica específica de eventos
- ⚠️ Ocupação e limites

**Uso atual:**
- Módulo de Eventos

### 🔥 PROBLEMAS IDENTIFICADOS

#### 1. **Duplicação de Lógica**
```
Schedule Universal → NÃO usado amplamente
Service Availability → Reimplementação do mesmo conceito
Event Availability → Campos específicos em events
Rides Availability → Sistema próprio em rides_driver_availability
```

#### 2. **Inconsistência de Dados**
- Um profissional tem agenda em `schedules` (não usado)
- Um serviço tem agenda em `service_availability`
- Um evento tem campos próprios
- Motorista tem `rides_driver_availability`

**Resultado:** 4 fontes de verdade para o mesmo conceito!

#### 3. **Impossível Integrar**
Cenários que NÃO funcionam hoje:

❌ **Feed unificado:**
```
"Veja tudo que está disponível hoje:"
- Serviços disponíveis às 14h
- Eventos com vagas
- Profissionais livres
- Motoristas online
```

❌ **Calendário pessoal:**
```
"Minha agenda completa:"
- Serviços que ofereci
- Eventos que criei
- Compromissos agendados
- Disponibilidade futura
```

❌ **Busca inteligente:**
```
"Quem está disponível amanhã de manhã?"
- Precisa consultar 4 tabelas diferentes
- Lógica duplicada 4 vezes
```

#### 4. **Dificuldade de Manutenção**
- Mudanças em lógica de agenda precisam ser replicadas
- Bugs podem existir em um sistema e não em outro
- Novos módulos reinventam a roda

---

## ✅ SOLUÇÃO PROPOSTA: UNIFIED AVAILABILITY CORE

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────┐
│              UNIFIED AVAILABILITY CORE                   │
│                  (core/availability)                     │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Services   │    │    Events    │    │     Rides    │
│              │    │              │    │              │
│ usa          │    │ usa          │    │ usa          │
│ Availability │    │ Availability │    │ Availability │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 1. Tabela Unificada: `availability`

**Nova estrutura (substituindo schedules e service_availability):**

```sql
CREATE TABLE availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- 🔑 RELACIONAMENTO UNIVERSAL (Polimórfico)
  -- Pertence a um e apenas um:
  owner_type TEXT NOT NULL CHECK (
    owner_type IN ('user', 'service', 'event', 'ride', 'group')
  ),
  owner_id UUID NOT NULL,
  
  -- 🔑 TIPO DE DISPONIBILIDADE
  availability_type TEXT NOT NULL CHECK (
    availability_type IN (
      'fixed',          -- Janela fixa (ex: 09:00-18:00 hoje)
      'recurring',      -- Recorrente (toda segunda 09:00)
      'on_demand',      -- Sob demanda (sem horário fixo)
      'event_based'     -- Baseado em evento (ex: evento às 19h)
    )
  ) DEFAULT 'fixed',
  
  -- 🔑 JANELA TEMPORAL
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  all_day BOOLEAN DEFAULT false,
  
  -- 🔑 RECORRÊNCIA (se recurring)
  recurrence_rule JSONB, -- iCal RRULE format
  recurrence_end_date DATE,
  
  -- 🔑 CAPACIDADE E RESERVAS
  capacity INTEGER, -- NULL = ilimitado
  current_bookings INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'blocked', 'full')
  ),
  
  -- 🔑 VISIBILIDADE
  is_public BOOLEAN DEFAULT true,
  visible_to_actors UUID[], -- Lista de actors que podem ver
  
  -- 🔑 CONTEXTO
  title TEXT,
  description TEXT,
  location JSONB, -- {city_id, address, etc}
  
  -- 🔑 METADADOS EXTENSÍVEIS
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- 🔑 AUDITORIA
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  
  -- 🔑 CONSTRAINTS
  CONSTRAINT availability_time_check CHECK (end_datetime > start_datetime),
  CONSTRAINT availability_capacity_check CHECK (
    capacity IS NULL OR capacity > 0
  ),
  CONSTRAINT availability_bookings_check CHECK (
    current_bookings >= 0 AND 
    (capacity IS NULL OR current_bookings <= capacity)
  ),
  CONSTRAINT availability_owner_composite_unique UNIQUE (
    tenant_id, owner_type, owner_id, start_datetime
  )
);

-- 🔑 ÍNDICES
CREATE INDEX idx_availability_owner ON availability(owner_type, owner_id);
CREATE INDEX idx_availability_datetime ON availability(start_datetime, end_datetime);
CREATE INDEX idx_availability_tenant ON availability(tenant_id);
CREATE INDEX idx_availability_status ON availability(status) WHERE status = 'active';
CREATE INDEX idx_availability_type ON availability(availability_type);
CREATE INDEX idx_availability_capacity ON availability(capacity, current_bookings) 
  WHERE capacity IS NOT NULL;

-- 🔑 CONSTRAINT: Evitar sobreposição por owner
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE availability
ADD CONSTRAINT availability_no_overlap
EXCLUDE USING GIST (
  tenant_id WITH =,
  owner_type WITH =,
  owner_id WITH =,
  tstzrange(start_datetime, end_datetime) WITH &&
) WHERE (status != 'blocked');
```

### 2. Tabela de Reservas: `bookings`

**Unifica service_bookings, event_attendees, etc:**

```sql
CREATE TABLE bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- 🔑 RELACIONAMENTO
  availability_id UUID NOT NULL REFERENCES availability(availability_id) 
    ON DELETE CASCADE,
  
  -- 🔑 QUEM RESERVOU
  booked_by_actor_id UUID NOT NULL REFERENCES actors(actor_id),
  booked_by_user_id UUID NOT NULL, -- Usuário real
  
  -- 🔑 JANELA RESERVADA (pode ser subset da availability)
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  
  -- 🔑 STATUS
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',      -- Aguardando aprovação
      'confirmed',    -- Confirmado
      'completed',    -- Completado
      'cancelled',    -- Cancelado
      'no_show'       -- Não compareceu
    )
  ),
  
  -- 🔑 APROVAÇÃO
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID,
  rejection_reason TEXT,
  
  -- 🔑 PAGAMENTO
  payment_status TEXT CHECK (
    payment_status IN ('not_required', 'pending', 'paid', 'refunded')
  ) DEFAULT 'not_required',
  payment_amount_cents INTEGER,
  payment_request_id UUID, -- FK para payment_requests
  
  -- 🔑 CHECK-IN/OUT
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  
  -- 🔑 CONTEXTO
  notes TEXT, -- Notas do cliente
  provider_notes TEXT, -- Notas do prestador
  
  -- 🔑 METADADOS
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- 🔑 AUDITORIA
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  
  CONSTRAINT bookings_time_check CHECK (end_datetime > start_datetime)
);

-- 🔑 ÍNDICES
CREATE INDEX idx_bookings_availability ON bookings(availability_id);
CREATE INDEX idx_bookings_actor ON bookings(booked_by_actor_id);
CREATE INDEX idx_bookings_user ON bookings(booked_by_user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_datetime ON bookings(start_datetime, end_datetime);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
```

### 3. Core Service: `AvailabilityService`

**Localização:** `/backend/src/core/availability/availability.service.ts`

```typescript
class AvailabilityService {
  
  // ============================================
  // CRIAR DISPONIBILIDADE
  // ============================================
  
  async createAvailability(
    tenantId: string,
    input: CreateAvailabilityInput
  ): Promise<Availability> {
    // Validações
    // Criar availability
    // Atualizar cache
  }
  
  // ============================================
  // BUSCAR DISPONIBILIDADES
  // ============================================
  
  async findAvailability(
    tenantId: string,
    filters: {
      ownerType?: string;
      ownerId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      hasCapacity?: boolean;
    }
  ): Promise<Availability[]> {
    // Query unificada
  }
  
  // ============================================
  // CRIAR RESERVA
  // ============================================
  
  async createBooking(
    tenantId: string,
    input: CreateBookingInput
  ): Promise<Booking> {
    // 1. Verificar disponibilidade
    // 2. Verificar capacidade
    // 3. Criar booking
    // 4. Decrementar capacidade (se necessário)
    // 5. Emitir eventos
    // 6. Notificar
  }
  
  // ============================================
  // APROVAR/REJEITAR RESERVA
  // ============================================
  
  async approveBooking(
    tenantId: string,
    bookingId: string,
    userId: string
  ): Promise<Booking> {
    // Validar permissão
    // Atualizar status
    // Notificar cliente
  }
  
  async rejectBooking(
    tenantId: string,
    bookingId: string,
    userId: string,
    reason: string
  ): Promise<Booking> {
    // Validar permissão
    // Liberar capacidade
    // Notificar cliente
  }
  
  // ============================================
  // CANCELAR RESERVA
  // ============================================
  
  async cancelBooking(
    tenantId: string,
    bookingId: string,
    userId: string
  ): Promise<Booking> {
    // Validar permissão
    // Liberar capacidade
    // Processar reembolso (se necessário)
    // Notificar prestador
  }
  
  // ============================================
  // CHECK-IN/OUT
  // ============================================
  
  async checkIn(
    tenantId: string,
    bookingId: string
  ): Promise<Booking> {
    // Marcar check-in
    // Emitir evento
  }
  
  async checkOut(
    tenantId: string,
    bookingId: string
  ): Promise<Booking> {
    // Marcar check-out
    // Atualizar status para completed
    // Solicitar avaliação
  }
  
  // ============================================
  // QUERIES UNIFICADAS
  // ============================================
  
  // Disponibilidade de um owner
  async getOwnerAvailability(
    tenantId: string,
    ownerType: string,
    ownerId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<Availability[]>
  
  // Reservas de um owner
  async getOwnerBookings(
    tenantId: string,
    ownerType: string,
    ownerId: string,
    filters?: BookingFilters
  ): Promise<Booking[]>
  
  // Reservas de um usuário
  async getUserBookings(
    tenantId: string,
    userId: string,
    filters?: BookingFilters
  ): Promise<Booking[]>
  
  // Busca global
  async searchAvailability(
    tenantId: string,
    query: SearchAvailabilityInput
  ): Promise<Availability[]>
}
```

---

## 🔄 MIGRAÇÃO: COMO IMPLEMENTAR

### Fase 1: Criar Core Unificado (1 semana)

#### 1.1 Nova Migration
Criar `200_unified_availability.sql`:

```sql
-- Criar tabelas availability e bookings
-- Migrar dados de schedules → availability
-- Migrar dados de service_availability → availability
-- Migrar dados de service_bookings → bookings
```

#### 1.2 Core Service
Criar `/core/availability/`:
- availability.service.ts
- availability.repository.ts
- availability.routes.ts
- availability.types.ts

### Fase 2: Adaptar Módulos Existentes (2 semanas)

#### 2.1 Services
```typescript
// Antes (service-availability.service.ts)
await serviceAvailabilityRepository.create(...)

// Depois (usa core)
await availabilityService.createAvailability({
  ownerType: 'service',
  ownerId: serviceId,
  ...
})
```

#### 2.2 Events
```typescript
// Antes (campos em events table)
event.capacity, event.current_attendees

// Depois (usa availability)
await availabilityService.createAvailability({
  ownerType: 'event',
  ownerId: eventId,
  capacity: event.capacity,
  ...
})
```

#### 2.3 Rides
```typescript
// Antes (rides_driver_availability)
await driverAvailabilityRepo.goOnline(...)

// Depois (usa core)
await availabilityService.createAvailability({
  ownerType: 'ride',
  ownerId: driverId,
  availabilityType: 'on_demand',
  ...
})
```

### Fase 3: Deprecar Tabelas Antigas (1 semana)

- Marcar como deprecated
- Adicionar warnings no código
- Documentar migração
- Remover em v2.0

---

## ✅ BENEFÍCIOS DA ARQUITETURA UNIFICADA

### 1. **Feed Unificado** ✅
```typescript
// Agora é possível!
const disponibilidades = await availabilityService.searchAvailability(
  tenantId,
  {
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-15'),
    hasCapacity: true,
    ownerTypes: ['service', 'event'] // Múltiplos tipos!
  }
);

// Resultado:
[
  { ownerType: 'service', title: 'Corte de cabelo', time: '14:00' },
  { ownerType: 'event', title: 'Workshop React', time: '19:00' },
  { ownerType: 'service', title: 'Massagem', time: '16:00' }
]
```

### 2. **Calendário Pessoal** ✅
```typescript
// Minha agenda completa (tudo que ofereci)
const minhaDisponibilidade = await availabilityService.findAvailability(
  tenantId,
  {
    createdByUserId: userId,
    startDate: today,
    endDate: nextWeek
  }
);

// Minhas reservas (tudo que agendei)
const minhasReservas = await availabilityService.getUserBookings(
  tenantId,
  userId,
  {
    status: ['pending', 'confirmed'],
    startDate: today
  }
);
```

### 3. **Busca Inteligente** ✅
```typescript
// "Quem está disponível amanhã de manhã para X?"
const results = await availabilityService.searchAvailability(
  tenantId,
  {
    startDate: tomorrow.set({ hour: 8 }),
    endDate: tomorrow.set({ hour: 12 }),
    categoryId: 'beleza-e-estetica',
    cityId: 'curitiba-id',
    hasCapacity: true
  }
);
```

### 4. **Código Reutilizável** ✅
- Um serviço para tudo
- Lógica consistente
- Menos bugs
- Fácil manutenção
- Testes centralizados

### 5. **Extensibilidade** ✅
```typescript
// Novo módulo? Usa o core!

// Exemplo: Aulas particulares
await availabilityService.createAvailability({
  ownerType: 'tutoring', // Novo tipo!
  ownerId: tutorId,
  availabilityType: 'recurring',
  recurrenceRule: {
    freq: 'WEEKLY',
    byday: ['MO', 'WE', 'FR'],
    byhour: 18
  },
  capacity: 1
});
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### ANTES (Fragmentado)

```
Services:
  service_availability (137 lines SQL)
  service-availability.service.ts (150 lines)
  service-availability.repository.ts (120 lines)
  service-availability.routes.ts (100 lines)

Events:
  Campos em events table
  event-capacity-logic.ts (80 lines)
  
Rides:
  rides_driver_availability (50 lines SQL)
  availability.service.ts (100 lines)

Schedule Universal:
  schedules, schedule_slots (200 lines SQL)
  schedule.service.ts (150 lines)
  ❌ NÃO USADO!

TOTAL: ~1000 lines de código duplicado
```

### DEPOIS (Unificado)

```
Core Availability:
  availability, bookings (150 lines SQL)
  availability.service.ts (400 lines)
  availability.repository.ts (200 lines)
  availability.routes.ts (150 lines)

Services: usa core (10 lines)
Events: usa core (10 lines)
Rides: usa core (10 lines)

TOTAL: ~900 lines (100 lines a menos)
MANUTENÇÃO: 1 lugar vs 4 lugares
```

---

## 🎯 RECOMENDAÇÃO FINAL

### Prioridade: **ALTA**

**Por quê?**
1. Problema estrutural que afeta escalabilidade
2. Impossível criar features avançadas sem isso
3. Dívida técnica crescente
4. Bloqueio para integrações futuras

### Quando Fazer?

**OPÇÃO 1: Antes do MVP (Recomendado)**
- ✅ Sistema nasce certo
- ✅ Evita refatoração futura
- ✅ Features avançadas possíveis
- ⏱️ +3 semanas no cronograma

**OPÇÃO 2: Logo após MVP**
- ⚠️ MVP com arquitetura fragmentada
- ⚠️ Refatoração complexa depois
- ⚠️ Usuários afetados pela migração
- ✅ Lança MVP mais rápido

### Recomendação: **OPÇÃO 1**

**Justificativa:**
- 3 semanas hoje vs 2 meses depois
- Evita migração com usuários ativos
- Permite features impossíveis hoje:
  - Feed unificado
  - Calendário pessoal
  - Busca global
  - Integrações futuras

---

## 📋 ROADMAP DE IMPLEMENTAÇÃO

### Semana 1: Core
- [ ] Criar migration 200_unified_availability.sql
- [ ] Criar availability.service.ts
- [ ] Criar availability.repository.ts
- [ ] Criar availability.routes.ts
- [ ] Testes unitários

### Semana 2: Migração
- [ ] Migrar Services para usar core
- [ ] Migrar Events para usar core
- [ ] Migrar dados existentes
- [ ] Adaptar testes

### Semana 3: Frontend e Polish
- [ ] Criar /api/availability.ts no frontend
- [ ] Componentes unificados (Calendar, Booking)
- [ ] Documentação
- [ ] Deprecar código antigo

**TOTAL: 3 semanas**

---

## ✅ CONCLUSÃO

A arquitetura atual de agenda está **fragmentada em 4 sistemas diferentes**, causando:
- Duplicação de código
- Inconsistência de dados
- Impossibilidade de integrações
- Dívida técnica crescente

A **solução proposta** (Unified Availability Core) resolve todos esses problemas e permite features impossíveis hoje.

**Investimento:** 3 semanas  
**Retorno:** Sistema escalável, manutenível e com features avançadas  
**Risco:** Baixo (migração controlada)  

**RECOMENDAÇÃO: IMPLEMENTAR ANTES DO MVP** ✅

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 11/01/2026  
**Versão:** 1.0
