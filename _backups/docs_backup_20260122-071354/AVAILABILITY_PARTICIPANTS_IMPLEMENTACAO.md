# Implementação: Availability Participants

**Data**: 2024-12-19  
**Escopo**: Adicionar suporte a PARTICIPANTES de availability sem criar decisão automática

---

## 1. DEFINIÇÃO CANÔNICA

### Availability Participants NÃO é:
- ❌ Decisão automática
- ❌ Bloqueio de conflitos
- ❌ Lógica decisória automática

### Availability Participants É:
- ✅ Declaração de pessoas físicas (actors CPF) como participantes humanos
- ✅ Detecção de conflitos (ALERTA, não bloqueio)
- ✅ A confirmação cabe ao usuário

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/145_availability_participants.sql`):
   - Tabela `availability_participants` com:
     - `availability_id` (referência obrigatória)
     - `actor_id` (actor participante - CPF)
     - `role` (executor, participante, convidado)
     - Constraint UNIQUE: apenas um participante por availability e actor
   - Função `detect_availability_conflicts()` - detecta conflitos de horário
   - Enum: `participant_role` (executor, participante, convidado)

2. **Tipos** (`src/core/availability/unified-availability.types.ts`):
   - `ParticipantRole` enum (executor, participante, convidado)
   - `AvailabilityParticipant` interface
   - `CreateAvailabilityParticipantInput` interface
   - `UpdateAvailabilityParticipantInput` interface
   - `AvailabilityParticipantFilters` interface
   - `AvailabilityConflict` interface
   - `ConflictDetectionResult` interface

3. **Repository** (`src/core/availability/unified-availability.repository.ts`):
   - `createParticipant()` - Cria participante (NÃO bloqueia conflitos)
   - `findParticipantById()` - Busca participante por ID
   - `findParticipants()` - Lista participantes com filtros
   - `updateParticipant()` - Atualiza participante
   - `deleteParticipant()` - Remove participante
   - `detectConflicts()` - Detecta conflitos de horário (ALERTA, não bloqueio)

4. **Service** (`src/core/availability/unified-availability.service.ts`):
   - `createParticipant()` - Cria participante com validações
   - `getParticipant()` - Busca participante por ID
   - `listParticipants()` - Lista participantes
   - `updateParticipant()` - Atualiza participante
   - `deleteParticipant()` - Remove participante
   - `detectConflicts()` - Detecta conflitos (ALERTA, não bloqueio)

5. **Routes** (`src/core/availability/unified-availability.routes.ts`):
   - `POST /availability/:availabilityId/participants` - Adicionar participante (retorna ALERTA se houver conflitos)
   - `GET /availability/:availabilityId/participants` - Listar participantes
   - `GET /availability/participants/:id` - Buscar participante por ID
   - `PUT /availability/participants/:id` - Atualizar participante
   - `DELETE /availability/participants/:id` - Remover participante
   - `GET /availability/:availabilityId/participants/:actorId/conflicts` - Detectar conflitos

---

## 3. REGRAS DE NEGÓCIO

### Regra Fundamental

- ✅ **NÃO bloqueia automaticamente conflitos**
  - Detecção de conflitos é ALERTA, não bloqueio
  - A confirmação cabe ao usuário

### Participante

- ✅ **Participante é pessoa física (actor CPF)**
  - Associado a uma availability
  - Role: executor, participante, convidado
  - Apenas um participante por availability e actor

### Detecção de Conflitos

- ✅ **Detecção de conflitos é ALERTA, não bloqueio**
  - Função `detect_availability_conflicts()` no banco
  - Verifica sobreposição de horários entre:
    - Availability do owner
    - Availability do actor participante (owner_type = 'user')
  - Retorna lista de conflitos encontrados
  - NÃO bloqueia criação de participante

---

## 4. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **Migration** (`migrations/145_availability_participants.sql`):
   - Comentários: "NÃO bloqueia automaticamente conflitos"
   - Comentários: "NÃO cria lógica de decisão automática"
   - Comentários: "Detecção de conflitos é ALERTA, não bloqueio"
   - Comentários: "A confirmação cabe ao usuário"
   - Comentários: "Esta função DETECTA conflitos, NÃO bloqueia"

2. **Tipos** (`unified-availability.types.ts`):
   - Comentários: "Participant é pessoa física (actor CPF) associada a uma availability"
   - Comentários: "NÃO bloqueia automaticamente conflitos"
   - Comentários: "Detecção de conflitos é ALERTA, não bloqueio"
   - Comentários: "Conflito é DETECÇÃO, não decisão"
   - Comentários: "A confirmação cabe ao usuário"
   - Comentários: "Resultado é ALERTA, não bloqueio"

3. **Repository** (`unified-availability.repository.ts`):
   - Comentários: "NÃO bloqueia automaticamente conflitos"
   - Comentários: "Esta função DETECTA conflitos, NÃO bloqueia"
   - Comentários: "A confirmação cabe ao usuário"
   - Comentários: "Retorna lista de conflitos encontrados (apenas informação, não decisão)"

4. **Service** (`unified-availability.service.ts`):
   - Comentários: "NÃO bloqueia automaticamente conflitos"
   - Comentários: "Esta função DETECTA conflitos, NÃO bloqueia"
   - Comentários: "A confirmação cabe ao usuário"
   - Comentários: "Retorna ALERTA, não bloqueio"

5. **Routes** (`unified-availability.routes.ts`):
   - Comentários: "NÃO bloqueia automaticamente conflitos"
   - Comentários: "Retorna ALERTA se houver conflitos, mas não bloqueia"
   - Comentários: "Conflitos são ALERTA, não bloqueio"
   - Comentários: "A confirmação cabe ao usuário"

---

## 5. PROIBIÇÕES ABSOLUTAS

- ❌ NÃO bloquear automaticamente conflitos
- ❌ NÃO criar lógica de decisão automática
- ❌ NÃO alterar comportamento existente
- ❌ NÃO criar frontend

---

## 6. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 7. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/145_availability_participants.sql`
   - Migration para criar tabela `availability_participants`
   - Função `detect_availability_conflicts()` para detectar conflitos

### Backend (alterados)

2. `src/core/availability/unified-availability.types.ts`
   - Adicionados tipos para participants e detecção de conflitos

3. `src/core/availability/unified-availability.repository.ts`
   - Adicionados métodos para participants e detecção de conflitos

4. `src/core/availability/unified-availability.service.ts`
   - Adicionados métodos para participants e detecção de conflitos

5. `src/core/availability/unified-availability.routes.ts`
   - Adicionados endpoints para participants e detecção de conflitos

---

## 8. DECISÕES ARQUITETURAIS

### 1. Detecção de Conflitos como Função do Banco

**Decisão**: Usar função PostgreSQL para detectar conflitos.

**Justificativa**:
- Garante consistência no nível do banco de dados
- Performance melhor para queries complexas
- Facilita manutenção

**Implementação**:
- Função `detect_availability_conflicts()` executa query SQL
- Verifica sobreposição de horários entre availability do owner e availability do actor participante
- Retorna lista de conflitos encontrados

### 2. Conflitos como ALERTA, não Bloqueio

**Decisão**: Detecção de conflitos retorna ALERTA, não bloqueia criação.

**Justificativa**:
- A confirmação cabe ao usuário
- Não cria lógica decisória automática
- Permite flexibilidade

**Implementação**:
- `detectConflicts()` retorna `ConflictDetectionResult` com lista de conflitos
- Endpoint de criação de participante retorna `conflictAlert` se houver conflitos
- NÃO bloqueia criação de participante

### 3. Apenas um Participante por Availability e Actor

**Decisão**: Constraint UNIQUE em `(availability_id, actor_id)`.

**Justificativa**:
- Evita duplicação de participantes
- Garante integridade de dados

**Implementação**:
- Constraint `availability_participants_unique_per_availability_actor`
- Índice único para performance

---

## 9. EXEMPLOS DE USO

### Adicionar Participante

```typescript
POST /availability/{availabilityId}/participants
{
  "actorId": "uuid-do-actor",
  "role": "participante",
  "metadata": {}
}
```

Resposta (com conflitos detectados):
```json
{
  "participant": {
    "participantId": "uuid-do-participant",
    "availabilityId": "uuid-da-availability",
    "actorId": "uuid-do-actor",
    "role": "participante",
    "createdAt": "2024-12-19T10:00:00Z"
  },
  "conflictAlert": {
    "hasConflicts": true,
    "conflicts": [
      {
        "conflictAvailabilityId": "uuid-da-availability-conflitante",
        "conflictStartDatetime": "2024-12-20T09:00:00Z",
        "conflictEndDatetime": "2024-12-20T12:00:00Z",
        "conflictOwnerType": "user",
        "conflictOwnerId": "uuid-do-actor"
      }
    ],
    "message": "Foram detectados 1 conflito(s) de horário. A confirmação cabe ao usuário."
  }
}
```

### Detectar Conflitos

```typescript
GET /availability/{availabilityId}/participants/{actorId}/conflicts
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "hasConflicts": true,
    "conflicts": [
      {
        "conflictAvailabilityId": "uuid-da-availability-conflitante",
        "conflictStartDatetime": "2024-12-20T09:00:00Z",
        "conflictEndDatetime": "2024-12-20T12:00:00Z",
        "conflictOwnerType": "user",
        "conflictOwnerId": "uuid-do-actor"
      }
    ],
    "message": "Foram detectados 1 conflito(s) de horário. A confirmação cabe ao usuário."
  },
  "alert": "Foram detectados conflitos de horário. A confirmação cabe ao usuário."
}
```

---

**Status Final**: ✅ **AVAILABILITY PARTICIPANTS IMPLEMENTADO E VALIDADO**

