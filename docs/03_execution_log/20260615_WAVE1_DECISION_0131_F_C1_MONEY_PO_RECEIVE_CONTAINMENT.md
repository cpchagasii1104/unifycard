# 2026-06-15 — ONDA DECISION-0131 · F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT

Trocar a contenção ACIDENTAL de `receivePO` por contenção EXPLÍCITA, fail-closed e testada. Parent `9edfbdf9` ·
branch `rescue-structural` · dev **386/386** (sem migration). **Decisão Clayton: purchase_order NÃO é creator-owned;
`created_by_actor_id` = autoria histórica, NUNCA autoridade; destino canônico = company-owned (frente futura).**

## READ-FIRST (1ª mão)

`purchaseOrderService.receivePO` acionava o efeito material de recebimento: `updateItemQuantityReceived` →
`inventoryService.addMovement` (movimento IN usando `order.createdByActorId` como actor — o vetor de autoridade
proibido) → `markAsReceived`/`markAsCompleted` → `accountsPayableService.createFromPurchaseOrder`. A rota
`POST /purchase-orders/:id/receive` exigia `actionContext.actingUserId` e chamava o service. **Schema vivo:**
`purchase_orders` tem `tenant_id`/`created_by_actor_id` mas **NÃO** `company_id`/`company_actor_id`/`owner_actor_id`/
`received_by_actor_id` → owner material provado hoje = só `tenant_id`. Company-owned exige schema/backfill (frente futura).

## Correção (runtime cirúrgico)

- **`purchase-order.service.ts`:** `receivePO` reduzido a **hard-stop fail-closed** na PRIMEIRA linha —
  `throw new AppError(403, 'PURCHASE_ORDER_RECEIVE_CONTAINED: …', 'PURCHASE_ORDER_RECEIVE_CONTAINED')` — ANTES de
  qualquer leitura/mutação, sem depender de `actionContext.actingUserId`/`actorId` nem de `created_by_actor_id`. Toda a
  implementação material foi **movida** para `receivePOContainedImpl` (privado, **NÃO chamado**) — as mutações ficam
  fisicamente separadas e inalcançáveis. _(A separação em método também preserva o type-narrowing strict: um `throw` no
  topo tornaria o corpo seguinte unreachable e quebraria o null-narrowing — strict subiria 43→72; com o método separado,
  strict volta a 43.)_
- **`purchase-order.routes.ts`:** `POST /:id/receive` reduzido a **403 PURCHASE_ORDER_RECEIVE_CONTAINED** explícito (não
  lê `actingUserId`, não chama `purchaseOrderService.receivePO`). Contenção primária = service; rota = contenção explícita.
- **NÃO tocado:** `receivePOContainedImpl` (preservado, contido) · inventory movement/authority · accounts payable ·
  Bank/Core/ledger/split · settlement · migration/owner-schema · `received_by_actor_id`/`company_id`.

## Provas

- **Guard** `audit-po-receive-containment.mjs` (no chain): receivePO = hard-stop sem mutação (sem addMovement/
  updateItemQuantityReceived/markAsReceived/markAsCompleted/createFromPurchaseOrder) · `receivePOContainedImpl` sem
  caller · rota 403 sem chamar o service. GATE OK.
- **Negative-proof** `negative-proof-po-receive-containment.ps1`: **5 mordidas** byte-idêntico — sem-hard-stop ·
  mutação-em-receivePO · impl-com-caller · rota-sem-403 · rota-chama-service.
- **E2E** `validate-pipeline-e2e-po-receive-containment.ts` (DB efêmera): **9/9** — T1 rota 403 CONTAINED · T2 service
  lança CONTAINED (403) · **T2b orderId inexistente → CONTAINED, não "Ordem não encontrada"** (prova que o hard-stop
  precede `getPurchaseOrderById`) · T3/T4 spoof actingUserId/actorId não destrava · T5 PO segue SUBMITTED · T6 zero
  inventory_movements · T7 accounts_payable não religado · T8 Bank/ledger/split intocados.

| Prova | Resultado |
| --- | --- |
| audit-po-receive-containment guard | GATE OK |
| negative-proof | 5 mordidas; byte-idêntico |
| e2e (efêmero) | **9/9** |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (+1 guard) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (0 atribuível) |

## DT

- **DT-PO-RECEIVE-COMPANY-OWNER-PENDING** (OPEN): recebimento contido fail-closed; reabilitação só com owner empresarial
  material (company-owned) em `purchase_orders` (frente futura de schema/backfill), derivando a autoridade do company-actor
  (canRepresentActor), NUNCA de `created_by_actor_id`.

## NÃO FECHADO

purchase_order ownership definitivo · company-owned schema · receivePO funcional · inventory authority · accounts
payable · Bank/Core · C1_MONEY inteiro · rotas PO restantes (create/submit/cancel — fora de escopo). Zero migration.

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT**: o recebimento de
purchase_order passou de contido-por-acidente a **contido por hard-stop EXPLÍCITO** no service (mutações separadas e não
chamadas) + rota 403; nada move estoque/status/payable/Bank; `created_by_actor_id` não autoriza. company-owned segue como
destino futuro. dev 386.
