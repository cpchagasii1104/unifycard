# Event Stats Endpoint (Read-Only)

**Endpoint**: `GET /api/events/:eventId/stats`

**Objetivo**: Retornar estatísticas de ingressos vendidos de forma clara e barata.

## Resposta

```json
{
  "soldCount": 45,
  "maxCapacity": 100,
  "remaining": 55,
  "occupancyPercent": 45,
  "updatedAt": "2024-12-19T10:30:00.000Z"
}
```

## Campos

- `soldCount`: Número de ingressos vendidos (fonte: `event_attendees`)
- `maxCapacity`: Capacidade máxima do evento (ou `null` se ilimitado)
- `remaining`: Ingressos restantes (ou `null` se ilimitado)
- `occupancyPercent`: Percentual de ocupação (ou `null` se ilimitado)
- `updatedAt`: Timestamp da última atualização

## Blindagens

- 🔴 **Apenas leitura**: Não altera estado do evento
- 🔴 **Fonte de verdade**: Usa `event_attendees` (não `current_occupancy` que é cache)
- 🔴 **Sem dados pessoais**: Não retorna informações de participantes individuais

## Uso no Frontend

O frontend pode usar este endpoint para exibir:
- "X vendidos de Y (Z% ocupado)"
- "X participantes/ingressos confirmados" (se `maxCapacity` for `null`)

