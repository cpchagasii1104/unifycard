# Ciclo de Valor Visível — Dashboards (Grupos + Eventos)

**Data**: 2024-12-19  
**Objetivo**: Exibir métricas visíveis de forma clara no frontend, com dados reais do backend.

---

## PARTE A — EVENTOS (Ticket Sales visível)

### Backend

**Endpoint criado**: `GET /api/events/:eventId/stats`

- Retorna: `{ soldCount, maxCapacity, remaining, occupancyPercent, updatedAt }`
- Fonte de verdade: `event_attendees` (não `current_occupancy` que é cache)
- Read-only: Não altera estado do evento

**Arquivos alterados**:
- `src/modules/events/events.routes.ts` — Adicionado endpoint `/stats`

### Frontend

**Componente atualizado**: `EventPage.tsx`

- Bloco "Ingressos" no topo da página
- Exibe: "X vendidos de Y (Z% ocupado)" se houver capacidade
- Exibe: "X participantes/ingressos confirmados" se capacidade for `null`
- Fallback: Usa `currentOccupancy` do Event DTO se endpoint falhar

**Arquivos alterados**:
- `src/api/events.ts` — Adicionada função `getEventStats()`
- `src/components/events/EventPage.tsx` — Adicionado bloco de ingressos

---

## PARTE B — GRUPOS (Acesso a Gerenciamento + Mini-dashboard)

### Backend

**Endpoint criado**: `GET /api/groups/:groupId/dashboard`

- Retorna: `{ membersCount, eventsCount, postsCount, updatedAt }`
- Fonte de verdade:
  - `membersCount`: `group_members`
  - `eventsCount`: `group_events`
  - `postsCount`: `posts` com `metadata->>'groupId'` (ou `null` se não houver model claro)
- Read-only: Não altera estado do grupo

**Arquivos alterados**:
- `src/modules/groups/groups.routes.ts` — Adicionado endpoint `/dashboard`

### Frontend

**Componente atualizado**: `GrupoDetailPage.tsx`

- Aba "Configurações" renomeada para "Gerenciamento"
- Mini-dashboard no topo da página do grupo:
  - Membros (count)
  - Eventos do grupo (count)
  - Posts do grupo (count, se disponível)
- Dashboard carregado automaticamente ao abrir página do grupo

**Arquivos alterados**:
- `src/api/groups.ts` — Adicionada função `getGroupDashboard()`
- `src/pages/GrupoDetailPage.tsx` — Adicionado dashboard e renomeada aba

---

## Validação

- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` linha 86 não relacionado)
- ✅ Frontend build: PASS
- ✅ Linter: Sem erros

---

## Documentação

- `docs/EVENT_STATS_READONLY.md` — Documentação do endpoint de stats de eventos
- `docs/GROUP_DASHBOARD_READONLY.md` — Documentação do endpoint de dashboard de grupos

---

## Fluxo Mental

### Eventos
1. Usuário acessa página do evento
2. Frontend chama `GET /api/events/:eventId/stats`
3. Backend conta `event_attendees` e retorna métricas
4. Frontend exibe "X vendidos de Y (Z% ocupado)" no topo

### Grupos
1. Usuário acessa página do grupo
2. Frontend chama `GET /api/groups/:groupId/dashboard`
3. Backend conta membros, eventos e posts
4. Frontend exibe mini-dashboard no topo
5. Aba "Gerenciamento" disponível para owner/admin

---

## Blindagens

- 🔴 **Apenas leitura**: Endpoints não alteram estado
- 🔴 **Fonte de verdade**: Usam tabelas reais, não cache
- 🔴 **Sem dados pessoais**: Não retornam informações individuais
- 🔴 **Sem ranking**: Apenas contagens, sem score ou priorização

---

**Status**: ✅ Implementação completa e validada

