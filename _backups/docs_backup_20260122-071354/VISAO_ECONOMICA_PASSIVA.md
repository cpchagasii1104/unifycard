# Visão Econômica Passiva — Implementação

**Data**: 2024-12-19  
**Objetivo**: Expor o estado econômico passivo dos compromissos já existentes (read-only).

---

## PARTE A — EVENTO (ECONOMIA)

### Backend

**Endpoint criado**: `GET /api/events/:eventId/economy`

- Retorna economia do evento (read-only)
- Usa dados já existentes (ledger / impact / transactions)
- Não cria split novo, não inferir projeções

**Resposta**:
```json
{
  "totalCollected": 15000,
  "expectedTotal": 20000,
  "participantsCount": 10,
  "ticketPriceCents": 2000,
  "maxCapacity": 100,
  "lastUpdate": "2024-12-19T10:30:00Z"
}
```

**Fontes de dados**:
- `totalCollected`: Soma de `ledger` WHERE `metadata->>'event_id'` = eventId AND `entry_type` = 'CREDIT'
- `expectedTotal`: `participantsCount * ticket_price_cents` (apenas se houver `max_capacity`)
- `participantsCount`: COUNT de `event_attendees` WHERE `event_id` = eventId

**Arquivos**:
- `src/modules/events/events-economy.routes.ts` — **NOVO**: Endpoint `/events/:eventId/economy`
- `src/modules/events/events.module.ts` — **MODIFICADO**: Registra `eventsEconomyRoutes`

### Frontend

**Bloco adicionado**: "Economia do Evento" em `EventPage.tsx`

- Exibe apenas números reais e atuais
- Sem gráficos agressivos
- Mostra: Total Coletado, Total Esperado (se houver), Participantes

**Arquivos**:
- `src/api/events.ts` — **MODIFICADO**: Adiciona `getEventEconomy()`
- `src/components/events/EventPage.tsx` — **MODIFICADO**: Adiciona bloco de economia

---

## PARTE B — GRUPO (ECONOMIA)

### Backend

**Endpoint criado**: `GET /groups/:groupId/economy`

- Retorna economia do grupo (read-only)
- Usa `economicOverviewProjector.projectGroupEconomicOverview()`

**Resposta**:
```json
{
  "totalIn": 50000,
  "totalOut": 0,
  "balance": 50000,
  "currency": "FIC",
  "lastUpdate": "2024-12-19T10:30:00Z"
}
```

**Fontes de dados**:
- `totalIn`: Soma de `service_payment_executions` + `payment_splits` onde grupo é receiver
- `totalOut`: 0 (grupos não pagam, apenas recebem)
- `balance`: `totalIn - totalOut`

**Arquivos**:
- `src/modules/groups/groups.routes.ts` — **MODIFICADO**: Adiciona endpoint `/groups/:id/economy`

### Frontend

**Bloco adicionado**: "Economia do Grupo" em `GrupoDetailPage.tsx` (aba Gerenciamento)

- Exibe apenas valores agregados
- Mostra: Total Recebido, Total Pago, Saldo

**Arquivos**:
- `src/api/groups.ts` — **MODIFICADO**: Adiciona `getGroupEconomy()`
- `src/pages/GrupoDetailPage.tsx` — **MODIFICADO**: Adiciona bloco de economia na aba de gerenciamento

---

## PARTE C — USUÁRIO (VISÃO GLOBAL)

### Backend

**Endpoint estendido**: `GET /profile/me/commitments`

- Adiciona campo `economySummary` na resposta
- Usa `economicOverviewProjector.projectActorEconomicOverview()`

**Resposta estendida**:
```json
{
  "eventsParticipating": [...],
  "eventsOrganizing": [...],
  "groupsManaging": [...],
  "agendaBookings": [...],
  "inboxPendingCount": 5,
  "economySummary": {
    "totalInvolved": 42,
    "totalSpent": 150000,
    "totalReceived": 200000
  },
  "updatedAt": "2024-12-19T10:30:00Z"
}
```

**Fontes de dados**:
- `totalInvolved`: Número de execuções (payer + receiver)
- `totalSpent`: Soma de `service_payment_executions` onde actor é payer
- `totalReceived`: Soma de `service_payment_executions` + `payment_splits` onde actor é receiver

**Arquivos**:
- `src/core/profile/commitments.routes.ts` — **MODIFICADO**: Adiciona `economySummary`

### Frontend

**Seção adicionada**: "Resumo Econômico" em `MeusCompromissosPage.tsx`

- Exibe apenas leitura
- Mostra: Total Envolvido, Total Gasto, Total Recebido

**Arquivos**:
- `src/api/commitments.ts` — **MODIFICADO**: Adiciona interface `EconomySummary`
- `src/pages/MeusCompromissosPage.tsx` — **MODIFICADO**: Adiciona seção de resumo econômico

---

## Validação

- ✅ Frontend build: PASS
- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` não relacionado)
- ✅ Linter: Sem erros

---

## Blindagens

- 🔴 **Apenas leitura**: Endpoints não alteram estado
- 🔴 **Não cria split novo**: Usa dados já existentes
- 🔴 **Não inferir projeções**: Apenas números reais e atuais
- 🔴 **Sem gráficos agressivos**: Apenas valores agregados
- 🔴 **Sem CTA manipulativo**: Apenas exibição
- 🔴 **Sem score ou ranking**: Apenas leitura de estado econômico existente

---

**Status**: ✅ Implementação completa e validada

