# 2026-06-15 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 6 (PDV-F2A — PAYMENT AUTHORITY BINDING)

Pós-PASS Yala do PDV-F0-LOCK (commit `ef4ea717`). **PDV-F2A** — escopo ESTREITO: corrigir SÓ a rota money
`POST /pdv/orders/:orderId/pay`. As outras 9 rotas PDV seguem DIVERGENT (lock). Parent `ef4ea717` · branch
`rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST (1ª mão) — respondendo as perguntas obrigatórias

1. **order → session:** o `orders` **NÃO tem `session_id`** (cols: buyer_actor_id, seller_actor_id, total_cents,
   status, …). order e session são ligados só por convenção (input client-declared `orderId` + `sessionId`). **Não há
   FK order→session.**
2. **session → actor:** `pdv_sessions` = (tenant_id, actor_id→actors, status, …); `actor_id` = operador. **Sem company.**
3. **Actor autorizado:** o **SELLER da ordem** (`orders.seller_actor_id`) — o dono/recebedor do dinheiro, resolvível
   server-side via `orderService.getOrderById` (retorna `sellerActorId`).
4. **Pagamento deveria exigir:** representar o **seller** da ordem (o operador representa o seller/loja via empresa).
   Suficiente e canônico; o session_id não adiciona autoridade (sem FK).
5. **Risco (Q5):** SIM — order e session client-declared, e `payOrderFromPdv` usa `input.sellerActorId`/`buyerActorId`
   (do body) p/ a execução. **Mitigado:** o gate resolve o seller da ORDEM (server-side) e exige representá-lo + checa
   que `input.seller/buyer` casam com a ordem (sem redirecionar dinheiro pelo body).
6. **Side-effect começa:** `payOrderFromPdv` passo 4 (`createPaymentIntent`) — antes disso, só leituras.
7. **Ponto do gate:** ANTES de `pdvService.payOrderFromPdv(...)` no handler da rota.

**Por que o primitivo é canônico:** `canRepresentActor(req.tenant.id, req.user.id, order.sellerActorId)` —
`req.user` (server-side, protectedScope) DEVE representar o vendedor da ordem (resolvido server-side de `orderId`,
nunca do body). A decisão **NÃO depende** de role/capability/`actionContext.actorId` cru.

## Correção (menor correção segura; runtime alterado SÓ na rota pay)

- **`src/modules/pdv/pdv.routes.ts` (POST /orders/:orderId/pay):** ANTES de `payOrderFromPdv`:
  `orderService.getOrderById(tenantId, orderId)` (404 se ausente) → `canRepresentActor(tenantId, req.user.id,
  order.sellerActorId)` (403 se não representa) → consistência `input.seller/buyerActorId === order.seller/buyerActorId`
  (403 se divergir; sem redirecionar dinheiro pelo body). +imports `orderService` + `authorizationService`. O
  `requirePermission('marketplace_execute_payments')` (preHandler) **fica como camada adicional** (AND, não autoridade
  única). `actionContext.actorId` vira audit, não autoridade.
- **NÃO tocado:** as outras 9 rotas PDV · `payOrderFromPdv`/`paymentExecutionService` · Bank/Core/ledger/seed/migration.

## Classificação (antes → depois)

`POST /orders/:orderId/pay`: **DIVERGENT-MONEY → CANONICAL** (a decisão NÃO depende de role/canal-1; `canRepresentActor`
sobre o seller da ordem é obrigatório). `requirePermission` = camada AND adicional (não fallback/OR), então não rebaixa
para ADAPTER. As **outras 9 rotas seguem DIVERGENT** (canal-1 sem binding; lock).

## Provas (tripé)

- **Guard** `audit-pdv-authority-lock.mjs` (atualizado): pay = CANONICAL exige `canRepresentActor` + `getOrderById` +
  gate ANTES de `payOrderFromPdv`; FALHA se pay perder binding / order não resolvido server-side / side-effect antes do
  gate / nova rota não classificada / bank_ledger direto. Reporta **9 DIVERGENT + 1 CANONICAL**.
- **Negative-proof** `negative-proof-pdv-authority-lock.ps1` (atualizado): (a) sem canRepresentActor · (b) sem
  getOrderById · (c) payOrderFromPdv antes do gate · (d) rota nova · (e) bank_ledger direto → **5 mordidas**;
  restauração **byte-idêntica**.
- **E2E** `validate-pipeline-e2e-pdv-payment-authority.ts` (DB efêmera, social ports, **zero dinheiro**): **5/5** —
  T1 operadora que representa o seller → passa o gate (≠403; falha downstream por falta de sessão = DEPOIS do gate) ·
  T2 não representa o seller → **403** ("represent the order seller") ANTES de payOrderFromPdv · T3 spoof
  `actionContext.actorId` (actor de outro user) → **403** · T4 Bank intocado · T5 guard verde.
  _(O E2E semeia `actor_registry` com `can_hold_assets` p/ o operador passar pelo `requirePermission` (ownership) — assim
  o diferencial provado é o GATE, não a capability.)_

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **5/5** |
| negative-proof | 5 mordidas; byte-idêntico |
| pdv-authority-lock guard | GATE OK (9 DIVERGENT + 1 CANONICAL pay) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0) |
| arch --strict | `critical_new=0` |
| tsc | build **25** (zero atribuível) · strict **43** (baseline herdado) |

## PROVAS (cenários do GO)

owner (representa o seller) passa ✔ (T1) · actor errado falha 403 ✔ (T2) · role/capability sem ownership falha ✔ (T2: a
operadora tem capability via actor_registry mas NÃO representa o seller Bob → 403) · spoof falha ✔ (T3) · Bank/ledger
intocado nos negados ✔ (T4).

## NÃO TOCADOS

Bank · Core financeiro · financial_approval_* · RLS · mapper · cargo · delegação · platform · cartão · social-work ·
C4/B3f/A1/E1/E2/B1f · `payOrderFromPdv`/`paymentExecutionService` · as 9 outras rotas PDV · stub actor_has_permission
(RETURN FALSE) · RBAC (não ativado). dev 385/385.

## RISCOS REMANESCENTES

- **9 rotas PDV restantes (DIVERGENT)**: sessions/orders/items — binding por representabilidade do operador/seller =
  sub-frentes (PDV-F2B…). Readers (sessions) leakáveis por spoof de actorId.
- **Modelo operador/empresa:** o gate usa o seller da ordem (recebedor). Se Clayton quiser modelar o OPERADOR (sessão)
  como autoridade adicional (ex.: operador deve estar na empresa do seller), é decisão de produto (frente própria).
- **Resíduo service:** `payOrderFromPdv` ainda usa `input.sellerActorId/buyerActorId` (body) na execução; o gate da
  rota agora exige que casem com a ordem, mas o hardening service-level (usar sempre o seller da ordem) é evolução.
- **Migration?** NÃO (orders.seller_actor_id já resolve). **Decisão Clayton?** só se quiser o modelo operador/empresa.

## Estado

WAVE-1 BATCH-6 (PDV-F2A) **IMPLEMENTED / HOLD PARA RESEAL**. `POST /orders/:orderId/pay` deixou de depender de
role/capability/canal-1: autoridade canônica por `canRepresentActor` sobre o seller da ordem, ANTES do side-effect;
spoof/role-only/actor-errado → 403 fail-closed; Bank intocado. As 9 rotas PDV restantes seguem DIVERGENT (lock). dev 385;
baseline 0113=0; Core/Bank intocados.
