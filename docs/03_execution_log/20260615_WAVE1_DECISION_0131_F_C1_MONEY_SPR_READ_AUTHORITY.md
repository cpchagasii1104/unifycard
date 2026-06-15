# 2026-06-15 — ONDA DECISION-0131 · F-C1-MONEY-SPR-READ-AUTHORITY-HARDENING

Primeira cirurgia de RUNTIME do subconjunto C1_MONEY: tapar o leak vivo e money-adjacent de LEITURA de
service-payment-request. Parent `3e7fcda8` · branch `rescue-structural` · dev **385/385** (sem migration).
READ-FIRST: workflow read-only (registration/callers/execution-shape/e2e-seed) + DB schema + leitura 1ª mão.

## READ-FIRST (1ª mão)

- **Leak:** `GET /:serviceId/bookings/:bookingId/payments` (service-payment-request.routes.ts:86) só checava
  `actionContext.actorId` EXISTE → **sem ownership**: qualquer user autenticado do tenant lê o payment request de qualquer
  booking. Idem `GET /payments/:paymentRequestId/execution` (service-payment-execution.routes.ts:83): `req.user.userId`
  + tenant, **sem ownership** (o firewall DECISION-0110 só protege o POST execute, não o GET).
- **Owner resolvível no próprio recurso:** `service_payment_requests.payer_actor_id`/`receiver_actor_id` (uuid NOT NULL),
  validados na criação (payer=`booking.requesterActorId`, receiver=`services.actor_id`). Logo o GET resolve owner sem
  query extra (o PR carrega payer/receiver).
- **Registro:** servicesModule sob protectedScope (auth+tenant+actionContext) prefix `/services`; `req.user.userId`
  populado. Callers: cada método de leitura tem só seu handler → binding route-level viável.
- **Execution GET:** mesma cadeia — resolve o PR (`getPaymentRequest`) p/ obter payer/receiver; quando há execução,
  `result.execution` também carrega payer/receiver, mas pré-execução é null → resolver o PR é o caminho correto.

## Correção (runtime cirúrgico — 2 GET)

- **`service-payment-request.routes.ts` (GET):** `req.user.userId` (401 sem) → `getPaymentRequestByBooking` (404 sem) →
  `canRepresentActor(tenant, userId, payerActorId) || canRepresentActor(..., receiverActorId)` → **403** se nenhum.
- **`service-payment-execution.routes.ts` (GET /execution):** resolve `getPaymentRequest` (404 sem) →
  `canRepresentActor` payer OU receiver → **403** → só então `getExecutionByPaymentRequest`. +import
  servicePaymentRequestService + authorizationService.
- **NÃO tocado:** POST create · POST execute · firewall DECISION-0110 · Bank/Core/ledger/split/payout/settlement/reversal
  · migration/FK/índice/RLS · purchase-order · AP/AR · service de execução (money path).

## Provas

- **Guard** `audit-spr-read-authority.mjs` (novo, no chain): os 2 GET devem ter `canRepresentActor` + `payerActorId`/
  `receiverActorId` + `.status(403)`. GATE OK.
- **Negative-proof** `negative-proof-spr-read-authority.ps1`: **3 mordidas** byte-idêntico — SPR sem canRepresentActor ·
  execution sem canRepresentActor · SPR sem 403.
- **E2E** `validate-pipeline-e2e-spr-read-authority.ts` (DB efêmera, zero dinheiro): **9/9** — T1 payer 200 · T2 receiver
  200 · T3/T5 terceiro do mesmo tenant 403 (tenant_id não basta) · T4 spoof actionContext.actorId 403 · T8 execution
  payer passa o binding (≠403; 404 sem execução) · T9 execution terceiro 403 · T10 execution spoof 403 · T6 zero
  service_payment_executions · T7 Bank/ledger/split intocados.

| Prova | Resultado |
| --- | --- |
| audit-spr-read-authority guard | GATE OK |
| negative-proof | 3 mordidas; byte-idêntico |
| e2e (efêmero, zero dinheiro) | **9/9** |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (B1f stale_baseline=1; objeto baseline=31 intacto; B1f neg-proof passa) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (0 atribuível aos arquivos tocados) |

## DT (DT-SPR-READ-AUTHORITY-RESIDUES)

R1 POST create canal-1 + **decisão de produto Clayton** (quem cria cobrança: payer/receiver/ambos); efeito file-level do
guard B1f mascara o canal-1 do POST (registrado). R2 POST execute firewall (intacto). R3 FK/índice/RLS ausentes em
service_payment_requests (não bloqueia; sem migration nesta frente).

## NÃO FECHADO

C1_MONEY inteiro · SPR create · service-payment-execution (money path) · payment firewall · purchase-order · AP/AR ·
settlement regional · Bank/Core · 31 rotas canal-1. Nenhuma migration/FK/RLS criada.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-C1-MONEY-SPR-READ-AUTHORITY-HARDENING**: a LEITURA de
service-payment-request (2 GET money-adjacent) passou a exigir representar payer OU receiver server-side (DECISION-0113),
403 fail-closed; zero dinheiro/Bank/migration. dev 385.
