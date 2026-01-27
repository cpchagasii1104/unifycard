# Painel "Meus Compromissos" (Read-Only)

**Endpoint**: `GET /profile/me/commitments`

**Objetivo**: Exibir visão geral de tudo que o usuário está comprometido a fazer.

## Resposta

```json
{
  "eventsParticipating": [
    {
      "eventId": "uuid",
      "title": "Nome do Evento",
      "startTime": "2024-12-20T10:00:00Z",
      "endTime": "2024-12-20T12:00:00Z",
      "status": "published",
      "checkedIn": false
    }
  ],
  "eventsOrganizing": [
    {
      "eventId": "uuid",
      "title": "Nome do Evento",
      "startTime": "2024-12-20T10:00:00Z",
      "endTime": "2024-12-20T12:00:00Z",
      "status": "published"
    }
  ],
  "groupsManaging": [
    {
      "groupId": "uuid",
      "name": "Nome do Grupo",
      "isActive": true,
      "createdAt": "2024-12-19T10:00:00Z"
    }
  ],
  "agendaBookings": [
    {
      "bookingId": "uuid",
      "availabilityId": "uuid",
      "status": "confirmed",
      "requestedAt": "2024-12-19T10:00:00Z",
      "startDatetime": "2024-12-20T10:00:00Z",
      "endDatetime": "2024-12-20T12:00:00Z"
    }
  ],
  "inboxPendingCount": 5,
  "updatedAt": "2024-12-19T10:30:00Z"
}
```

## Fontes de Dados

- **eventsParticipating**: `event_attendees` JOIN `events` (status: published, ongoing)
- **eventsOrganizing**: `events` WHERE `created_by_global_user_id` (status: draft, published, ongoing)
- **groupsManaging**: `groups` WHERE `owner_user_id` (is_active: true)
- **agendaBookings**: `bookings` JOIN `availability` WHERE `requester_actor_id` (status: confirmed, pending, start_datetime >= now())
- **inboxPendingCount**: `social_inbox` counter (unread)

## Ordenação

- **Eventos**: Por `start_time ASC` (próximos primeiro)
- **Grupos**: Por `created_at DESC` (mais recentes primeiro)
- **Agenda**: Por `start_datetime ASC` (próximos primeiro)

## Blindagens

- 🔴 **Apenas leitura**: Não altera estado
- 🔴 **Não prioriza**: Não ordena por "importância"
- 🔴 **Sem dados pessoais**: Não retorna informações de outros usuários
- 🔴 **Limites**: Máximo 20 itens por seção

## Uso no Frontend

O frontend exibe seções simples:
- Eventos que participo
- Eventos que organizo
- Grupos que gerencio
- Agenda (próximos compromissos)
- Pendências (contador do inbox)

Cada item é clicável e navega para a entidade correspondente.

