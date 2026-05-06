# MODO ASK — B.14 (escolha do próximo módulo médio)

**Data:** 2025-03-02  
**Protocolo:** `docs/01_normative/00_AGENT_PROTOCOL.md` lido e respeitado. Sem contracts, sem núcleo, sem any, sem cast inseguro.

---

## Baseline atual

**1413** (inalterado; nenhuma alteração de código neste ASK).

---

## Passos executados

1. `npx tsc --noEmit --pretty false` → saída em `backend/tsc.txt`
2. Filtro de candidatos (fora de core, marketplace, bank, orders, checkout, payments, payout, ledger) → `backend/tsc-candidates.txt` (516 linhas)
3. Agrupamento por primeiro nível em `src/modules/` (excluindo economy como finance)

---

## Top 10 módulos por contagem (fora do proibido)

| # | Módulo            | Contagem |
|---|-------------------|----------|
| 1 | services          | 42       |
| 2 | social            | 42       |
| 3 | events            | 39       |
| 4 | automation        | 29       |
| 5 | agreements        | 21       |
| 6 | loyalty           | 21       |
| 7 | rides             | 8        |
| 8 | votes             | 4        |
| 9 | risk-command-center | 4     |
| 10 | dispatch          | 3        |

*Economy (10) omitido da lista por ser domínio financeiro.*

---

## TOP 3 — Lista detalhada (até 80 linhas) + códigos dominantes + isolável

### 1. MODULE: services (42 erros)

| Arquivo | Linha | Código | Mensagem curta |
|---------|-------|--------|----------------|
| service-booking-decision.service.ts | 120 | TS2339 | Property 'serviceId' does not exist on 'UnifiedBooking' |
| service-booking-decision.service.ts | 142 | TS2339 | idem |
| service-bundle.service.ts | 143 | TS2345 | (Service \| null)[] not assignable to { serviceId, metadata }[] |
| service-bundle.service.ts | 164 | TS18047 | 's' possibly null |
| service-bundle.service.ts | 196 | TS1361 | BundleDependencyType import type used as value |
| service-bundle.service.ts | 534, 596 | TS2339 | Property 'findById' does not exist on EventRepository |
| service-bundle.service.ts | 649, 651 | TS2367 | CompatibilityStatus vs "BLOCKED"/"WARNING" no overlap |
| service-order.service.ts | 89 | TS2345 | Argument type (decisionId etc.) |
| service-order.service.ts | 349, 758 | TS2307 | Cannot find module '../escrow/escrow.service' |
| service-order.service.ts | 360 | TS7006 | Parameter 'm' implicitly any |
| service-order.service.ts | 543 | TS2322 | string \| null vs string \| undefined |
| service-order.service.ts | 631,633,710,732,823 | TS2339 | 'serviceId' does not exist on UnifiedBooking |
| service-order.service.ts | 754 | TS2367 | AgreementStatus vs "FINALIZED" |
| service-order.service.ts | 807 | TS2353 | 'bookingId' does not exist in type |
| service-order.service.ts | 870, 946 | TS2345 | string not assignable to BankCurrency |
| service-order.service.ts | 959 | TS2345 | authoritySource "delegation" vs FinancialAuthoritySource |
| service-order.service.ts | 1016, 1030 | TS2304 | Cannot find name 'evidencePackId' |
| service-order.service.ts | 1051 | TS2353 | 'grossAmount' does not exist |
| service-payment-execution.repository.ts | 28,46,140,162,196,215 | TS2339/TS2304 | 'amount' vs amountCents / Cannot find name 'amount' |
| service-payment-execution.service.ts | 106 | TS2339 | 'amount' does not exist on ServicePaymentRequest |
| service-payment-request.repository.ts | 28,227 | TS2339/TS2345 | amount / undefined not assignable |
| service-payment-request.routes.ts | 64 | TS2339 | 'amount' does not exist (amountCents) |
| services.repository.ts | 170, 335 | TS2345 | ServiceRow \| undefined not assignable to ServiceRow |

**Códigos dominantes:** TS2339 (property does not exist), TS2345 (argument type), TS2322, TS2353, TS2307 (module not found), TS2304 (name not found), TS2367 (comparison), TS18047 (possibly null).

**Isolável?** **Parcial.** Depende de módulo inexistente (`../escrow/escrow.service`), tipos em core/bank (BankCurrency, FinancialAuthoritySource, UnifiedBooking). Ajustes só em `services/**` podem não fechar sem tocar em escrow ou contratos.

---

### 2. MODULE: social (42 erros)

| Arquivo | Linha | Código | Mensagem curta |
|---------|-------|--------|----------------|
| adapters/social-repository.adapter.ts | 50,51 | TS2339 | 'total' does not exist (totalCents) |
| adapters/social-service.adapter.ts | 19 | TS2345 | CreatePostInput core vs modules type |
| adapters/social-service.adapter.ts | 26,27,29,30,34 | TS2322 | PostType/PostVisibility/string \| undefined vs null |
| reputation.service.ts | 48,81,264 | TS18047 | balance/existing/reputation possibly null |
| social-2.0.routes.ts | 123 | TS18048 | userLocation possibly undefined |
| social-2.0.routes.ts | 189,212,433,442 | TS2304 | Cannot find name actionContext/createdByUserId/userId |
| social-2.0.routes.ts | 1061-1063 | TS18047 | balance possibly null |
| social-group.repository.ts | 116,325 | TS2339 | 'total' vs totalCents |
| social-group.repository.ts | 264 | TS2339 | 'amount' vs amountCents |
| social-group.service.ts | 53,72,134,164 | TS2339/TS2353 | total vs totalCents / GroupFeedResult, ImpactFeedResult |
| social-marketplace-ref.routes.ts | 40 | TS2820 | "LOW" vs AuditSeverity "low" |
| social-votes.service.ts | 124 | TS18048 | actor possibly undefined |
| social-work-apply.routes.ts | 188 | TS2339 | total vs totalCents |
| social-work-payment.routes.ts | 8 | TS2307 | Cannot find module '@core/economy/transactions/transaction.service' |
| social-work-payment.routes.ts | 68,103,116 | TS2339 | amount vs amountCents |
| social-work-payment.service.ts | 13 | TS2307 | Cannot find module '../schedule/schedule.types' |
| social-work-payment.service.ts | 159,171 | TS2353/TS18004/TS2551 | amount vs amountCents, transaction vs transactionId |
| social-work-schedule.service.ts | 11 | TS2307 | Cannot find module '../schedule/schedule.types' |
| social.repository.ts | 216 | TS2339 | total vs totalCents |
| social.service.ts | 138,153 | TS2339/TS2353 | total vs totalCents, FeedResult |

**Códigos dominantes:** TS2339 (total/amount vs totalCents/amountCents), TS2322 (undefined vs null), TS18047/TS18048 (possibly null/undefined), TS2304 (name not in scope), TS2307 (module not found), TS2820 (AuditSeverity case), TS2345, TS2353.

**Isolável?** **Parcial.** Padrões total/totalCents e amount/amountCents são corrigíveis só em social. Porém há dependência de `@core/economy` e de `../schedule/schedule.types` (módulo ausente); variáveis não definidas (actionContext, userId, createdByUserId) exigem escopo de rotas. Isolável em sub-bloco se não tocar em economy (ex.: só totalCents/amountCents e guards).

---

### 3. MODULE: events (39 erros)

| Arquivo | Linha | Código | Mensagem curta |
|---------|-------|--------|----------------|
| checkin.service.ts | 199-202 | TS2820/TS2322 | "MEDIUM"→medium, null→undefined, "events"→AuditSource |
| event-rfq.routes.ts | 123 | TS2554 | Expected 4 arguments, got 5 |
| event.service.ts | 141-144 | TS2820/TS2322 | idem checkin |
| events-multi-actor.service.ts | 83 | TS18048/TS7053 | tenant possibly undefined, index type |
| events-multi-actor.service.ts | 139 | TS2322 | string \| undefined vs string |
| events-multi-actor.service.ts | 205,245 | TS18048/TS7053 | actorRows/requirementsRows possibly undefined, index |
| events-multi-actor.service.ts | 377 | TS2339 | 'total' vs totalCents |
| events-payment.service.ts | 44,52,65 | TS2339/TS2353 | amount vs amountCents |
| events-spec.routes.ts | 178 | TS2561 | event_id vs eventId |
| events.service.ts | 345,350 | TS18048 | input.endTime/startTime possibly undefined |
| events.service.ts | 387 | TS2345 | string \| undefined vs string |
| events.service.ts | 687 | TS2322 | joinedAt string vs Date |
| events.types.ts | 203 | TS2717 | group_id string \| null vs string \| undefined |
| occupancy.service.ts | 281 | TS2339 | total vs totalCents |
| organizers/organizer-billing.service.ts | 102,281 | TS2345 | undefined not assignable |
| organizers/organizer-billing.service.ts | 343,344 | TS2322 | string vs Date |
| organizers/organizers.service.ts | 189 | TS2345 | string \| undefined vs string |
| ticket.service.ts | 239 | TS2345 | Argument type CreateFromPaymentIntentInput |
| ticket.service.ts | 312,313 | TS2304 | Cannot find name saleMetadata |
| ticket.service.ts | 321 | TS2345 | null vs string \| undefined |
| ticket.service.ts | 400-403 | TS2820/TS2322 | "MEDIUM", null, "events" AuditSource |

**Códigos dominantes:** TS2820 (AuditSeverity case), TS2322 (null/undefined/Date/string), TS18048 (possibly undefined), TS2339 (total/amount vs totalCents/amountCents), TS2345, TS2353, TS2304, TS2554, TS2561, TS2717.

**Isolável?** **Sim.** Padrões repetidos (AuditSeverity, amount/amountCents, total/totalCents, possibly undefined, literais). Tudo dentro de `events/**`; sem módulos inexistentes. Variáveis em escopo (saleMetadata, argument count) são fixes locais.

---

## Resumo para decisão B.14

- **Baseline:** 1413 (confirmado).
- **Melhor alvo isolável (médio, 20–80 erros):** **automation (29)** ou **agreements (21)**.
  - **automation:** TS2820 (severity case), TS2322 (null/"system"), TS2367 (status literals); só arquivos em `automation/**`; sem dependências de módulo faltando.
  - **agreements:** TS18047 (req.tenant), TS2345 (runQuery signature), TS2367 (AgreementStatus literals); isolável em `agreements/**`.
- **services (42)** e **social (42)** têm dependências externas (escrow, economy, schedule) ou toque financeiro; melhor deixar para depois de fechar módulos mais fechados.
- **events (39)** é isolável e com padrões claros; bom candidato se quiser alvo um pouco maior que automation/agreements.

**Recomendação para B.14:** Escolher **automation** (29) ou **agreements** (21) como primeiro alvo; se preferir um módulo um pouco maior e igualmente isolável, **events** (39).

---

Nenhuma alteração de código foi feita neste ASK.
