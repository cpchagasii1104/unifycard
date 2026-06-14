# 2026-06-14 — F-BANK-HTTP-AUTHORITY-BINDING (MODO: EXECUTOR / macrofrente única)

Remove o resíduo **`bank-http`** do baseline DECISION-0113 (**2 → 1**) por binding material ao Core de
Aprovação Financeira (DECISION-0128). Os writers move-money de bank-http viram **REQUEST-ONLY**: criam
`approval_request` no Core e **NÃO executam Bank**. Parent `d8242677` · branch `rescue-structural` · dev 384
(sem migration). **"bate na porta da sala de aprovação; ainda não abre o cofre."**

## READ-FIRST

`core/unifybank/bank-http.routes.ts` (mount /bank + /admin, dentro do protectedScope):
- **POST /transactions/simple** — writer move-money: `assertUserOwnsFromAccount` (server-side) → `ensureUserActor`
  → `bankPortsRegistry.getBankTransaction().createSimpleTransaction` (**executava dinheiro**).
- **POST /transactions/split** — writer move-money: idem → `createTransactionWithSplit` (**executava split**).
- **GET /balance** — reader: subject `userId=req.user.id` (server-side) + `actorCapabilitiesService.resolveForUser`
  (autoridade); `query.actorId` = ALVO de leitura. **Motivo do baseline:** o canal `query.actorId` sem helper de
  binding reconhecido + os writers move-money no mesmo arquivo (HARD STOP).
**Decisão:** writers → **request-only** (mapeamento seguro: subject/tenant/actor/conta server-side já validados;
`operation_type='transfer'` canônico; detalhes em `operation_data`). Reader GET /balance → reconhecido por nova
**Forma E** do guard (sem mascarar). DECISION-0128 cobre — sem DECISION nova.

## Patch (rota a rota)

- **POST /transactions/simple:** removidos `buildFinancialAuthorshipFromRequest` + `getBankTransaction().createSimpleTransaction`.
  Agora: valida → `ensureUserActor` → `createFinancialApprovalRequest({operationType:'transfer', actingForAccountId=fromAccount,
  actingForActorId=actor, requestedByUserId=req.user.id, idempotencyKey='bankhttp:simple:<eventId>', operationData=snapshot})`
  → **202** `{status:'requested', approvalRequestId, executed:false}`. **Nenhuma** chamada a Bank.
- **POST /transactions/split:** idem (`createTransactionWithSplit` removido); `operationType:'transfer'`,
  `idempotencyKey='bankhttp:split:<eventId>'`, contexto/split em `operation_data`. → **202 requested**.
- **GET /balance:** inalterado (já seguro; leitura via `getUserBalance`/`getActorBalance`).
- **Guard 0113** (`audit-actor-authority-boundary.mjs`): (1) detecção de subject server-side ampliada para
  `req.user.id`/`req.user?.id`; (2) **Forma E** = `actorCapabilitiesService.resolveForUser(tenantId, <alvo>, <subj=req.user>)`;
  (3) `bank-http` **REMOVIDO do BASELINE → SAFE_SUBJECT_READERS**. Baseline **2 → 1** (resta payout).
- **Guard NOVO** `audit-bank-http-authority-binding.mjs` (no regression-guards): FALHA se bank-http voltar a executar
  Bank (getBankTransaction/createSimple/createSplit/bankTransactionService/bank_* write), deixar de ser request-only,
  usar `availableBalanceCents`, usar body.actor/actionContext/x-actor-id/tenant body|query, **ou zerar o baseline 0113
  enquanto payout resta** (payout DEVE seguir no BASELINE; bank-http DEVE estar em SAFE_SUBJECT_READERS).

## Provas

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera) | **14/14** — T1/T3 202 requested · T2 approval_request transfer + subject server-side · T4 idempotência · T5 spoof body.actor/actorId/actionContext/tenant_id não vira subject · T6 conta de outro dono → 403 sem approval · T7/T8/T9 bank_ledger/bank_transactions/bank_splits intocados · T10 payout intocado · T11 baseline 0113=1 · T12 zero can_execute_* · S1 guard verde |
| negative proof (bank-http) | morde Bank exec + availableBalanceCents; restauração byte-idêntica |
| negative proof (0113) | recognized **5**, baseline **1**, payout baselined, Forma E aceita/rejeita corretamente |
| 0113 guard | `flagged=1 baseline=1 new=0 safe_subject_recognized=5` (bank-http via Forma E) |
| bank-http guard | GATE OK (no chain) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum em bank-http/unifybank) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

`bank_ledger`/`bank_transactions`/`bank_splits` intocados · payout intocado · `seller_available` intocado ·
`actor_wallet payout` intocado · dispute/reversal contido · cartão não implementado · `can_execute_*` não criado ·
`availableBalanceCents` não usado · tenant/body/query não viraram autoridade · `actorId` cliente não virou subject ·
**baseline 0113 NÃO zerado** (payout permanece, baseline=1). Sem worker/endpoint executor; sem migration; sem verdade paralela.

## Estado

F-BANK-HTTP-AUTHORITY-BINDING: **IMPLEMENTED / HOLD PARA RESEAL**. **DECISION-0113 baseline = 1** (resta
`payout`). bank-http = READER + REQUEST-ONLY (bind ao Core). Core EXECUTION segue HOLD. Próxima frente:
F-ACTOR-WALLET-PAYOUT-WIRING / F-PAYOUT-EXECUTION-SEAL (DECISION-0128 §16) — fecha o último resíduo 0113.
