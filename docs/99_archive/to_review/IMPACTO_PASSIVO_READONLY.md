# Impacto Passivo (Read-Only) — Implementação

**Data**: 2024-12-19  
**Objetivo**: Expor impacto passivo do estado atual do usuário no sistema.

---

## BACKEND

### Endpoint Criado

**`GET /profile/me/impact-overview`**

- Retorna impacto passivo do usuário autenticado
- Read-only: Não altera estado
- Não projeta futuro: Apenas estado atual
- Não sugere ação: Apenas números e descrições neutras
- Não usa palavras como "urgente", "risco", "perda"

### Fontes de Dados

1. **Eventos Afetados** (`eventsAffected`)
   - Query: COUNT de `events` WHERE `created_by_global_user_id` AND (`status = 'draft'` OR (`status = 'published'` AND `end_time < now()` AND `status != 'completed'` AND `status != 'archived'`))
   - Descrição neutra: "X eventos estão aguardando ação"

2. **Pessoas Aguardando** (`peopleWaiting`)
   - Participantes de eventos pendentes: COUNT DISTINCT `event_attendees.global_user_id` WHERE evento é pendente
   - Membros de grupos inativos: COUNT DISTINCT `group_members.user_id` WHERE grupo é inativo
   - Bookings pendentes: COUNT DISTINCT `bookings.requester_actor_id` WHERE booking é pendente E usuário é owner
   - Descrição neutra: "X pessoas aguardam decisões em eventos que você organiza"

3. **Valores Bloqueados** (`moneyLockedCents`)
   - Query: SUM de `service_payment_requests.amount` WHERE `status = 'pending'` AND `payer_actor_id` = actor
   - Descrição neutra: "X valores estão vinculados a ações pendentes"

4. **Eventos em Andamento** (`ongoingEvents`)
   - Query: COUNT de `events` WHERE `created_by_global_user_id` AND `status IN ('published', 'ongoing')` AND `start_time <= now()` AND `end_time >= now()`
   - Descrição neutra: "X eventos em andamento"

5. **Grupos Ativos** (`activeGroups`)
   - Query: COUNT de `groups` WHERE `owner_user_id` AND `is_active = true`
   - Descrição neutra: "X grupos ativos"

### Resposta

```json
{
  "pendingImpact": {
    "eventsAffected": 3,
    "peopleWaiting": 15,
    "moneyLockedCents": 50000
  },
  "neutralImpact": {
    "ongoingEvents": 2,
    "activeGroups": 5
  },
  "updatedAt": "2024-12-19T10:30:00Z"
}
```

### Arquivos Criados/Modificados

- `src/core/profile/impact-overview.routes.ts` — **NOVO**: Endpoint `/me/impact-overview`
- `src/core/profile/profile.module.ts` — **MODIFICADO**: Registra `impactOverviewRoutes`

---

## FRONTEND

### Seção Criada

**"Impacto Atual" em `MeusCompromissosPage.tsx`**

- Exibe frases neutras:
  - "X pessoas aguardam decisões em eventos que você organiza"
  - "X valores estão vinculados a ações pendentes"
  - "X eventos estão aguardando ação"
  - "X eventos em andamento"
  - "X grupos ativos"
- Sem botão
- Sem CTA
- Sem destaque emocional

### Arquivos Criados/Modificados

- `src/api/impactOverview.ts` — **NOVO**: API client para impacto
- `src/pages/MeusCompromissosPage.tsx` — **MODIFICADO**: Adiciona seção "Impacto Atual"
- `src/pages/MeusCompromissosPage.css` — **MODIFICADO**: Adiciona estilos para impacto

---

## Validação

- ✅ Frontend build: PASS
- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` não relacionado)
- ✅ Linter: Sem erros

---

## Blindagens

- 🔴 **Read-only absoluto**: Endpoint não altera estado
- 🔴 **Sem lógica nova de negócio**: Usa apenas dados já existentes
- 🔴 **Sem ranking**: Não ordena por importância
- 🔴 **Não projeta futuro**: Apenas estado atual
- 🔴 **Não sugere ação**: Apenas números e descrições neutras
- 🔴 **Não usa palavras emocionais**: Evita "urgente", "risco", "perda"
- 🔴 **Sem CTA**: Apenas exibição
- 🔴 **Sem destaque emocional**: Apenas informações neutras

---

**Status**: ✅ Implementação completa e validada

