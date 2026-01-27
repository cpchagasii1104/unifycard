# Group Dashboard Endpoint (Read-Only)

**Endpoint**: `GET /api/groups/:groupId/dashboard`

**Objetivo**: Retornar métricas simples do grupo para exibição em dashboard.

## Resposta

```json
{
  "membersCount": 25,
  "eventsCount": 5,
  "postsCount": 42,
  "updatedAt": "2024-12-19T10:30:00.000Z"
}
```

## Campos

- `membersCount`: Número de membros do grupo (fonte: `group_members`)
- `eventsCount`: Número de eventos do grupo (fonte: `group_events`)
- `postsCount`: Número de posts do grupo (fonte: `posts` com `metadata->>'groupId'`) ou `null` se não houver model claro
- `updatedAt`: Timestamp da última atualização

## Blindagens

- 🔴 **Apenas leitura**: Não altera estado do grupo
- 🔴 **Sem ranking**: Apenas contagens, sem score ou priorização
- 🔴 **Sem dados pessoais**: Não retorna informações de membros individuais

## Uso no Frontend

O frontend pode usar este endpoint para exibir um mini-dashboard no topo da página do grupo:
- Membros (count)
- Eventos do grupo (count)
- Posts recentes do grupo (count, se disponível)

