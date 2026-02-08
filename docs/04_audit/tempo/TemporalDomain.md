# MAPA TEMPORAL ARQUITETURAL — TEMPO COMO DADO (TemporalDomain)

## Classificação: Uso de tempo como dado persistido, contrato, entidade ou DTO

Este documento lista todas as ocorrências onde **data/hora faz parte do DADO do sistema**,
ou seja, campos que representam estados, registros, históricos ou metadados.

Aqui **não se avalia certo ou errado**.
O objetivo é **mapear como o tempo é representado** (string vs Date) e **em que camada**.

---

### 1. backend/src/core/events/event.service.ts:630

**Campo:** `declaredAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de declaração de evento armazenado como string ISO

### 2. backend/src/core/events/operational-commitments.service.ts:202

**Campo:** `observedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de observação criado via `new Date().toISOString()`

### 3. backend/src/core/events/operational-commitments.service.ts:249

**Campo:** `observedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de observação persistido como string ISO

### 4. backend/src/core/events/specs/event-spec.service.ts:437

**Campo:** `updatedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de atualização de especificação de evento

### 5. backend/src/core/events/specs/event-spec.service.ts:501

**Campo:** `closedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de fechamento de especificação de evento

### 6. backend/src/core/profile/profile.service.ts:281

**Campo:** `personal_data_lockedAt`
**Tipo observado:** string (ISO)
**Camada:** service (metadata)
**Contexto:** Timestamp de bloqueio de dados pessoais

### 7. backend/src/core/profile/profile.service.ts:329

**Campo:** `onboarding_completedAt`
**Tipo observado:** string (ISO)
**Camada:** service (metadata)
**Contexto:** Timestamp de conclusão de onboarding

### 8. backend/src/core/profile/profile.service.ts:489

**Campo:** `onboarding_completedAt`
**Tipo observado:** string (ISO)
**Camada:** service (metadata)
**Contexto:** Timestamp de conclusão de onboarding

### 9. backend/src/modules/profile/commitments.routes.ts:215

**Campo:** `updatedAt`
**Tipo observado:** string (ISO)
**Camada:** route
**Contexto:** Timestamp retornado em resposta HTTP

### 10. backend/src/modules/social/reputation.service.ts:222-223

**Campos:** `createdAt`, `updatedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamps de criação e atualização de reputação

### 11. backend/src/modules/social/impact.service.ts:185

**Campo:** `updatedAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de atualização de impacto social

### 12. backend/src/modules/work/assignments/assignment.service.ts:366

**Campo:** `timestamp`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de evento de atribuição

### 13. backend/src/modules/services/service-booking-decision.repository.ts:123

**Campo:** parâmetro de query
**Tipo observado:** Date
**Camada:** repository
**Contexto:** Date passado diretamente como parâmetro SQL

### 14. backend/src/modules/services/service-payment-request.repository.ts:171

**Campo:** parâmetro de query
**Tipo observado:** Date
**Camada:** repository
**Contexto:** Date passado diretamente como parâmetro SQL

### 15. backend/src/modules/services/service-payment-execution.repository.ts:164

**Campo:** parâmetro de query
**Tipo observado:** Date
**Camada:** repository
**Contexto:** Date passado diretamente como parâmetro SQL

### 16. backend/src/modules/social/social-2.0.routes.ts:788

**Campo:** `confirmedAt`
**Tipo observado:** string (ISO)
**Camada:** route
**Contexto:** Timestamp de confirmação retornado em resposta HTTP

### 17. backend/src/core/events/event-economy.service.ts:505

**Campo:** `checkoutAt`
**Tipo observado:** string (ISO)
**Camada:** service
**Contexto:** Timestamp de checkout em evento econômico

---

## TOTAL DE OCORRÊNCIAS

**17 usos classificados como TEMPO COMO DADO**

---

## OBSERVAÇÕES GERAIS

* Predomínio de **string ISO** como representação de tempo em contratos
* Alguns usos de **Date** restritos a parâmetros de banco (repositories)
* Metadados frequentemente usam string ISO
* Não há padronização explícita documentada entre Date vs string (decisão futura)

---

## CONCLUSÃO

As ocorrências listadas:

* representam **dados temporais do sistema**
* não são erros por si só
* exigem **decisão arquitetural consciente** para padronização futura

Este documento **não autoriza correções automáticas**.

---

**FIM DO DOCUMENTO**
