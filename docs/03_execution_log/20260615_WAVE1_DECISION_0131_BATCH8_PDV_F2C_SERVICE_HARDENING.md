# 2026-06-15 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 8 (PDV-F2C — SERVICE HARDENING + SUMMARY BUG)

Pós-PASS Yala do PDV-F2B (commit `fa72d8e7`). **PDV-F2C** = micro-batch final no PDV: tratar resíduos locais
(defesa própria do service de pagamento + bug de leitura do summary), **sem abrir frente grande, sem tocar Bank/Core**.
Parent `fa72d8e7` · branch `rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST P1 — `payOrderFromPdv` (service-level)

1. **Callers:** ÚNICO = `pdv.routes.ts:377` (a rota PDV `POST /orders/:orderId/pay`). grep no `src/` inteiro confirmou.
2. **Confirma só a rota chama:** sim.
3. **Assinatura/input:** `payOrderFromPdv(tenantId, input: PayOrderFromPdvInput)` — input traz `sessionId, orderId,
   amountCents, currency, buyerActorId, sellerActorId, idempotencyKey`.
4. **Uso de seller/buyer:** `createPaymentIntent({ actorId: input.buyerActorId, … })` (passo 4) e
   `executePayment({ buyerActorId: input.buyerActorId, sellerActorId: input.sellerActorId, … })` (passo 6).
5. **Resolve a ordem internamente?** SIM — o service já faz `orderService.getOrderById(tenantId, input.orderId)` (passo 2)
   e a ordem persistida tem `sellerActorId`/`buyerActorId`. Logo **dá para derivar sem acoplamento novo** (já usa orderService).
6. **Início do side-effect money:** `createPaymentIntent` (passo 4). Antes disso: só leituras (sessão + ordem) e o submit.

→ A rota (PDV-F2A) já valida seller/buyer vs ordem, mas o **service confiava no body**. Hardening local seguro.

## READ-FIRST P2 — `getSessionSummary` `pi.amount`

1. **Query quebrada confirmada:** `SELECT … pi.amount as payment_amount … LEFT JOIN payment_intents pi ON pi.order_id = o.id`.
2. **Schema vivo (`payment_intents`):** `amount_cents` (bigint), `order_id` (uuid) **EXISTE**, `payment_status` (text);
   `payment_transactions.status` (text) válido.
3. **Coluna correta:** `pi.amount` → **`pi.amount_cents`**. O resto da query (`pi.order_id`, `pt.status`) é válido.
4. **É bug de LEITURA** (rename de coluna) — não autoridade, não dinheiro.
5. **Correção local query-only** — sem migration, sem coluna nova. A MESMA query existe em `closeSessionWithSummary`
   (corrigida junto).

## Correção (runtime só em `src/modules/pdv/pdv.service.ts`)

- **`payOrderFromPdv`:** após buscar a ordem (passo 2) e ANTES do side-effect (passo 4):
  `if (input.sellerActorId !== order.sellerActorId || input.buyerActorId !== order.buyerActorId) throw 'must match the
  persisted order'` (FAIL-CLOSED) + `const sellerActorId = order.sellerActorId; const buyerActorId = order.buyerActorId`.
  `createPaymentIntent`/`executePayment` passam a usar os **valores derivados da ordem**, não o body.
- **`getSessionSummary` + `closeSessionWithSummary`:** `pi.amount as payment_amount` → `pi.amount_cents as payment_amount`.
- **NÃO tocado:** `paymentExecutionService`/Bank/Core/ledger/seed/migration · as rotas (já bound na F2B) · `createOrderFromPdv`
  (usa `input.*` p/ criar ordem NOVA — legítimo, gateado na rota pela representabilidade do operador).

## Provas (tripé)

- **Guard** `audit-pdv-authority-lock.mjs` (estendido, checks escopados ao corpo de `payOrderFromPdv`): FALHA se —
  validação seller/buyer vs ordem persistida ausente · side-effect (`createPaymentIntent`) antes da validação · chamadas
  money confiarem em `input.*ActorId` (body). + mantém as 10 rotas bound + proibição bank_ledger direto.
- **Negative-proof** `negative-proof-pdv-authority-lock.ps1`: **10 mordidas** —
  (a) stub-primitivo · (b) sem getOrderById · (c) side-effect antes do gate (rota) · (d) rota nova · (e) bank-touch ·
  (f) cobertura de binding · (g) autoria crua · **(h) service sem validação** · **(i) side-effect antes da validação** ·
  **(j) body-trust (input.*ActorId nas chamadas money)**. Restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-pdv-payment-authority.ts` (DB efêmera, zero dinheiro): **12/12** —
  T1/T2/T3 pay (F2A) · T6/T7 reader binding · T8 summary alheia→403 · **T9 summary própria→200** (pós `amount_cents`) ·
  **TS1** body seller/buyer divergente → fail-closed (`match the persisted order`) · **TS2** body casa → passa a validação
  (falha downstream SUBMITTED, sem money) · **TS3** zero `payment_intent` criado (side-effect nunca começou) · T10 guard verde.

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **12/12** |
| negative-proof | 10 mordidas; byte-idêntico |
| pdv-authority-lock guard | GATE OK (10 CANONICAL + defesa service) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (0113 baseline=0) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível a PDV-F2C) |
| tsc | build **25** · strict **43** (0 atribuível) |

## NÃO TOCADOS

Bank · Core financeiro · `paymentExecutionService` (não tocado) · `financial_approval_*` · RLS · mapper · cargo ·
delegação · platform · cartão · social-work · seed · migration · RBAC/FASE 6 · stub `actor_has_permission` (RETURN FALSE).
dev 385/385.

## RESÍDUOS

- **Modelo operador×empresa** (operador-na-empresa-do-seller como autoridade composta) = decisão de produto Clayton,
  frente própria — **NÃO declarado resolvido** (residue ABERTO de propósito).
- **`executePayment` ainda recebe `actingUserId: session.actorId`** (operador da sessão) — é autoria operacional, não
  money-party; as money-parties (buyer/seller) já vêm derivadas da ordem. Hardening adicional = evolução.

## Estado

WAVE-1 BATCH-8 (PDV-F2C) **IMPLEMENTED / HOLD PARA RESEAL**. O service `payOrderFromPdv` ganhou defesa própria
(deriva da ordem persistida + fail-closed antes do side-effect; não confia no body); o bug de leitura do summary
(`pi.amount`→`pi.amount_cents`) foi corrigido em ambas as queries. dev 385; baseline 0113=0; Bank/Core/paymentExecutionService
intocados. Modelo operador×empresa permanece em aberto (decisão Clayton).
