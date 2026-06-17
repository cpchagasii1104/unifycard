# 2026-06-17 — F-AUTHORITY-Z2-R5-INTENT-EXECUTE-BUYER-ACTOR-BINDING (material, cirúrgico)

Contenção **localizada** de vazamento canal-1 vivo em `POST /intent/execute` (DECISION-0113 / DECISION-0131
§B7 / Z2): o handler tomava `buyerActorId = actionContext.actorId` (client-declared) como autoridade e criava
order/itens/reserva/saga em nome desse actor **sem provar representação**. `actionContext.actorId` é HINT, nunca
autoridade (declarar ≠ autorizar). Sem refactor de RBAC; sem migration; Bank/ledger/splits/settlement/payout/
referral/groups/dashboard/reports intocados.

## Anchor / Pré-flight

HEAD inicial `28db8ce1` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`/`4aeebe7f`/
`37eb5efa`/`13f3ee2e`/`fb73cd95`/`24a45196`/`e8394a27`/`28db8ce1` presentes. Sem sujeira material em
intent/order/authorization/action-context/bank/ledger/migrations/groups/dashboard/reports/referral.

## Preflight R4 (3 paralelas READ-ONLY) — convergência

- **A — IA-DINHEIRO:** `PASS_MONEY_LATENT`. B1 não move dinheiro; cria order/order_items/inventory_reservations,
  sem ledger/bank/payout/wallet.
- **B — IA-ACTOR-USERS:** `PASS_WITH_DECISION`. B1 é falha Z2 viva/material: `buyerActorId = actionContext.actorId`
  sem `canRepresentActor`.
- **C — IA-BANCO/DT:** `PASS_WITH_SPLIT_RECOMMENDATION`. B1 vivo, code-only, sem necessidade de migration; frente
  própria, separada de A1–A6.

## Causa-raiz (READ-FIRST)

`intent-execute.routes.ts` resolvia `buyerActorId = actionContext?.actorId` (linhas ~226-234) e o passava direto a
`orderService.createOrderWithItemsAndReservations({ buyerActorId })` (linha ~359). A única checagem prévia de actor
era ownership do `source_order` no caminho `repeat_last_order` (`prevOrder.buyerActorId !== buyerActorId → 403`) —
**não cobre** falsificação do buyer no caminho normal. Recon confirmou: o service confia em `buyerActorId`
**cegamente** (nenhum check de representação/delegação/RBAC) → o gate só pode viver na rota; não há preHandler
existente chamando `canRepresentActor` para `/intent/execute`; `req.user.userId` está populado no handler;
write-surface = orders/order_items/inventory_reservations/order_sagas/event_outbox — **zero `bank_*`, zero money**
(class doc: "Não integra com Bank"). Norma: DECISION-0113 D1/D2 (`actionContext.actorId` = HINT; autoridade =
`canRepresentActor` server-side, fail-closed) + DECISION-0131 §B7 (declarado pelo cliente NUNCA é autoridade;
`assertActorRepresentable` não-removível) + exemplar DECISION-0121 (order/booking authority binding).

## Correção (cirúrgica — só `intent-execute.routes.ts`)

Após resolver o hint `buyerActorId` e antes de qualquer write material:
```
const authUserId = (req as { user?: { userId?: string } }).user?.userId;   // subject server-side (canônico Z2)
if (!authUserId) return reply.status(401)...code: 'AUTH_REQUIRED';
let canRepresentBuyer = false;
try { canRepresentBuyer = await authorizationService.canRepresentActor(tenantId, authUserId, buyerActorId); }
catch { canRepresentBuyer = false; }                                         // fail-closed
if (!canRepresentBuyer) return reply.status(403)...code: 'BUYER_ACTOR_NOT_REPRESENTABLE';
```
- **Posição:** logo após o null-check de `buyerActorId`, **antes** de `parse`, de qualquer read (`getOrderById` do
  repeat) e do sink `createOrderWithItemsAndReservations` — o ponto seguro mais cedo.
- **Idempotência preservada:** o `claimIntentIdempotency` ocorre antes do gate; em 401/403 o `finally` chama
  `failIntentIdempotency` (libera o claim). Nenhum order/reserva/saga é criado.
- **Subject = `req.user.userId`** (alias `.id` documentado em `fastify.d.ts`); espelha o padrão canônico Z2
  (`resolveReportActorId`/groups). `actionContext.actorId` segue HINT vinculado.
- **Repeat path:** o check `prevOrder.buyerActorId !== buyerActorId → 403` permanece (defesa em profundidade);
  agora exige **representar** o buyer **E** o source order pertencer a ele.
- **Baseline:** `core/intent/intent-execute.routes.ts` removido do `BASELINE` canal-1 de
  `audit-actor-authority-boundary.mjs` (o arquivo agora é `hasBinding` → o guard o exclui; remoção documentada no
  header do guard, espelhando remoções anteriores).

## E2E

`run-intent-execute-buyer-actor-binding-ephemeral.ps1` → **15/15 verdes** (DB efêmera dedicada; nunca unificard_dev):
- **A (estrutural):** A1 gate `canRepresentActor(tenantId, authUserId, buyerActorId)` presente · A2 subject =
  `req.user.userId` · A3 403 `BUYER_ACTOR_NOT_REPRESENTABLE` fail-closed · A4 gate **antes** de
  `createOrderWithItemsAndReservations`.
- **B (primitivo):** B1 `canRepresentActor(A.userId, A.actor) === true` · B2 `canRepresentActor(B.userId, A.actor)
  === false`.
- **C (HTTP real via `fastify.inject` contra a DB efêmera):** C1 user B declara `actionContext.actorId` = actor de A
  → **403 `BUYER_ACTOR_NOT_REPRESENTABLE`** · C2 no 403 **orders/order_items/inventory_reservations/order_sagas/
  event_outbox NÃO crescem** · C3 no 403 **bank_ledger/bank_transactions/bank_splits NÃO crescem** · C4 user A
  (representa A.actor) **passa do gate** (falha adiante por refs dummy, nunca 403-repr) · C5 sem
  `actionContext.actorId` → **400 `ACTOR_REQUIRED`** preservado · C6 `repeat_last_order` com actor alheio → **403**
  sem write (idempotência/repeat não burla).
- **D (não-regressão):** D1 groups (R1) mantém `canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)` ·
  D2 reports (R3) mantém `resolveReportActorId` (≥8) · D3 dashboard (R2) mantém `resolveReportActorId`.

## Guard + Negative-proof

Novo `scripts/audit-intent-execute-buyer-actor-binding.mjs` em `validate:regression-guards`: exige
`canRepresentActor(tenantId, authUserId, buyerActorId)`, subject de `req.user.userId`, 403
`BUYER_ACTOR_NOT_REPRESENTABLE`, e o gate **antes** do sink; proíbe `buyerActorId`/`actionContext.actorId` como
subject. **Negative-proof versionado** `scripts/negative-proof-intent-execute-buyer-actor-binding.ps1`: remove o
binding (`authorizationService.canRepresentActor(...)` → `Promise.resolve(true)`) com backup byte-exato →
**GATE FAIL (exit 1)** → restaura byte-idêntico (`WriteAllBytes`) → **GATE OK**.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente, nenhum nas minhas alterações) · check:migrations OK
(**sem migration**) · tsc baseline **43** (default tsconfig) — **0 erro novo na frente** (provado por `git stash` do
arquivo material: 43 → 43).

## Escopo negativo

Sem migration; **zero refactor de RBAC** (só a rota intent-execute); Bank Core/`bank_ledger`/`bank_transactions`/
`bank_splits`/settlement/unifycard/regionAccount/payout/recovery/referral, R1 groups/R2 dashboard/R3 reports
**intocados**. **A1–A6 settlement/unifycard/regionAccount money-latent NÃO foram corrigidas nesta frente** —
permanecem para frente própria de guard/fail-closed anti-reativação.

## Warnings não-bloqueantes (reseal Yala = PASS_WITH_WARNINGS)

- **W-a** — E2E C6 não testa explicitamente `repeat_last_order` com a **mesma** idempotency-key após um 403.
  Análise de código indica segurança: o `claim` é deletado no `finally` em erro e só vira `completed` no sucesso →
  o 403 não deixa um claim "completed" reutilizável. Classificação: melhoria futura de cobertura.
- **W-b** — `succeeded = true` poderia ser setado só **após** `completeIntentIdempotency` confirmar. Classificação:
  robustez defensiva futura (não exploitável aqui).
- **W-c** — o guard ainda é file-level para `intent-execute.routes.ts`; um guard cross-module Z2 futuro deve
  subsumir este e os guards R1/R2/R3. Classificação: melhoria futura da DT-mãe.
- **OBS** — untracked `backend/output_*.txt` é ruído de reseal, fora do commit.

## Continuidade (recomendação futura — NÃO executar agora)

- **`F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT`** — escopo A1–A6 settlement/unifycard/regionAccount; objetivo:
  impedir que stubs "migrated to Bank" sejam religados sem authority gate. **Não tocado nesta R5.**
- **Guard cross-module Z2** — continua recomendado para avançar a DT-mãe: `actorId` de query/body/actionContext
  aplicado a filtro/target/owner/write sensível **sem** `canRepresentActor`/`assertActorRepresentable`/helper seguro.

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-17 sobre commit material `2f531a9b`; reseal Yala material
READ-ONLY = PASS_WITH_WARNINGS). dev 394. `DT-AUTHORITY-Z2-INTENT-EXECUTE-BUYER-ACTOR-UNBOUND` → **CLOSED / YALA
PASS MATERIAL**. **Esta frente fechou somente a contenção localizada de intent-execute buyer actor binding. Não
fecha Z2 inteiro, Z1, Z3, authority global nem a DT-mãe 0113** — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`
permanece **OPEN**. R1 groups, R2 dashboard e R3 reports **não reabertos**. Nenhum código material alterado no seal.
