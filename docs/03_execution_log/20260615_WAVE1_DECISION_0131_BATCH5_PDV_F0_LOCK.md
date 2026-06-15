# 2026-06-15 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 5 (PDV-F0-LOCK)

Pós-PASS Yala do BATCH 4 (commit `85cf27ae`). **PDV-F0-LOCK** — **READ-ONLY + LOCK GUARD + NEGATIVE-PROOF**.
**ZERO runtime change**: NÃO corrige handler, NÃO binda rota, NÃO toca Bank/Core/ledger, NÃO migration/seed.
Materialidade vence volume: PDV tem superfície money/money-adjacent com autoria por `actionContext.actorId` (canal-1),
não coberta pelo guard 0113. Parent `85cf27ae` · branch `rescue-structural` · dev **385/385** (sem migration).

## PARTE 1 — MATRIZ PDV (1ª mão; `src/modules/pdv/pdv.routes.ts`)

**Hook do módulo (L20-28):** só checa EXISTÊNCIA de `req.tenant.id` e `req.actionContext.actorId` — **NÃO binda**
(sem canRepresentActor/assertActorRepresentable). **`require-permission.guard`** resolve a capability do **actor
DECLARADO** (`actorRegistryService.findByActorId(actionContext.actorId)`) — **NÃO vincula** req.user→actor. **Schema:**
só existe `pdv_sessions` (`tenant_id`, `actor_id`→actors); orders/payments vão pelo **marketplace** (orderService /
paymentExecutionService). **bank_ledger:** PDV **NÃO toca direto** (grep vazio) — `payOrderFromPdv` → createPaymentIntent
→ paymentIntentService.authorizePaymentIntent → **paymentExecutionService.executePayment** (Core/marketplace).

| # | METHOD path | Efeito | Auth atual | Actor gravado | Owner real | Ownership resolvível | Classe | Materialidade |
|---|---|---|---|---|---|---|---|---|
| 1 | POST /sessions/open | WRITE (cria pdv_session) | requirePermission('marketplace_manage_orders') (actor declarado; sem binding) | session.actor_id = actionContext.actorId | operador (sessão) | SIM (`pdv_sessions.actor_id`→actors) | DIVERGENT | MONEY_ADJACENT |
| 2 | POST /sessions/:id/close | WRITE (fecha sessão) | requirePermission('marketplace_manage_orders') | closed_by=actionContext.actorId | operador | SIM (session.actor_id) | DIVERGENT | MONEY_ADJACENT |
| 3 | GET /sessions/open | READ (sessão aberta) | hook (existência) | filtro actionContext.actorId | operador | SIM | DIVERGENT (filtro canal-1 sem binding) | MONEY_ADJACENT |
| 4 | GET /sessions | READ (lista) | hook | filtro actionContext.actorId | operador | SIM | DIVERGENT (filtro canal-1 sem binding) | MONEY_ADJACENT |
| 5 | GET /sessions/:id/summary | READ (resumo financeiro) | hook (SEM filtro de owner) | — (id) | operador da sessão | SIM (session.actor_id) — NÃO checa | DIVERGENT (read sem ownership) | MONEY_ADJACENT |
| 6 | POST /sessions/:id/close-with-summary | WRITE (fecha+resumo) | requirePermission('marketplace_manage_orders') | closed_by=actionContext.actorId | operador | SIM | DIVERGENT | MONEY_ADJACENT |
| 7 | POST /orders | WRITE (cria order marketplace) | requirePermission('marketplace_manage_orders') | autoria=actionContext.actorId; buyer/seller do body | seller/buyer da order | parcial (order tem seller/buyer; PDV não checa) | DIVERGENT | MONEY_ADJACENT |
| 8 | POST /orders/:orderId/items/unit | WRITE (add item) | requirePermission('marketplace_manage_orders') | actionContext.actorId | order owner | parcial | DIVERGENT | MONEY_ADJACENT |
| 9 | POST /orders/:orderId/items/weight | WRITE (add item) | requirePermission('marketplace_manage_orders') | actionContext.actorId | order owner | parcial | DIVERGENT | MONEY_ADJACENT |
| 10 | **POST /orders/:orderId/pay** | **MOVE_MONEY** (via marketplace paymentExecutionService) | requirePermission('marketplace_execute_payments') | actionContext.actorId | order seller/buyer | parcial (order id) | **DIVERGENT-MONEY** | **MONEY** (via Core; NÃO bank_ledger direto) |

**Resumo:** 10 rotas, **todas canal-1 sem binding** → 10 DIVERGENT (incl. **1 DIVERGENT-MONEY**: pay). Migration: não.
Decisão Clayton: possível (modelo de autoridade do operador PDV — sessão/empresa) na frente de correção (PDV-F2).

## PARTE 1 — ACHADOS OBRIGATÓRIOS (confirmados de 1ª mão)

- **payments DIVERGENT-MONEY: CONFIRMADO.** POST `/orders/:orderId/pay` usa `requirePermission('marketplace_execute_payments')`,
  grava autoria por `actionContext.actorId`, **NÃO prova canRepresentActor/assertActorRepresentable**, e MOVE dinheiro via
  Core. Classe = **DIVERGENT-MONEY**.
- **Hook/preHandler NÃO binda: CONFIRMADO.** O hook só verifica existência de `actionContext.actorId`; o `require-permission.guard`
  checa a capability do actor DECLARADO, sem vincular req.user → actor. (Código: hook L25-27; guard usa `actionContext.actorId`
  + `actorRegistryService.findByActorId`, sem canRepresentActor.)
- **bank_ledger: NÃO toca direto. CONFIRMADO.** grep por `bank_ledger`/`INSERT INTO bank_`/`bankTransactionService` em
  `src/modules/pdv/` = vazio. Money via `paymentExecutionService.executePayment` (Core/marketplace). → materialidade MONEY
  (via Core), NÃO BANK_TOUCH direto. **Sem STOP crítico.**
- **Gap 0113:** `actionContext.actorId` (canal-1) NÃO é detectado pelo `audit-actor-authority-boundary.mjs` (cobre body/
  params/query/x-actor-id, não actionContext) → PDV não aparece no baseline 0113. Este LOCK cobre o gap p/ PDV.

## PARTE 2 — LOCK GUARD

`audit-pdv-authority-lock.mjs` (no `validate:regression-guards`): REGISTRO das 10 rotas classificadas (DIVERGENT / pay
DIVERGENT-MONEY). FALHA se: (a) rota PDV NOVA fora do registro; (b) a rota pay for declassificada de DIVERGENT-MONEY SEM
binding real (canRepresentActor/assertActorRepresentable); (c) PDV escrever bank_ledger/transactions/splits DIRETO; (d)
PDV perder a marca canal-1 (actionContext.actorId) — mudança silenciosa de modelo. **Baseline: 10 rotas (10 DIVERGENT,
1 DIVERGENT-MONEY).** NÃO corrige nada.

## PARTE 3 — NEGATIVE-PROOF

`negative-proof-pdv-authority-lock.ps1`: (a) rota PDV nova não classificada · (b) pay declassificada p/ CANONICAL sem
binding (mutação do registro) · (c) PDV `INSERT INTO bank_ledger` direto → guard FALHA nos 3; restauração **byte-idêntica**
(SHA256 de pdv.routes.ts + pdv.service.ts + guard).

| Prova | Resultado |
| --- | --- |
| pdv-authority-lock guard | GATE OK (10 rotas; 1 DIVERGENT-MONEY; sem bank_ledger direto) |
| negative-proof | 3 mordidas (rota nova / pay-declass / bank-touch); byte-idêntico |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0; +1 guard) |
| arch --strict | `critical_new=0` |
| tsc | build **25** · strict **43** (inalterado; nenhuma mudança de runtime/compilado) |

## NÃO TOCADOS (zero runtime behavior change)

runtime PDV (handlers intocados) · Bank · Core · bank_ledger · seed · migration · RBAC (não ativado) · stub
actor_has_permission (RETURN FALSE) · RLS · mapper · cargo · delegação · platform · cartão · financial_approval_* ·
C4/B3f/A1/E1/E2/B1f. dev 385/385.

## RISCOS REMANESCENTES (→ PDV-F2, correção)

- **POST /orders/:orderId/pay (DIVERGENT-MONEY)**: corrigir p/ binding canônico do operador — provável `canRepresentActor`
  sobre o actor da `pdv_session` (operador) + verificar que a sessão pertence ao operador autenticado, ANTES do pagamento.
  **Pode exigir decisão de Clayton** (modelo de autoridade do operador PDV: sessão × empresa × delegação).
- **Sessions/orders/items (DIVERGENT)**: idem — binding por representabilidade do operador/empresa.
- **Readers (3/4/5)**: filtro/leitura por `actionContext.actorId` sem binding — sessão é leakável por spoof de actorId;
  corrigir com binding.
- **Migration?** provável NÃO (pdv_sessions.actor_id já resolve o operador); a correção é de binding em runtime (PDV-F2).

## DT

`DT-PDV-CANAL1-AUTHORITY-NO-BINDING` (OPEN): 10 rotas PDV gravam/filtram autoria por `actionContext.actorId` (canal-1
0113) sem binding server-side; pay = DIVERGENT-MONEY; contido por `audit-pdv-authority-lock.mjs`; correção = PDV-F2.

## Estado

WAVE-1 BATCH-5 (PDV-F0-LOCK) **IMPLEMENTED / HOLD PARA RESEAL**. Matriz completa; payments classificado DIVERGENT-MONEY;
hook/guard provados sem binding; PDV não toca bank_ledger direto (via Core); guard + neg-proof no regression-guards; **zero
runtime change**. Correção = PDV-F2 (frente própria, possível decisão Clayton). dev 385; baseline 0113=0.
