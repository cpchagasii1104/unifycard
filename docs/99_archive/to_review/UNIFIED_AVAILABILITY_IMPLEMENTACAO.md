# Implementação: CORE de Unified Availability

**Data**: 2024-12-19  
**Escopo**: Criação do CORE unificado de disponibilidade que suporta user, service, event e group

---

## 1. DEFINIÇÃO CANÔNICA

### Unified Availability NÃO é:
- ❌ Decisão de quem pode agendar
- ❌ Pagamento
- ❌ Matching
- ❌ Lógica decisória automática

### Unified Availability É:
- ✅ CORE unificado de disponibilidade
- ✅ Suporta owner_type (user, service, event, group)
- ✅ Evita sobreposição de horários por owner (via trigger)
- ✅ Suporta capacidade opcional
- ✅ Apenas expõe janelas disponíveis

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/144_unified_availability.sql`):
   - Tabela `availability` (unified) com:
     - `owner_type` (user, service, event, group)
     - `owner_id` (ID do owner)
     - `availability_type` (fixed, recurring, on_demand)
     - `status` (active, paused)
     - `start_datetime`, `end_datetime`, `timezone`
     - `capacity` (opcional)
   - Tabela `bookings` (unified) com:
     - `availability_id` (referência obrigatória)
     - `requester_actor_id`
     - `status` (requested, confirmed, cancelled, expired, checked_in, checked_out)
     - `checked_in_at`, `checked_out_at`
   - Trigger `prevent_availability_overlap()` - previne sobreposição de horários por owner
   - Enums: `availability_owner_type`, `unified_availability_type`, `unified_availability_status`, `unified_booking_status`

2. **Tipos** (`src/core/availability/unified-availability.types.ts`):
   - `AvailabilityOwnerType` enum (user, service, event, group)
   - `UnifiedAvailabilityType` enum (fixed, recurring, on_demand)
   - `UnifiedAvailabilityStatus` enum (active, paused)
   - `UnifiedBookingStatus` enum (requested, confirmed, cancelled, expired, checked_in, checked_out)
   - `UnifiedAvailability` interface
   - `UnifiedBooking` interface
   - Inputs e filtros

3. **Repository** (`src/core/availability/unified-availability.repository.ts`):
   - `create()` - Cria disponibilidade (valida ownerType e ownerId obrigatórios)
   - `findAvailabilityById()` - Busca disponibilidade por ID
   - `findAvailabilities()` - Lista disponibilidades com filtros
   - `updateAvailability()` - Atualiza disponibilidade (trigger previne sobreposição)
   - `createBooking()` - Cria booking (NÃO executa pagamento)
   - `findBookingById()` - Busca booking por ID
   - `findBookings()` - Lista bookings com filtros
   - `updateBooking()` - Atualiza booking (NÃO executa pagamento)
   - `checkIn()` - Realiza check-in (apenas registro, NÃO executa pagamento)
   - `checkOut()` - Realiza check-out (apenas registro, NÃO executa pagamento)

4. **Service** (`src/core/availability/unified-availability.service.ts`):
   - `createAvailability()` - Cria disponibilidade com validações
   - `getAvailability()` - Busca disponibilidade por ID
   - `listAvailabilities()` - Lista disponibilidades
   - `updateAvailability()` - Atualiza disponibilidade
   - `createBooking()` - Cria booking (valida availability e requester actor)
   - `getBooking()` - Busca booking por ID
   - `listBookings()` - Lista bookings
   - `updateBooking()` - Atualiza booking
   - `checkIn()` - Realiza check-in (valida que booking está confirmado)
   - `checkOut()` - Realiza check-out (valida que booking fez check-in)

5. **Routes** (`src/core/availability/unified-availability.routes.ts`):
   - `POST /availability` - Criar disponibilidade
   - `GET /availability` - Listar disponibilidades (com filtros)
   - `GET /availability/:id` - Buscar disponibilidade por ID
   - `PUT /availability/:id` - Atualizar disponibilidade
   - `POST /availability/bookings` - Criar booking
   - `GET /availability/bookings` - Listar bookings (com filtros)
   - `GET /availability/bookings/:id` - Buscar booking por ID
   - `PUT /availability/bookings/:id` - Atualizar booking
   - `POST /availability/bookings/:id/check-in` - Realizar check-in
   - `POST /availability/bookings/:id/check-out` - Realizar check-out

6. **Module** (`src/core/availability/availability.module.ts`):
   - Registrado rotas de availability com prefix `/availability`

---

## 3. REGRAS DE NEGÓCIO

### Regra Fundamental

- ✅ **Availability NÃO decide quem pode agendar**
  - Apenas expõe janelas disponíveis
  - Não faz matching
  - Não faz pagamento

### Owner Polimórfico

- ✅ **Suporta owner_type (user, service, event, group)**
  - `owner_type` + `owner_id` identificam o dono da disponibilidade
  - Permite unificar todos os sistemas de agenda

### Prevenção de Sobreposição

- ✅ **Trigger previne sobreposição de horários por owner**
  - `prevent_availability_overlap()` verifica se existe disponibilidade sobreposta
  - Apenas para disponibilidades ativas
  - Garante integridade temporal

### Capacidade Opcional

- ✅ **Suporta capacidade opcional**
  - `capacity` pode ser NULL (ilimitado) ou número positivo
  - É informação, não decisão de quem pode agendar

### Check-in / Check-out

- ✅ **Check-in/check-out são apenas registro**
  - NÃO executam pagamento
  - NÃO alteram estado de domínio além do próprio booking
  - Check-in requer booking confirmado
  - Check-out requer check-in realizado

---

## 4. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`unified-availability.types.ts`**:
   - Explica que availability NÃO decide quem pode agendar
   - Explica que availability NÃO faz pagamento
   - Explica que availability NÃO faz matching
   - Explica que availability apenas expõe janelas disponíveis
   - Explica que evita sobreposição de horários por owner
   - Explica que check-in/check-out são apenas registro, NÃO executam pagamento

2. **`unified-availability.repository.ts`**:
   - Comentários: "ownerType e ownerId são OBRIGATÓRIOS"
   - Comentários: "Trigger previne sobreposição de horários por owner"
   - Comentários: "NÃO executa pagamento"
   - Comentários: "Check-in é apenas registro, NÃO executa pagamento"
   - Comentários: "Check-out é apenas registro, NÃO executa pagamento"
   - Comentários: "Ordenação apenas por start_datetime ASC"

3. **`unified-availability.service.ts`**:
   - Comentários: "NÃO cria lógica decisória automática"
   - Comentários: "NÃO executa pagamento"
   - Comentários: "Apenas expõe janelas disponíveis"
   - Comentários: "Check-in é apenas registro, NÃO executa pagamento"
   - Comentários: "Check-out é apenas registro, NÃO executa pagamento"

4. **`unified-availability.routes.ts`**:
   - Comentários: "NÃO cria lógica decisória automática"
   - Comentários: "NÃO executa pagamento"
   - Comentários: "NÃO faz matching"
   - Comentários: "ownerType e ownerId são OBRIGATÓRIOS"
   - Comentários: "Check-in é apenas registro, NÃO executa pagamento"
   - Comentários: "Check-out é apenas registro, NÃO executa pagamento"

5. **Migration** (`migrations/144_unified_availability.sql`):
   - Comentários: "Availability NÃO decide quem pode agendar"
   - Comentários: "Availability NÃO faz pagamento"
   - Comentários: "Availability NÃO faz matching"
   - Comentários: "Trigger para evitar sobreposição de horários por owner"
   - Comentários: "Check-in/check-out são apenas registro, NÃO executam pagamento"
   - Comentários: "NÃO remove tabelas antigas (apenas prepara migração futura)"

---

## 5. PROIBIÇÕES ABSOLUTAS

- ❌ NÃO criar lógica decisória automática
- ❌ NÃO executar pagamento
- ❌ NÃO fazer matching
- ❌ NÃO decidir quem pode agendar
- ❌ NÃO remover tabelas antigas (apenas preparar migração futura)

---

## 6. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 7. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/144_unified_availability.sql`
   - Migration para criar tabelas `availability` e `bookings` (unified)

2. `src/core/availability/unified-availability.types.ts`
   - Tipos do CORE de unified availability

3. `src/core/availability/unified-availability.repository.ts`
   - Repository para acesso ao banco

4. `src/core/availability/unified-availability.service.ts`
   - Service com lógica de negócio

5. `src/core/availability/unified-availability.routes.ts`
   - Rotas Fastify

6. `src/core/availability/availability.module.ts`
   - Módulo do CORE de availability

### Backend (alterados)

7. `src/server.ts`
   - Registrado módulo availability com prefix `/availability`

---

## 8. DECISÕES ARQUITETURAIS

### 1. Owner Polimórfico

**Decisão**: Usar `owner_type` + `owner_id` em vez de foreign keys específicas.

**Justificativa**:
- Permite unificar todos os sistemas de agenda (user, service, event, group)
- Evita múltiplas tabelas ou colunas nullable
- Facilita migração futura das tabelas antigas

**Implementação**:
- Enum `availability_owner_type` com valores: user, service, event, group
- Índice composto em `(owner_type, owner_id)` para performance

### 2. Prevenção de Sobreposição via Trigger

**Decisão**: Usar trigger PostgreSQL para prevenir sobreposição de horários.

**Justificativa**:
- Garante integridade no nível do banco de dados
- Não depende de lógica de aplicação
- Previne race conditions

**Implementação**:
- Trigger `prevent_availability_overlap()` executa antes de INSERT/UPDATE
- Verifica apenas disponibilidades ativas
- Lança exceção se encontrar sobreposição

### 3. Capacidade Opcional

**Decisão**: `capacity` pode ser NULL (ilimitado) ou número positivo.

**Justificativa**:
- Permite flexibilidade (alguns owners podem ter capacidade, outros não)
- É informação, não decisão de quem pode agendar
- Facilita migração futura

**Implementação**:
- Campo `capacity INTEGER` com constraint `CHECK (capacity IS NULL OR capacity > 0)`
- NULL = ilimitado

### 4. Check-in / Check-out como Status

**Decisão**: Check-in e check-out são status do booking, não ações separadas.

**Justificativa**:
- Simplifica o modelo de dados
- Permite rastrear o fluxo completo do booking
- NÃO executa pagamento (apenas registro)

**Implementação**:
- Status `checked_in` e `checked_out` no enum `unified_booking_status`
- Campos `checked_in_at` e `checked_out_at` para timestamps
- Validação: check-out requer check-in

### 5. NÃO Remover Tabelas Antigas

**Decisão**: Criar novas tabelas sem remover as antigas.

**Justificativa**:
- Permite migração gradual
- Não quebra código existente
- Facilita rollback se necessário

**Implementação**:
- Tabelas antigas (`service_availability`, `service_bookings`) permanecem intactas
- Nova estrutura (`availability`, `bookings`) é independente
- Migração futura pode copiar dados das antigas para as novas

---

## 9. EXEMPLOS DE USO

### Criar Disponibilidade de Usuário

```typescript
POST /availability
{
  "ownerType": "user",
  "ownerId": "uuid-do-usuario",
  "startDatetime": "2024-12-20T09:00:00Z",
  "endDatetime": "2024-12-20T18:00:00Z",
  "timezone": "America/Sao_Paulo",
  "capacity": 5
}
```

### Criar Disponibilidade de Serviço

```typescript
POST /availability
{
  "ownerType": "service",
  "ownerId": "uuid-do-servico",
  "startDatetime": "2024-12-20T10:00:00Z",
  "endDatetime": "2024-12-20T12:00:00Z",
  "timezone": "America/Sao_Paulo"
}
```

### Criar Booking

```typescript
POST /availability/bookings
{
  "availabilityId": "uuid-da-disponibilidade",
  "requesterActorId": "uuid-do-actor",
  "notes": "Preciso de ajuda com..."
}
```

### Realizar Check-in

```typescript
POST /availability/bookings/{bookingId}/check-in
{
  "metadata": {
    "location": "Sala 101"
  }
}
```

### Realizar Check-out

```typescript
POST /availability/bookings/{bookingId}/check-out
{
  "metadata": {
    "duration": "2 horas"
  }
}
```

---

**Status Final**: ✅ **CORE DE UNIFIED AVAILABILITY IMPLEMENTADO E VALIDADO**

