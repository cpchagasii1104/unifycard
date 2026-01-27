# Painel "Meus Compromissos" — Implementação

**Data**: 2024-12-19  
**Objetivo**: Criar painel READ-ONLY onde o usuário enxerga tudo que está comprometido a fazer.

---

## BACKEND

### Endpoint Criado

**`GET /profile/me/commitments`**

- Retorna compromissos do usuário autenticado
- Read-only: Não altera estado
- Não prioriza: Apenas ordena por tempo quando faz sentido

### Fontes de Dados

1. **Eventos que participo** (`eventsParticipating`)
   - Query: `event_attendees` JOIN `events`
   - Filtro: `global_user_id` + status `published` ou `ongoing`
   - Ordenação: `start_time ASC` (próximos primeiro)
   - Limite: 20

2. **Eventos que organizo** (`eventsOrganizing`)
   - Query: `events` WHERE `created_by_global_user_id`
   - Filtro: status `draft`, `published` ou `ongoing`
   - Ordenação: `start_time ASC`
   - Limite: 20

3. **Grupos que gerencio** (`groupsManaging`)
   - Query: `groups` WHERE `owner_user_id`
   - Filtro: `is_active = true`
   - Ordenação: `created_at DESC` (mais recentes primeiro)
   - Limite: 20

4. **Agenda (bookings)** (`agendaBookings`)
   - Query: `bookings` JOIN `availability`
   - Filtro: `requester_actor_id` + status `confirmed` ou `pending` + `start_datetime >= now()`
   - Ordenação: `start_datetime ASC` (próximos primeiro)
   - Limite: 20

5. **Contador de inbox pendente** (`inboxPendingCount`)
   - Fonte: `socialInboxService.getInboxCounter()`
   - Retorna: `unreadCount`

### Arquivos Criados/Modificados

- `src/core/profile/commitments.routes.ts` — **NOVO**: Endpoint `/me/commitments`
- `src/core/profile/profile.module.ts` — **MODIFICADO**: Registra `commitmentsRoutes`

---

## FRONTEND

### Página Criada

**`MeusCompromissosPage.tsx`**

- Exibe seções simples:
  - Eventos que participo
  - Eventos que organizo
  - Grupos que gerencio
  - Agenda (próximos compromissos)
  - Pendências (contador do inbox)
- Sem CTA forçado
- Sem recomendação
- Sem decisão automática
- Apenas links para as entidades

### Arquivos Criados/Modificados

- `src/api/commitments.ts` — **NOVO**: API client para compromissos
- `src/pages/MeusCompromissosPage.tsx` — **NOVO**: Página de compromissos
- `src/pages/MeusCompromissosPage.css` — **NOVO**: Estilos da página
- `src/App.tsx` — **MODIFICADO**: Adiciona rotas `/compromissos` e `/meus-compromissos`

---

## Validação

- ✅ Frontend build: PASS
- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` não relacionado)
- ✅ Linter: Sem erros

---

## Fluxo Mental

1. Usuário acessa `/compromissos` ou `/meus-compromissos`
2. Frontend chama `GET /profile/me/commitments`
3. Backend busca dados de múltiplas fontes (eventos, grupos, bookings, inbox)
4. Backend retorna JSON com todas as seções
5. Frontend exibe seções simples com links clicáveis
6. Usuário clica em item → navega para entidade correspondente

---

## Blindagens

- 🔴 **Apenas leitura**: Endpoint não altera estado
- 🔴 **Não prioriza**: Não ordena por "importância"
- 🔴 **Sem dados pessoais**: Não retorna informações de outros usuários
- 🔴 **Sem CTA forçado**: Apenas links, sem botões manipulativos
- 🔴 **Sem recomendação**: Apenas exibe o que existe

---

**Status**: ✅ Implementação completa e validada

