# 2026-06-15 — ONDA DECISION-0131 · F-C1-MONEY-SPR-CREATE-AUTHORITY-HARDENING

Segunda cirurgia de RUNTIME do C1_MONEY: a CRIAÇÃO de service-payment-request. **Decisão de produto Clayton promulgada:
Opção A — o RECEIVER/PROVIDER emite a cobrança; o payer paga.** Parent `81e35ad8` · branch `rescue-structural` · dev
**385/385** (sem migration). READ-FIRST: workflow read-only (frente anterior) + leitura 1ª mão + grep de callers.

## READ-FIRST (1ª mão) — o achado que define a arquitetura

`servicePaymentRequestService.createPaymentRequest` tem **3 callers**: `service-payment-request.routes.ts:56` (o POST
create alvo), `service-hire.routes.ts:88` (fluxo hire) e `event-rfq.service.ts:611` (fluxo RFQ). Logo a autoridade
**NÃO pode ir no service** (afetaria hire/RFQ, fora de escopo) → o gate vai no **ROUTE handler do POST create apenas**.
Owner resolvível server-side: `receiver = services.actor_id` (dono/provider), `payer = booking.requesterActorId`
(validados na criação pelo próprio service). `BookingDecisionStatus.ACCEPTED='accepted'`.

## Correção (runtime cirúrgico — SÓ o POST create)

`POST /:serviceId/bookings/:bookingId/payments`:
1. `req.user.userId` (401 sem).
2. Resolve `service` (`servicesRepository.findById`, 404 sem) → `receiverActorId = service.actorId`.
3. Resolve `booking` (`unifiedAvailabilityService.getBooking`, 404 sem) → `payerActorId = booking.requesterActorId`.
4. **`canRepresentActor(req.user.userId, receiverActorId)` → 403 fail-closed** (Opção A: emissor representa o receiver).
5. `createPaymentRequest` com payer/receiver **DERIVADOS** (body ignorado). O service re-valida (defesa em profundidade:
   booking pertence ao service, payer=requester, receiver=service.actor_id, **booking_decision accepted**).
- Schema: `payerActorId`/`receiverActorId` tornados OPCIONAIS (NÃO-autoritativos; derivados server-side).
- **NÃO tocado:** POST execute · firewall DECISION-0110 · Bank/Core/ledger/split/payout/settlement/reversal ·
  migration/FK/RLS · purchase-order · AP/AR · payer-initiated payment · service createPaymentRequest (compartilhado) ·
  os 2 GET já selados.

## Provas

- **Guard** `audit-spr-read-authority.mjs` (estendido p/ POST create): canRepresentActor + receiver de `service.actorId`
  + payer de `booking.requesterActorId` + 403 + **proíbe `parsed.data.{payer,receiver}ActorId` como autoridade**. GATE OK.
- **Negative-proof** `negative-proof-spr-read-authority.ps1`: **5 mordidas** byte-idêntico — read×3 (spr/exec sem
  canRepresentActor; sem 403) + create-sem-receiver-derivado + create-body-authority.
- **E2E** `validate-pipeline-e2e-spr-create-authority.ts` (DB efêmera, zero dinheiro): **10/10** — T1 receiver cria 201
  c/ payer=Alice receiver=Bob (derivados) · T2 payer não cria 403 · T3 terceiro 403 · T4 spoof actionContext 403 ·
  T5 spoof body.payer → ignorado (PR.payer=Alice) · T6 spoof body.receiver → ignorado (PR.receiver=Bob) · T7 booking de
  outro service 400 · T8 booking não-aceito 400 · T9 zero service_payment_executions · T10 Bank/ledger/split intocados.

| Prova | Resultado |
| --- | --- |
| audit-spr-read-authority guard (read+create) | GATE OK |
| negative-proof | 5 mordidas; byte-idêntico |
| e2e create (efêmero, zero dinheiro) | **10/10** |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (B1f stale_baseline=1; objeto baseline=31 intacto; B1f neg-proof passa) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (0 atribuível) |

## DT

- **DT-SPR-READ-AUTHORITY-RESIDUES R1 → ✅ RESOLVIDO** (POST create canal-1 materialmente vinculado: canRepresentActor
  sobre o receiver derivado). R2 (POST execute firewall) e R3 (FK/índice/RLS ausentes) seguem OPEN.

## Interação com B1f (file-level)

A frente READ já havia adicionado canRepresentActor ao arquivo → o guard B1f file-level clareia o arquivo
(stale_baseline=1). Agora o POST create está **materialmente** vinculado, então o mascaramento file-level deixou de ser
relevante para este arquivo. **Baseline B1f intacto = 31 entradas** (objeto não tocado; B1f neg-proof segue passando);
as outras 30 rotas canal-1 NÃO foram tocadas.

## NÃO FECHADO

C1_MONEY inteiro · service-payment-execution (money path) · payment firewall · Bank/Core · purchase-order · AP/AR ·
settlement · **payer-initiated payment** (fluxo futuro separado) · 31 rotas canal-1 (30 restantes). Nenhuma migration/FK/RLS.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-C1-MONEY-SPR-CREATE-AUTHORITY-HARDENING**: a criação de
service-payment-request passou a exigir representar o RECEIVER/PROVIDER (Opção A), com payer/receiver derivados
server-side; body/actionContext não autorizam; zero dinheiro/Bank/migration. dev 385.
