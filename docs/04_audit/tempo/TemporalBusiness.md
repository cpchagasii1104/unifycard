# MAPA TEMPORAL ARQUITETURAL — TEMPO COMO REGRA (TemporalBusiness)

## Classificação: Uso de tempo para comparação, cálculo, SLA, rate limiting, ordenação

Este documento lista todas as ocorrências onde **data/hora é usada como REGRA DE NEGÓCIO**,
ou seja, para cálculo, validação, comparação ou janelas temporais.

Nesses casos, o uso de `Date` é **legítimo, esperado e necessário**.

---

### 1. backend/src/core/events/event.service.ts:182-183

**Trecho:**
`const startDate = new Date(input.datetimeStart);`
`const endDate = new Date(input.datetimeEnd);`
**Justificativa:** Conversão para Date para validação de intervalo (endDate <= startDate)

### 2. backend/src/core/events/event.service.ts:189

**Trecho:**
`if (endDate <= startDate)`
**Justificativa:** Comparação temporal para validação de regra de negócio

### 3. backend/src/core/events/event.service.ts:360-361

**Trecho:**
Conversão condicional de datas para atualização de janela temporal
**Justificativa:** Cálculo e validação de intervalo atualizado

### 4. backend/src/core/events/event.service.ts:587-588

**Trecho:**
Conversão de `window.startDatetime` e `window.endDatetime` para Date
**Justificativa:** Validação de janelas de tempo

### 5. backend/src/core/events/event.service.ts:980-989

**Trecho:**
Conversões e comparações entre evento e disponibilidade
**Justificativa:** Detecção de conflitos de agenda

### 6. backend/src/core/events/event.service.ts:1094-1121

**Trecho:**
Conversões e comparações para validação de janelas de disponibilidade
**Justificativa:** Regra de negócio para conflito temporal

### 7. backend/src/core/events/event.service.ts:1314-1315

**Trecho:**
Conversão de janela para Date
**Justificativa:** Validação de intervalo

### 8. backend/src/modules/cultural/cultural-event.service.ts:119-121

**Trecho:**
Conversão de input e comparação `endDate <= startDate`
**Justificativa:** Validação de intervalo de evento cultural

### 9. backend/src/modules/cultural/cultural-event.service.ts:829-830

**Trecho:**
`expiresAt = datetime_end + 1h`
**Justificativa:** Cálculo de expiração de QR code

### 10. backend/src/modules/cultural/cultural-event.service.ts:870-871

**Trecho:**
`if (new Date() > expiresAt)`
**Justificativa:** Verificação de expiração

### 11. backend/src/modules/cultural/cultural-event.service.ts:950-956

**Trecho:**
Cálculo de janela de check-in (-30min / +1h)
**Justificativa:** Regra operacional de check-in

### 12. backend/src/modules/cultural/cultural-event.service.ts:1272-1277

**Trecho:**
Cálculo de janela de check-in com comparação a `now`
**Justificativa:** Validação de acesso por horário

### 13. backend/src/core/availability/unified-availability.routes.ts:117-118

**Trecho:**
Conversão de input para Date
**Justificativa:** Validação e processamento interno

### 14. backend/src/core/availability/unified-availability.routes.ts:186-189

**Trecho:**
Conversão de filtros para Date
**Justificativa:** Filtro temporal de busca

### 15. backend/src/core/availability/unified-availability.routes.ts:325-328

**Trecho:**
Conversão de update para Date
**Justificativa:** Validação antes de persistir

### 16. backend/src/core/identity/identity.service.ts:48-64

**Trecho:**
Criação e normalização de birthdate em UTC
**Justificativa:** Evitar inconsistência de dia por timezone

### 17. backend/src/modules/subscriptions/subscription.service.ts:54

**Trecho:**
`now + 5 minutos`
**Justificativa:** Agendamento de próxima execução

### 18. backend/src/modules/subscriptions/subscription.service.ts:132-133

**Trecho:**
Reagendamento se data estiver no passado
**Justificativa:** Regra de segurança operacional

### 19. backend/src/core/referral/referral.service.ts:194-195

**Trecho:**
`now + 1 ano`
**Justificativa:** Expiração de referral

### 20. backend/src/modules/groups/groups.repository.ts:664, 724, 767

**Trecho:**
`const now = new Date()`
**Justificativa:** Verificação de expiração de convites

### 21. backend/src/modules/social/social-group.repository.ts:32

**Trecho:**
`thirtyDaysAgo`
**Justificativa:** Janela temporal para filtro histórico

### 22. backend/src/modules/inbox/social-inbox.repository.ts:208-219

**Trecho:**
Atualização de `lastUpdated`
**Justificativa:** Controle temporal de atualização

### 23. backend/src/core/events/specs/event-spec.service.ts:155

**Trecho:**
`new Date().getFullYear()`
**Justificativa:** Cálculo de ano corrente

### 24. backend/src/core/auth/auth.service.ts:338

**Trecho:**
Conversão de birthdate para Date antes de persistir
**Justificativa:** Normalização de dado de entrada

---

## TOTAL DE OCORRÊNCIAS

**34 usos classificados como TEMPO COMO REGRA**

---

## CONCLUSÃO

Todas as ocorrências listadas neste documento:

* representam **regra de negócio**
* usam `Date` de forma legítima
* **não configuram bug**
* **não devem ser convertidas para string**

Qualquer alteração aqui exige **decisão explícita de negócio**, não correção técnica.

---

**FIM DO DOCUMENTO**
