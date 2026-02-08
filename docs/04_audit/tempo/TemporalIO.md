# MAPA TEMPORAL ARQUITETURAL — TEMPO COMO APRESENTAÇÃO (TemporalIO)

## Classificação: Uso de tempo para saída, serialização, resposta HTTP, logs e eventos

Este documento lista todas as ocorrências onde **data/hora é usada para APRESENTAÇÃO**,
ou seja, quando o tempo sai do sistema ou é transformado para consumo externo.

Nesses casos, o uso de **string (ISO 8601)** é **correto, esperado e desejável**.

---

### 1. backend/src/modules/groups/groups.repository.ts:83-84

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`
`updatedAt: row.updatedAt.toISOString()`
Conversão de Date para ISO no mapeamento de entidade

### 2. backend/src/modules/groups/groups.repository.ts:584

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: existing.createdAt.toISOString()`

### 3. backend/src/modules/groups/groups.repository.ts:593

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`

### 4. backend/src/modules/groups/groups.repository.ts:614

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`

### 5. backend/src/modules/groups/groups.repository.ts:631-632

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`
`updatedAt: row.updatedAt.toISOString()`

### 6. backend/src/modules/social/social-group.repository.ts:167

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: p.createdAt.toISOString()`

### 7. backend/src/core/auth/webauthn.repository.ts:41

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`

### 8. backend/src/core/auth/webauthn.repository.ts:56

**Tipo de saída:** DTO / Model
**Serialização:** ISO string
**Contexto:**
`createdAt: row.createdAt.toISOString()`

### 9. backend/src/modules/cultural/cultural-event.service.ts:835

**Tipo de saída:** JWT payload
**Serialização:** ISO string
**Contexto:**
`expiresAt: expiresAt.toISOString()`

### 10. backend/src/modules/cultural/cultural-event.service.ts:847

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`expiresAt: expiresAt.toISOString()`

### 11. backend/src/modules/inbox/social-inbox.routes.ts:125

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`readAt: item.readAt?.toISOString()`

### 12. backend/src/modules/inbox/social-inbox.routes.ts:157

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`archivedAt: item.archivedAt?.toISOString()`

### 13. backend/src/modules/events/events.service.ts:282-283

**Tipo de saída:** DTO / Evento
**Serialização:** ISO string
**Contexto:**
`eventStartTime: input.startTime.toISOString()`
`eventEndTime: input.endTime.toISOString()`

### 14. backend/src/modules/profile/commitments.routes.ts:75-76

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startTime: row.start_time.toISOString()`
`endTime: row.end_time.toISOString()`

### 15. backend/src/modules/profile/commitments.routes.ts:105-106

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startTime: row.start_time.toISOString()`
`endTime: row.end_time.toISOString()`

### 16. backend/src/modules/profile/commitments.routes.ts:173-175

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`requestedAt: row.requestedAt.toISOString()`
`startDatetime: row.start_datetime.toISOString()`
`endDatetime: row.end_datetime.toISOString()`

### 17. backend/src/core/availability/unified-availability.routes.ts:134-135

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startDatetime: availability.startDatetime.toISOString()`
`endDatetime: availability.endDatetime.toISOString()`

### 18. backend/src/core/availability/unified-availability.routes.ts:207-208

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startDatetime: a.startDatetime.toISOString()`
`endDatetime: a.endDatetime.toISOString()`

### 19. backend/src/core/availability/unified-availability.routes.ts:271-272

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startDatetime: availability.startDatetime.toISOString()`
`endDatetime: availability.endDatetime.toISOString()`

### 20. backend/src/core/availability/unified-availability.routes.ts:347-348

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`startDatetime: availability.startDatetime.toISOString()`
`endDatetime: availability.endDatetime.toISOString()`

### 21. backend/src/core/availability/unified-availability.routes.ts:410

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`requestedAt: booking.requestedAt.toISOString()`

### 22. backend/src/core/availability/unified-availability.routes.ts:465-467

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`requestedAt: b.requestedAt.toISOString()`
`checkedInAt: b.checkedInAt?.toISOString()`
`checkedOutAt: b.checkedOutAt?.toISOString()`

### 23. backend/src/core/availability/unified-availability.routes.ts:524-526

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`requestedAt: booking.requestedAt.toISOString()`
`checkedInAt: booking.checkedInAt?.toISOString()`
`checkedOutAt: booking.checkedOutAt?.toISOString()`

### 24. backend/src/core/availability/unified-availability.routes.ts:575

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`confirmedAt: booking.confirmedAt?.toISOString()`

### 25. backend/src/core/availability/unified-availability.routes.ts:625

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`checkedInAt: booking.checkedInAt?.toISOString()`

### 26. backend/src/core/availability/unified-availability.routes.ts:675

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`checkedOutAt: booking.checkedOutAt?.toISOString()`

### 27. backend/src/core/availability/unified-availability.routes.ts:757-758

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`conflictStartDatetime: c.conflictStartDatetime.toISOString()`
`conflictEndDatetime: c.conflictEndDatetime.toISOString()`

### 28. backend/src/core/availability/unified-availability.routes.ts:992-993

**Tipo de saída:** Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`conflictStartDatetime: c.conflictStartDatetime.toISOString()`
`conflictEndDatetime: c.conflictEndDatetime.toISOString()`

### 29. backend/src/core/events/event.service.ts:1131-1132

**Tipo de saída:** Objeto serializável
**Serialização:** ISO string
**Contexto:**
`start_datetime: availability.startDatetime.toISOString()`
`end_datetime: availability.endDatetime.toISOString()`

### 30. backend/src/core/events/event.routes.ts:148

**Tipo de saída:** Resposta HTTP (rate limit)
**Serialização:** ISO string
**Contexto:**
`resetAt: rateLimit.resetAt.toISOString()`

### 31. backend/src/core/events/event.routes.ts:453

**Tipo de saída:** Resposta HTTP (rate limit)
**Serialização:** ISO string
**Contexto:**
`resetAt: rateLimit.resetAt.toISOString()`

### 32. backend/src/core/events/event.routes.ts:752

**Tipo de saída:** Resposta HTTP (rate limit)
**Serialização:** ISO string
**Contexto:**
`resetAt: rateLimit.resetAt.toISOString()`

### 33. backend/src/core/auth/auth.routes.ts:93

**Tipo de saída:** Log + Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`resetAt: rateLimitCheck.resetAt.toISOString()`

### 34. backend/src/core/auth/auth.routes.ts:97

**Tipo de saída:** Mensagem de erro
**Serialização:** ISO string (interpolada)
**Contexto:**
`Tente novamente após ${rateLimitCheck.resetAt.toISOString()}`

### 35. backend/src/core/auth/auth.routes.ts:107

**Tipo de saída:** Resposta HTTP (erro)
**Serialização:** ISO string
**Contexto:**
`resetAt: error.resetAt?.toISOString()`

### 36. backend/src/core/auth/auth.routes.ts:236

**Tipo de saída:** Log + Resposta HTTP
**Serialização:** ISO string
**Contexto:**
`resetAt: rateLimitCheck.resetAt.toISOString()`

### 37. backend/src/core/auth/auth.routes.ts:240

**Tipo de saída:** Mensagem de erro
**Serialização:** ISO string (interpolada)

### 38. backend/src/core/auth/auth.routes.ts:250

**Tipo de saída:** Resposta HTTP (erro)
**Serialização:** ISO string

### 39. backend/src/core/auth/auth.routes.ts:353

**Tipo de saída:** Log + Resposta HTTP
**Serialização:** ISO string

### 40. backend/src/core/auth/auth.routes.ts:357

**Tipo de saída:** Mensagem de erro
**Serialização:** ISO string (interpolada)

### 41. backend/src/core/auth/auth.routes.ts:367

**Tipo de saída:** Resposta HTTP (erro)
**Serialização:** ISO string

### 42. backend/src/core/auth/auth.routes.ts:528

**Tipo de saída:** Log + Resposta HTTP
**Serialização:** ISO string

### 43. backend/src/core/auth/auth.routes.ts:532

**Tipo de saída:** Mensagem de erro
**Serialização:** ISO string (interpolada)

### 44. backend/src/core/auth/auth.routes.ts:542

**Tipo de saída:** Resposta HTTP (erro)
**Serialização:** ISO string

### 45. backend/src/core/identity/identity.service.ts:580

**Tipo de saída:** String formatada
**Serialização:** ISO string (substring YYYY-MM-DD)
**Contexto:**
`birthdate.toISOString().substring(0, 10)`

### 46. backend/src/core/identity/identity.service.ts:675

**Tipo de saída:** DTO
**Serialização:** ISO string (condicional)

### 47. backend/src/modules/services/service-order.repository.ts:73-74

**Tipo de saída:** DTO / Model
**Serialização:** ISO string

---

## TOTAL DE OCORRÊNCIAS

**47 usos classificados como TEMPO COMO APRESENTAÇÃO**

---

## CONCLUSÃO

Todas as ocorrências listadas:

* usam **string ISO 8601**
* são apropriadas para saída e serialização
* **não representam bug**
* **não devem ser convertidas para Date**

Este padrão está **consistente em todo o backend**.

---

**FIM DO DOCUMENTO**
