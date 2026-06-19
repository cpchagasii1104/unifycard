# 2026-06-19 — R8I MONEY-STALE RECONCILE WAVE — event-rfq + purchase-order + service-payment-request (cirúrgico)

> **SEAL DOCS-ONLY (2026-06-19, sobre commit material `3c87bad5`):** reseal Yala material READ-ONLY =
> **PASS_WITH_WARNINGS** → frente **CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (reconciliou 3,
> restam 7; **NÃO** fecha a DT-mãe 0113 nem o parent canal-1). **Estados por item (todos RECONCILE, NÃO
> containment novo):** **event-rfq[stale/W6]** → **CLOSED / RECONCILED / YALA PASS_WITH_WARNINGS MATERIAL** ·
> **purchase-order[stale]** → **CLOSED / RECONCILED / YALA PASS_WITH_WARNINGS MATERIAL** ·
> **service-payment-request[stale]** → **CLOSED / RECONCILED / YALA PASS_WITH_WARNINGS MATERIAL**. **Yala confirmou
> materialmente:** HEAD 3c87bad5 · branch rescue-structural · migrations 394/394 · diff de **apenas 4 arquivos**;
> **zero `.ts` runtime**; zero E2E/guard/negative-proof novo; sem migration; R8I = reconcile PURO de baseline +
> cartório (commit removeu 3 entradas stale money do BASELINE); zero Bank/Core/bank_ledger/bank_transactions/
> bank_splits/payout/recovery/AP/AR/organizers/store-onboarding/services-discovery/unifycard-method/
> business-authorization/automation/human-mvp alterado; zero runtime financeiro reativado; zero decisão de produto/
> risco. **Base material por item:** event-rfq — W1-W5 bound (canRepresentActor), W6 acceptQuote hard-stop **403
> EVENT_RFQ_ACCEPT_QUOTE_CONTAINED** antes de availability/booking/decision/payment_request (sink inalcançável;
> zero write em service_payment_requests/bank_*); purchase-order — writes vivos owner-bound (canRepresentActor),
> /receive hard-stop **403 PURCHASE_ORDER_RECEIVE_CONTAINED** (receivePOContainedImpl inalcançável; zero write em
> accounts_payable/bank_*); service-payment-request — Opção A (receiver/payer server-side, body NÃO governa
> autoridade, canRepresentActor(receiver) antes do sink, amount_cents BIGINT, idempotência ON CONFLICT(booking_id),
> firewall SERVICE_FINANCIAL_RUNTIME_ENABLED preservado; zero write em bank_*). **Guards (6 pré-existentes wired e
> GREEN):** audit-event-rfq-actor-binding · audit-event-rfq-acceptquote-containment · audit-po-owner-authority ·
> audit-po-receive-containment · audit-spr-read-authority · audit-service-payment-amount-cents
> (`validate:regression-guards` = **63 GATE OK / 0 FAIL**). **Baseline:** antes baseline 10 / stale 3 → depois
> **baseline 7 · flagged 7 · new 0 · stale_baseline 0 · safe_subject 6 · service_bound 4 · self_bound 1 ·
> not_authority 1**. **DT-mãe 0113 e parent canal-1 seguem OPEN.**
>
> **Warnings do reseal (não-bloqueante):** **W1** — negative-proofs pré-existentes não reexecutados pela Yala
> (mutam source); Yala validou estruturalmente (prova viva deste commit = 6 guards GREEN + new=0); reexecução
> pwsh 7/WPS 5.1 declarada pela executora. **W2** — working tree sujo fora do material (docs/memorias/untracked) →
> não é HOLD_WORKTREE_DIRTY. Seal = docs-only; HEAD material permanece `3c87bad5`. _(Detalhe IMPLEMENTED abaixo.)_

Reconciliação de baseline canal-1 dos **3 itens money-stale** já materialmente bound/contained por frentes
anteriores (R7a/R7b · PO · SPR), DECISION-0113 / DECISION-0131 §B7 / Z2. **NÃO implementa financeiro, NÃO religa
pagamento, NÃO toca Bank/Core/ledger/transactions/splits.** É baseline hygiene com prova material + guards +
negative-proofs já existentes.

## Anchor / Pré-flight

HEAD inicial `ec693377` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer-boundaries OK ·
bank-ledger-boundaries OK · regression-guards OK · working tree material limpo. R8H CLOSED_AS_CONTAINED; parent
canal-1 OPEN baseline 10; DT-mãe 0113 OPEN.

## READ-FIRST — prova material (bate com IA-DINHEIRO)

Os 3 itens estavam em `stale_baseline` (detector NÃO os flagga — binding helper presente / canal contido) e cada
um tem guard(s) dedicado(s) **wired+GREEN** em `validate:regression-guards` + negative-proof versionado. **Zero
`bank_ledger`/`bank_transactions`/`bank_splits` em qualquer um dos 3 arquivos** (rg=0 → STOP_CORE_MONEY_PATH_FOUND
não acionado).

| item | classe | binding/containment | guards wired+GREEN | negative-proof (bite confirmado HEAD) |
|---|---|---|---|---|
| **event-rfq** | M1+M3 | W1-W5 BOUND (R7a); W6 acceptQuote CONTIDO 403 `EVENT_RFQ_ACCEPT_QUOTE_CONTAINED` (R7b) antes de availability/booking/decision/payment_request | audit-event-rfq-actor-binding · audit-event-rfq-acceptquote-containment | negative-proof-event-rfq-acceptquote-containment (morde se W6 reativar) ✅ |
| **purchase-order** | M1+M3 | writes exigem representar owner empresarial (canRepresentActor; created_by/supplier/tenant NÃO autorizam); /receive CONTIDO 403 (receivePOContainedImpl preservado/inalcançável) | audit-po-owner-authority · audit-po-receive-containment | negative-proof-po-receive-containment (morde se /receive reativar) ✅ |
| **service-payment-request** | M1 | Opção A: receiver derivado server-side (service.actor_id), payer/receiver server-side, body ignorado, canRepresentActor(receiver) antes do sink, amount_cents BIGINT, idempotência ON CONFLICT(booking_id), firewall SERVICE_FINANCIAL_RUNTIME_ENABLED nos callers vivos | audit-spr-read-authority · audit-service-payment-amount-cents | negative-proof-spr-read-authority (morde se body governar payer/receiver) ✅ |

Os 3 key negative-proofs foram **reexecutados no HEAD atual** (pwsh 7): cada um FALHA o guard sob mutação e
restaura byte-idêntico (git status inalterado) → proteção viva.

## Decisão: RECONCILE (M1_STALE_RECONCILE / M3_CONTAINED_CONFIRMED)

Os 3 já estão materialmente bound/contained — só precisam **sair do baseline** com a prova (guards dedicados). NÃO
houve mudança de runtime: **nenhum arquivo `.ts` alterado**; apenas o mapa BASELINE do detector
`audit-actor-authority-boundary.mjs` (3 entradas → comentário de remoção com citação dos guards/negative-proofs).
Se a proteção sumir (W6/`receive` reativar, SPR body governar, binding perdido), o guard dedicado FALHA **E** o
arquivo re-flagga (fora do baseline → new>0 → detector FALHA). Não-mascaramento.

## Baseline canal-1 — antes/depois

**10 → 7** (flagged 7 · baseline 10→7 · **new=0** · **stale_baseline 3→0** · safe_subject 6 · service_bound 4 ·
self_bound 1 · not_authority 1). GATE OK. Os 7 restantes são exatamente os ainda-flagged (sem resíduo stale).

## Prova material — guards + negative-proofs (já existentes)

Nenhum guard/E2E/negative-proof NOVO foi criado — a cobertura material já existe das frentes R7a/R7b/PO/SPR e está
wired em `validate:regression-guards`. Verificado nesta onda: os 6 guards dedicados GREEN + 3 key negative-proofs
mordendo e restaurando byte-idêntico no HEAD atual. (E2Es runtime existentes: R7a `run-event-rfq-actor-binding-
ephemeral` 20/20; R7b `run-event-rfq-acceptquote-containment-ephemeral` 11/11; + PO/SPR e2es das respectivas
frentes.)

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (6 guards dedicados dos 3 itens
inclusos) · actor-authority-boundary **new=0** (baseline 10→7, stale 0) · arch `--strict` **critical_new=0**
(warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43** (nenhum `.ts` alterado).

## Escopo negativo

NÃO implementou financeiro · NÃO religou acceptQuote/PO-receive/pagamento · NÃO removeu firewall · NÃO tocou
Bank/Core/bank_ledger/bank_transactions/bank_splits/payout/recovery · NÃO criou payment/payable/receivable ·
NÃO criou migration/schema · NÃO decidiu produto/risco financeiro · NÃO alterou runtime (`.ts` intocados) · NÃO
fecha DT-mãe 0113 nem parent canal-1 (baseline 7>0). Redesign de acceptQuote e DECISION-0114 D5 seguem OPEN
(frentes próprias).

## Estado

**✅ CLOSED_WITH_REMAINDER / YALA PASS_WITH_WARNINGS MATERIAL** (seal docs-only 2026-06-19 sobre commit material
`3c87bad5`; reseal Yala material READ-ONLY = PASS_WITH_WARNINGS; warnings W1-W2 não-bloqueantes — ver bloco SEAL no
topo). event-rfq · purchase-order · service-payment-request → **CLOSED / RECONCILED / YALA PASS_WITH_WARNINGS
MATERIAL** (stale, guard-backed; removidos do baseline). **NÃO é containment novo, NÃO é implementação financeira,
acceptQuote NÃO foi redesenhado, DECISION-0114 D5 NÃO foi resolvida.** A DT-mãe
`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` e o parent `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE`
permanecem **OPEN** (baseline 7; redesign acceptQuote + DECISION-0114 D5 OPEN). _(Histórico: 🟡 IMPLEMENTED / HOLD
YALA antes do reseal.)_

## Fila restante para fechar 0113 (7 entradas)

- **MONEY → IA-DINHEIRO (4):** organizers, store-onboarding, services-discovery, unifycard-method.
- **READ-SENSITIVE / OWN FRONT (1):** business-authorization.
- **C_CONTAIN ghost própria / produto (2):** automation (9 rotas mistas; run-due já 403), human-mvp (vertical G10).
- _(Residual fora do baseline: CRM accounts_receivable read; DECISION-0114 D5; redesign acceptQuote.)_
