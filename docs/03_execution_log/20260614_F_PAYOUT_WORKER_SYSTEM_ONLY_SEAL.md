# 2026-06-14 — F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL (MODO: EXECUTOR / macrofrente única)

Liga o executor SELADO de payout a um **worker canônico system-only, default-off**, que consome apenas
`actor_wallet_payout_requests` aprovados e chama `executeActorWalletPayout`. **Tombstona** o worker legado
`seller_available→seller_payout`. Parent `39aacc10` · branch `rescue-structural` · dev 384 (sem migration).
Move dinheiro **só em DB efêmera**. payout HTTP segue fail-closed; baseline 0113 = 0.

## READ-FIRST

`backend/BOOT.ts` iniciava (gateado `ENABLE_PAYOUT_WORKER`, default-off) o worker **legado** `payout-worker.ts`
(`payout_requests` requested → `seller_available→seller_payout` via `bankTransactionService.transfer`, **sem gate
de aprovação do Core**). O executor selado `executeActorWalletPayout` (F-PAYOUT-EXECUTION-SEAL) existia mas **sem
caller automático**. Risco: `ENABLE_PAYOUT_WORKER='true'` religaria o trilho legado errado.

## Patch

- **Worker canônico NOVO** `src/workers/actor-wallet-payout-worker.ts`:
  - `claimApprovedActorWalletPayouts` — `SELECT ... FROM actor_wallet_payout_requests awp JOIN approval_requests ar
    ... WHERE awp.status='approved' AND approval_request_id NOT NULL FOR UPDATE OF awp SKIP LOCKED` (batches
    disjuntos entre ciclos; subject = `ar.requested_by_user_id` server-side).
  - `runActorWalletPayoutWorkerCycle` (ciclo TESTÁVEL, sem interval) → chama `executeActorWalletPayout` por item;
    erro transitório NÃO marca completed (executor faz rollback; reprocessa). NÃO toca Bank fora do executor.
  - `startActorWalletPayoutWorker` — **default-off** (`isFinancialWorkerEnabled('ENABLE_PAYOUT_WORKER')`, estrito;
    sem NODE_ENV). Sem HTTP. NÃO usa seller_available/seller_payout/payout_requests legado/availableBalanceCents.
- **Legado TOMBSTONED** (`payout-worker.ts`): `startPayoutWorker` virou no-op fail-closed (log + `void runPayoutCycle`)
  — não inicia ciclo/interval, não toca seller_available. Código histórico preservado, inalcançável (lei histórica).
- **BOOT** repontado: o bloco `ENABLE_PAYOUT_WORKER` agora inicia `startActorWalletPayoutWorker` (canônico), não o legado.

## Execution flow

```
actor_wallet_payout_requests.status='approved' (approval aprovado via Core)
  worker claim (FOR UPDATE SKIP LOCKED, batch)  →  executeActorWalletPayout(tenant, id, requested_by_user_id)
     → FOR UPDATE payout_request → valida approval (via Core) → drain recovery (FIFO FOR UPDATE) → recompute saldo
     → bankTransactionService.transfer (BankTransactionPort, referenceType=actor_wallet_payout) → ledger débito+crédito
     → status 'completed' → COMMIT → evento depois
idempotência: executor (status completed → completed_idempotent; uq_bank_transactions_reference) — worker não duplica
concorrência: 2 ciclos → claim disjunto (SKIP LOCKED) + executor FOR UPDATE → exatamente uma 'completed'
```

## Guard + provas

- **Guard NOVO** `audit-payout-worker-system-only.mjs` no `validate:regression-guards`: FALHA se o worker canônico
  usar seller_available/seller_payout/payout_requests/bank direto/availableBalanceCents; não consumir
  `actor_wallet_payout_requests='approved'`; não chamar `executeActorWalletPayout`; não ser default-off / habilitar
  por NODE_ENV / ter HTTP/req.*; se BOOT religar o legado `startPayoutWorker` ou não gatear o canônico; se o legado
  voltar a `setInterval`/`runPayoutCycle`; ou se o baseline 0113 regredir. (dormancy guard estendido p/ cobrir o canônico).
- **Negative proof** `negative-proof-payout-worker-system-only.ps1`: injeta (a) seller_available no worker, (b) bank
  direto, (c) BOOT religando o legado → guard FALHA nos 3 → restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-payout-worker-system-only.ts` (DB efêmera, **MOVE DINHEIRO**): **9/9** — T1 default-off
  · T2 ciclo executa só approved (pending não tocado) · T3 worker move dinheiro + completed · T4 ciclo idempotente ·
  T5 ciclos concorrentes (uma execução, sem ledger duplicado) · T6 recovery ativa drena comprometido p/ creditor ·
  T7 double-entry · T8 baseline 0113=0 + HTTP fail-closed + workers default-off + worker-system-only/execution-seal
  verdes · T9 zero can_execute_*.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera, move dinheiro) | **9/9** |
| negative proof | morde seller_available + bank direto + BOOT religando legado; restauração byte-idêntica |
| payout-worker-system-only guard | GATE OK (no chain) |
| financial-workers-dormancy / payout-execution-seal | GATE OK / GATE OK |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

payout HTTP continua **fail-closed** · bank-http request-only · DECISION-0113 baseline = 0 · worker **default-off**
(ENABLE_PAYOUT_WORKER estrito; sem NODE_ENV; sem HTTP) · `seller_available`/`seller_payout` não usados (legado
tombstoned) · `payout_requests` legado não usado · Bank só via executor selado (`BankTransactionPort`) · sem SQL
direto em `bank_*` · `availableBalanceCents` não autoriza · `can_execute_*` não criado · dispute/reversal/cartão fora.

## Ressalvas (fora desta frente)

- **payout HTTP request-only futuro** — segue fail-closed (decisão de produto).
- **multi-approval/quórum** — single-approval só.
- **PIX/TED externo** — travado por CHECK.
- **Tombstone definitivo de `seller_available`/`seller_payout`/`payout_requests`/`bank-settlement-worker`** — apenas
  o `payout-worker` foi neutralizado; resto histórico permanece como legado convergente (frente própria futura).
- **Observabilidade/ops** do worker (métricas, alertas) — não escopo desta frente.
- **Ativação em produção** = sob `ENABLE_PAYOUT_WORKER='true'` explícito (default-off).

## Estado

F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL: **IMPLEMENTED / HOLD PARA RESEAL**. Worker de payout de produção = **canônico,
system-only, default-off**, ligando o executor selado ao trilho `actor_wallet_payout_requests` aprovado. Legado
seller_available tombstoned. DECISION-0113 baseline = 0. Próximas: payout HTTP request-only (decisão), multi-approval,
seller_available tombstone definitivo, observabilidade, dispute/reversal/cartão.
