# 2026-06-14 — F-PAYOUT-REQUEST-ONLY-ENTRYPOINT (MODO: EXECUTOR / macrofrente única)

Cria a entrada HTTP **request-only** de payout: `POST /api/payouts/requests` cria SOMENTE a solicitação
(`actor_wallet_payout_requests` pending_approval + `approval_requests` pending), com autoridade server-side via
`canRepresentActor`. **NÃO aprova, NÃO executa, NÃO chama worker/Bank, NÃO move dinheiro.** Parent `68c7a574` ·
branch `rescue-structural` · dev 384 (sem migration). Caso implementado = **self/wallet-representada** (o caso
desbloqueado do READ-FIRST). approve/operador-em-nome-de/4-olhos/multi-approval = frentes futuras (DECISION_REQUIRED).

## READ-FIRST

`requestActorWalletPayout` (F2, `actor-wallet-payout.service.ts:132`) já cria approval (via Core) + payout_request
em 1 TX, zero dinheiro. `canRepresentActor(tenantId, userId, actorId)` (`authorization.service.ts:333`) é fail-closed
(ownership/company/group/delegação). payout module monta em `/api` dentro do protectedScope (auth+tenant). As 3 rotas
antigas (`/payouts/batches`, `/orders/:id/execute-manual`, `/orders/:id/fail`) seguem fail-closed (403). **Decisão de
arquitetura:** rota nova em **arquivo separado** (`payout-request.routes.ts`) — `payout.routes.ts` fica intocado,
preservando `safe_subject_recognized=6` e `payout ∈ SAFE_SUBJECT_READERS` do guard 0113.

## Patch

- **`src/modules/payout/payout-request.routes.ts` (NOVO):** `POST /payouts/requests`.
  - subject=`req.user.id` (→ requested_by_user_id), tenant=`req.tenant.id` — **server-side**; body zod `.strip()`
    (ignora requestedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents).
  - `actorId` do body = HINT → `authorizationService.canRepresentActor(...)`; false → **403 ACTOR_NOT_REPRESENTABLE**.
  - amount inteiro positivo (400 se não); idempotencyKey opcional (gera uuid se ausente).
  - delega a `requestActorWalletPayout`; retorna 201/200 `{status:'pending_approval', payoutRequestId, approvalRequestId, executed:false, balanceSnapshot(informativo)}`.
  - **NÃO** chama approve/execute/worker/Bank. Error map: 404/409/422/400.
- **`payout.module.ts`:** registra `payoutRequestRoutes` em `/api` (além de payoutRoutes). **Rotas antigas intocadas (403).**

## Request flow

```
POST /api/payouts/requests  (protectedScope: auth+tenant)
  userId=req.user.id · tenantId=req.tenant.id   (server-side; body subject/tenant ignorados)
  actorId(body)=HINT → canRepresentActor(tenantId, userId, actorId)  → false ? 403
  → requestActorWalletPayout({requestedByUserId:userId, actorId, amountCents, idempotencyKey, reason})
     → approval_requests 'pending' (operation_type=actor_wallet_payout, via Core insertApprovalRequestTx)
     + actor_wallet_payout_requests 'pending_approval'  (1 TX, zero dinheiro)
  → 201/200 { status:'pending_approval', payoutRequestId, approvalRequestId, executed:false }
APROVAÇÃO/EXECUÇÃO = fora desta frente (worker system-only default-off consome 'approved').
```

## Guard + provas

- **Guard NOVO** `audit-payout-request-only-entrypoint.mjs` no `validate:regression-guards`: FALHA se a rota chamar
  approve/execute/worker/Bank, escrever bank_* direto, retornar executed:true, usar seller_available/payout_requests/
  availableBalanceCents/businessAuthorizationService/organization_members/can_manage_financial/can_execute_*/financial:
  execute_payout/actionContext/x-actor-id/query.actorId, aceitar requestedByUserId/tenant do body, NÃO usar
  canRepresentActor/requestActorWalletPayout/executed:false; ou se existir approve/decision route; ou se as rotas antigas
  deixarem de ser 403; ou se o baseline 0113 regredir.
- **Negative proof** `negative-proof-payout-request-only-entrypoint.ps1`: injeta (a) execução, (b) executed:true,
  (c) remoção de canRepresentActor → guard FALHA nos 3 → restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-payout-request-only-entrypoint.ts` (DB efêmera, stub-auth, **zero dinheiro**): **16/16**
  — T1 201 pending_approval+ids+executed:false · T2 approval pending operation_type=actor_wallet_payout · T3 executed:false
  · T4/T5/T6 bank_ledger/transactions/splits intocados · T7 não executa · **T8 actor não-representável → 403** · **T9 spoof
  body ignorado** (subject=req.user server-side) · T10 amount inválido → 400 · T11 idempotência → 200 alreadyExisted ·
  T12 active-gate → 409 · **T13 availableBalanceCents não autoriza** (amount>saldo → 422) · T14 rotas antigas 403 ·
  T15 guards verdes · T16 baseline 0113=0 + zero can_execute_*.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera, zero dinheiro) | **16/16** |
| negative proof | morde execução + executed:true + remoção canRepresentActor; restauração byte-idêntica |
| payout-request-only guard | GATE OK (no chain) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 `flagged=0 baseline=0 safe_subject_recognized=6`) |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

Não criou approve endpoint · não chamou approveActorWalletPayout/executeActorWalletPayout/worker/Bank ·
`bank_ledger`/`bank_transactions`/`bank_splits` intocados · rotas antigas fail-closed (403) · worker default-off ·
bank-http request-only · **baseline 0113=0** · `seller_available`/`payout_requests` legado não usados ·
`availableBalanceCents` não autoriza (filtro de criação, não bypassável por body) · `can_execute_*` não criado ·
`financial:approve_payout`/`financial:create_payout` não criados · executor/worker selados intocados · bank-http intocado.

## Ressalvas (fora desta frente)

- **APPROVE endpoint = DECISION_REQUIRED** (sem autoridade material: sem key, role-chain morta, grants insuficientes).
- **4-olhos** (requester≠approver) **fora**; **multi-approval/quórum fora**; **operador financeiro/operador-em-nome-de fora**;
  **plataforma aprovadora fora**; **PIX/TED fora**; **company-scoping** do operador (D9) aberto.
- O HTTP request-only **alimenta a fila pending**, mas **nada move dinheiro sem aprovação** (que não existe ainda) +
  worker default-off. A entrada é segura por construção.

## Estado

F-PAYOUT-REQUEST-ONLY-ENTRYPOINT: **IMPLEMENTED / HOLD PARA RESEAL**. Entrada de payout = request-only, autoridade
server-side via `canRepresentActor`, zero dinheiro. APPROVE segue **DECISION_REQUIRED**. baseline 0113=0; execução/worker
selados intocados. Próximas: decisão de Clayton sobre quem aprova (D2/D3/D4), self-reader `GET /payouts/requests/mine`,
operador-em-nome-de, company-scoping.
