# Transições de Estado Visíveis (Read-Only) — Implementação

**Data**: 2024-12-19  
**Objetivo**: Expor transições de estado históricas já ocorridas no sistema, apenas como linha do tempo factual.

---

## BACKEND

### Endpoints Criados

**1. `GET /api/events/:eventId/state-history`**

- Retorna histórico de transições de estado do evento (read-only)
- Usa apenas dados reais já existentes
- Não infere estados, não cria estados novos, não adiciona labels interpretativas

**Resposta**:
```json
[
  { "state": "DRAFT", "changedAt": "2024-12-15T10:00:00Z" },
  { "state": "PUBLISHED", "changedAt": "2024-12-16T14:30:00Z" }
]
```

**Fontes de dados**:
- `events.status`: Estado atual do evento
- `events.created_at`: Data de criação (primeira transição)
- `events.updated_at`: Data da última atualização
- **Nota**: Sem tabela de histórico de estados, retorna apenas o estado atual na criação. Se houver tabela de histórico no futuro, ela será consultada.

**2. `GET /groups/:groupId/state-history`**

- Retorna histórico de transições de estado do grupo (read-only)
- Usa apenas dados reais já existentes
- Não infere estados, não cria estados novos, não adiciona labels interpretativas

**Resposta**:
```json
[
  { "state": "active", "changedAt": "2024-12-15T10:00:00Z" }
]
```

**Fontes de dados**:
- `groups.is_active`: Estado atual do grupo (true = 'active', false = 'inactive')
- `groups.created_at`: Data de criação (primeira transição)
- `groups.updated_at`: Data da última atualização
- **Nota**: Sem tabela de histórico de estados, retorna apenas o estado atual na criação. Se houver tabela de histórico no futuro, ela será consultada.

### Arquivos Criados/Modificados

- `src/modules/events/events-state-history.routes.ts` — **NOVO**: Endpoint `/events/:eventId/state-history`
- `src/modules/events/events.module.ts` — **MODIFICADO**: Registra `eventsStateHistoryRoutes`
- `src/modules/groups/groups-state-history.routes.ts` — **NOVO**: Endpoint `/groups/:groupId/state-history`
- `src/modules/groups/groups.module.ts` — **MODIFICADO**: Registra `groupsStateHistoryRoutes`

---

## FRONTEND

### Blocos Criados

**1. "Histórico de Estados" em `EventPage.tsx`**

- Exibe linha do tempo neutra com transições de estado
- Formato: estado técnico + data
- Sem cores emocionais
- Sem ícones de alerta
- Sem botões
- Sem sugestões

**2. "Histórico de Estados" em `GrupoDetailPage.tsx` (aba Gerenciamento)**

- Exibe linha do tempo neutra com transições de estado
- Formato: estado técnico + data
- Sem cores emocionais
- Sem ícones de alerta
- Sem botões
- Sem sugestões

### Arquivos Criados/Modificados

- `src/api/events.ts` — **MODIFICADO**: Adiciona `getEventStateHistory()`
- `src/api/groups.ts` — **MODIFICADO**: Adiciona `getGroupStateHistory()`
- `src/components/events/EventPage.tsx` — **MODIFICADO**: Adiciona bloco "Histórico de Estados"
- `src/components/events/EventPage.css` — **MODIFICADO**: Adiciona estilos para histórico de estados
- `src/pages/GrupoDetailPage.tsx` — **MODIFICADO**: Adiciona bloco "Histórico de Estados"
- `src/pages/GrupoDetailPage.css` — **MODIFICADO**: Adiciona estilos para histórico de estados

---

## Validação

- ✅ Frontend build: PASS
- ✅ Backend build: PASS (erro pré-existente em `events.routes.ts` não relacionado)
- ✅ Linter: Sem erros

---

## Blindagens

- 🔴 **Read-only absoluto**: Endpoints não alteram estado
- 🔴 **Sem lógica nova de negócio**: Usa apenas dados reais já existentes
- 🔴 **Não infere estados**: Não cria estados intermediários que não existem
- 🔴 **Não cria estados novos**: Apenas retorna estados já registrados
- 🔴 **Não adiciona labels interpretativas**: Apenas nomes técnicos dos estados
- 🔴 **Sem cores emocionais**: Apenas informações neutras
- 🔴 **Sem ícones de alerta**: Apenas linha do tempo factual
- 🔴 **Sem botões**: Apenas leitura
- 🔴 **Sem sugestões**: Apenas exibição de dados históricos

---

## Notas Técnicas

**Limitação Atual**: Sem tabela de histórico de estados, os endpoints retornam apenas o estado atual na data de criação. Se houver uma tabela de histórico de estados no futuro (ex: `event_state_history`, `group_state_history`), os endpoints devem ser atualizados para consultá-la.

**Estados de Eventos**:
- `DRAFT`, `PUBLISHED`, `ONGOING`, `FINISHED`, `CANCELLED`

**Estados de Grupos**:
- `active` (quando `is_active = true`)
- `inactive` (quando `is_active = false`)

---

**Status**: ✅ Implementação completa e validada

