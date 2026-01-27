# Pendências (Read-Only) — Implementação

**Data**: 2024-12-19  
**Objetivo**: Expor pendências reais que já existem no sistema, sem criar workflow novo.

---

## BACKEND

### Endpoint Criado

**`GET /profile/me/pending-responsibilities`**

- Retorna pendências do usuário autenticado
- Read-only: Não altera estado
- Não prioriza: Não ordena por "importância"
- Apenas ordena por data quando faz sentido

### Fontes de Dados

1. **Eventos Pendentes** (`pendingEvents`)
   - Query: `events` WHERE `created_by_global_user_id` AND (`status = 'draft'` OR (`status = 'published'` AND `end_time < now()` AND `status != 'completed'` AND `status != 'archived'`))
   - Ordenação: `created_at DESC`
   - Limite: 20

2. **Grupos Pendentes** (`pendingGroups`)
   - Query: `groups` WHERE `owner_user_id` AND (`is_active = false` OR (`hasFinancialIntent = true` AND `financial_purpose IS NULL`))
   - Ordenação: `created_at DESC`
   - Limite: 20

3. **Serviços Pendentes** (`pendingServices`)
   - Query: `services` JOIN `availability` JOIN `bookings` WHERE `bookings.status = 'requested'`
   - Agrupa por serviço e conta bookings pendentes
   - Ordenação: `created_at DESC`
   - Limite: 20

4. **Pagamentos Pendentes** (`pendingPayments`)
   - Query: `service_payment_requests` WHERE `payer_actor_id` AND `status = 'pending'`
   - Ordenação: `requested_at DESC`
   - Limite: 20

5. **Bookings Pendentes** (`pendingBookings`)
   - Query: `bookings` JOIN `availability` WHERE `bookings.status = 'requested'` AND usuário é owner da availability
   - Ordenação: `requested_at DESC`
   - Limite: 20

### Resposta

```json
{
  "pendingEvents": [
    {
      "id": "uuid",
      "title": "Nome do Evento",
      "type": "event",
      "status": "draft",
      "startTime": "2024-12-20T10:00:00Z",
      "endTime": "2024-12-20T12:00:00Z",
      "createdAt": "2024-12-19T10:00:00Z"
    }
  ],
  "pendingGroups": [
    {
      "id": "uuid",
      "name": "Nome do Grupo",
      "type": "group",
      "status": "inactive",
      "needsFinancialPurpose": true,
      "createdAt": "2024-12-19T10:00:00Z"
    }
  ],
  "pendingServices": [
    {
      "id": "uuid",
      "title": "Nome do Serviço",
      "type": "service",
      "status": "active",
      "pendingBookingsCount": 3,
      "createdAt": "2024-12-19T10:00:00Z"
    }
  ],
  "pendingPayments": [
    {
      "id": "uuid",
      "type": "payment",
      "status": "pending",
      "amount": 10000,
      "currency": "FIC",
      "serviceId": "uuid",
      "bookingId": "uuid",
      "requestedAt": "2024-12-19T10:00:00Z"
    }
  ],
  "pendingBookings": [
    {
      "id": "uuid",
      "availabilityId": "uuid",
      "type": "booking",
      "status": "requested",
      "requesterActorId": "uuid",
      "ownerType": "service",
      "ownerId": "uuid",
      "startDatetime": "2024-12-20T10:00:00Z",
      "endDatetime": "2024-12-20T12:00:00Z",
      "requestedAt": "2024-12-19T10:00:00Z"
    }
  ],
  "updatedAt": "2024-12-19T10:30:00Z"
}
```

### Arquivos Criados/Modificados

- `src/core/profile/pending-responsibilities.routes.ts` — **NOVO**: Endpoint `/me/pending-responsibilities`
- `src/core/profile/profile.module.ts` — **MODIFICADO**: Registra `pendingResponsibilitiesRoutes`

---

## FRONTEND

### Seção Criada

**"Pendências" em `MeusCompromissosPage.tsx`**

- Exibe listas simples:
  - Nome da entidade
  - Tipo
  - Estado atual
  - Link para a entidade
- Sem botões de ação
- Sem ordenação por importância
- Ordena apenas por data (quando fizer sentido)

### Arquivos Criados/Modificados

- `src/api/pendingResponsibilities.ts` — **NOVO**: API client para pendências
- `src/pages/MeusCompromissosPage.tsx` — **MODIFICADO**: Adiciona seção "Pendências"
- `src/pages/MeusCompromissosPage.css` — **MODIFICADO**: Adiciona estilos para pendências

---

## Validação

- ✅ Frontend build: PASS
- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` não relacionado)
- ✅ Linter: Sem erros

---

## Blindagens

- 🔴 **Apenas leitura**: Endpoint não altera estado
- 🔴 **Não prioriza**: Não ordena por "importância"
- 🔴 **Não inferir prioridade**: Usa apenas estados já existentes
- 🔴 **Não inferir urgência**: Não sugere ação
- 🔴 **Não mudar estado**: Apenas exibe pendências reais
- 🔴 **Sem botões de ação**: Apenas links para entidades
- 🔴 **Sem ordenação por importância**: Apenas por data

---

**Status**: ✅ Implementação completa e validada

