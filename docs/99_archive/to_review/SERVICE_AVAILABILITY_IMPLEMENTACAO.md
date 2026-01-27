# Implementação: Domínio de AGENDA & DISPONIBILIDADE

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de AGENDA & DISPONIBILIDADE para serviços

---

## 1. DEFINIÇÃO CANÔNICA

### Agenda NÃO é:
- ❌ Decisão de quem pode agendar
- ❌ Pagamento
- ❌ Matching
- ❌ Vínculo direto com Actor
- ❌ Vínculo com educação, aprendizado ou score

### Agenda É:
- ✅ Janelas disponíveis de um Service
- ✅ Pertence a um Service (obrigatório)
- ✅ Apenas expõe disponibilidade
- ✅ Informação temporal (start_datetime, end_datetime, timezone)

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/137_service_availability.sql`):
   - Tabela `service_availability` com relacionamento obrigatório com `services`
   - Enums: `availability_type` (fixed, recurring, on_demand) e `availability_status` (active, paused)
   - Campos: `start_datetime`, `end_datetime`, `timezone`, `capacity` (opcional)
   - Triggers para `updated_at`
   - Índices para performance

2. **Tipos** (`src/modules/services/service-availability.types.ts`):
   - `AvailabilityType` enum
   - `AvailabilityStatus` enum
   - `ServiceAvailability` interface
   - `CreateServiceAvailabilityInput` interface
   - `UpdateServiceAvailabilityInput` interface

3. **Repository** (`src/modules/services/service-availability.repository.ts`):
   - `findById()` - Busca disponibilidade por ID
   - `findByService()` - Lista disponibilidades de um Service
   - `create()` - Cria nova disponibilidade (valida serviceId obrigatório)
   - `update()` - Atualiza disponibilidade

4. **Service** (`src/modules/services/service-availability.service.ts`):
   - `createAvailability()` - Cria disponibilidade com validação de service
   - `getAvailability()` - Busca disponibilidade por ID
   - `getServiceAvailabilities()` - Lista disponibilidades de um Service
   - `updateAvailability()` - Atualiza disponibilidade

5. **Routes** (`src/modules/services/service-availability.routes.ts`):
   - `POST /services/:id/availability` - Criar nova disponibilidade
   - `GET /services/:id/availability` - Listar disponibilidades de um serviço
   - `PUT /services/:serviceId/availability/:availabilityId` - Atualizar disponibilidade

6. **Module** (`src/modules/services/services.module.ts`):
   - Registrado rotas de disponibilidade

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_AVAILABILITY_CREATED`**:
   - Emitido quando disponibilidade é criada
   - Afeta: `SERVICE_AVAILABILITY_READ_MODEL`, `SERVICE_AVAILABILITY_LIST_READ_MODEL`, `SERVICE_READ_MODEL`

2. **`SERVICE_AVAILABILITY_UPDATED`**:
   - Emitido quando disponibilidade é atualizada
   - Afeta: `SERVICE_AVAILABILITY_READ_MODEL`, `SERVICE_AVAILABILITY_LIST_READ_MODEL`, `SERVICE_READ_MODEL`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_AVAILABILITY_CREATED]: [
  ReadModelType.SERVICE_AVAILABILITY_READ_MODEL,
  ReadModelType.SERVICE_AVAILABILITY_LIST_READ_MODEL,
  ReadModelType.SERVICE_READ_MODEL,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`SERVICE_AVAILABILITY_READ_MODEL`**:
   - Projeção de uma disponibilidade individual
   - Atualizado quando: `SERVICE_AVAILABILITY_CREATED`, `SERVICE_AVAILABILITY_UPDATED`

2. **`SERVICE_AVAILABILITY_LIST_READ_MODEL`**:
   - Projeção de lista de disponibilidades
   - Atualizado quando: `SERVICE_AVAILABILITY_CREATED`, `SERVICE_AVAILABILITY_UPDATED`

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`service-availability.types.ts`**:
   - Explica que agenda pertence a um Service, não diretamente ao Actor
   - Explica que agenda NÃO decide quem pode agendar
   - Explica que agenda NÃO faz pagamento
   - Explica que agenda NÃO faz matching
   - Explica que agenda apenas expõe janelas disponíveis

2. **`service-availability.repository.ts`**:
   - Valida que `serviceId` é obrigatório
   - Comentário: "Nenhuma disponibilidade deve ser criada sem service"
   - Comentário: "Nenhuma query deve usar disponibilidade como filtro decisório"

3. **`service-availability.service.ts`**:
   - Valida que `serviceId` foi fornecido
   - Valida que service existe
   - Comentários explicando que agenda NÃO decide quem pode agendar
   - Comentários explicando que agenda NÃO faz pagamento
   - Comentários explicando que agenda NÃO faz matching
   - Comentários explicando que agenda apenas expõe janelas disponíveis

4. **`service-availability.routes.ts`**:
   - Comentário: "serviceId é OBRIGATÓRIO"
   - Comentário: "Nenhuma query deve usar disponibilidade como filtro decisório"

---

## 6. ENDPOINTS

### Backend

1. **`POST /services/:id/availability`**:
   - Cria nova disponibilidade para um serviço
   - Requer: `serviceId` (da URL), `startDatetime`, `endDatetime`
   - Opcional: `availabilityType`, `status`, `timezone`, `capacity`, `metadata`
   - Emite effect: `SERVICE_AVAILABILITY_CREATED`

2. **`GET /services/:id/availability`**:
   - Lista disponibilidades de um serviço
   - Filtros opcionais: `status` (active, paused)
   - Retorna: Array de `ServiceAvailability`

3. **`PUT /services/:serviceId/availability/:availabilityId`**:
   - Atualiza disponibilidade
   - Valida permissão (owner do service)
   - Emite effect: `SERVICE_AVAILABILITY_UPDATED`

---

## 7. RELACIONAMENTOS

### Availability ↔ Service

- **Obrigatório**: `service_id` (FK para `services`)
- **Cascade**: `ON DELETE CASCADE` (se service for deletado, disponibilidades são deletadas)
- **Validação**: Service deve existir antes de criar disponibilidade

---

## 8. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `migrations/137_service_availability.sql`
   - Migration para criar tabela `service_availability`
   - Enums `availability_type` e `availability_status`
   - Triggers e índices

2. `src/modules/services/service-availability.types.ts`
   - Tipos do domínio de disponibilidade

3. `src/modules/services/service-availability.repository.ts`
   - Repository para acesso ao banco

4. `src/modules/services/service-availability.service.ts`
   - Service com lógica de negócio

5. `src/modules/services/service-availability.routes.ts`
   - Rotas Fastify

### Backend (alterados)

6. `src/modules/social/actor-effects.types.ts`
   - Adicionado: `SERVICE_AVAILABILITY_CREATED`, `SERVICE_AVAILABILITY_UPDATED`

7. `src/core/read-models/read-model.types.ts`
   - Adicionado: `SERVICE_AVAILABILITY_READ_MODEL`, `SERVICE_AVAILABILITY_LIST_READ_MODEL`

8. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para disponibilidade

9. `src/modules/services/services.module.ts`
   - Registrado rotas de disponibilidade

---

## 10. PRÓXIMOS PASSOS (NÃO IMPLEMENTADOS)

- ❌ Booking (futuro)
- ❌ Pagamento (futuro)
- ❌ Split de receita (futuro)
- ❌ UI (futuro)
- ❌ Matching automático (NÃO será implementado - blindagem)
- ❌ Auto-accept (NÃO será implementado - blindagem)

---

## 11. EXEMPLOS DE USO

### Criar Disponibilidade

```typescript
POST /services/{serviceId}/availability
{
  "startDatetime": "2024-12-20T09:00:00Z",
  "endDatetime": "2024-12-20T18:00:00Z",
  "availabilityType": "fixed",
  "status": "active",
  "timezone": "America/Sao_Paulo",
  "capacity": 5
}
```

### Listar Disponibilidades de um Serviço

```typescript
GET /services/{serviceId}/availability?status=active
```

### Atualizar Disponibilidade

```typescript
PUT /services/{serviceId}/availability/{availabilityId}
{
  "status": "paused"
}
```

---

**Status Final**: ✅ **DOMÍNIO DE AGENDA & DISPONIBILIDADE IMPLEMENTADO E VALIDADO**

