# 2026-06-14 — F-ACTOR-WALLET-PAYOUT-WIRING (MODO: EXECUTOR / macrofrente única)

Fecha o **último resíduo** do baseline DECISION-0113 (`payout`) → **baseline 2→1→0**. Os writers
move-money/estado-financeiro de payout viram **FAIL-CLOSED** (403). Parent `6fe5cc9b` · branch
`rescue-structural` · dev 384 (sem migration). **"payout bate na porta da sala de aprovação; ainda não
abre o cofre"** — e nesta frente nem bate: é fail-closed (execução manual/batch/fail não são "request"
seguro). **🎯 DECISION-0113 baseline = 0 — arco authority-binding ENCERRADO.**

## READ-FIRST

`modules/payout/payout.routes.ts` (dentro do protectedScope, preHandler `requirePayoutPermission`):
- **POST /payouts/batches** — batch executor → `payoutService.createPayoutBatch` (writer).
- **POST /orders/:id/execute-manual** — execução manual → `executePayoutManual` (B2: mock; tabelas
  `payout_batches`/`payout_orders` AUSENTES → DEAD).
- **POST /orders/:id/fail** — fail/settlement → `markAsFailed` (muda estado financeiro).
- **GET /payouts/batches[/:id], /orders[?actorId][/:id]** — readers; gateados por `requirePayoutPermission`
  → `businessAuthorizationService.requirePermission(tenantId, userId=req.user.id, actor.actor_id, 'financial:execute_payout')`
  = **Forma B** (subject server-side, subj!=target); `query.actorId` = FILTRO do operador.
**Motivo do baseline:** canal `query.actorId` (GET /orders) + writers move-money/estado-financeiro no mesmo
arquivo (HARD STOP — money-writer não auto-reconhecido mesmo com subject server-side).
**Decisão:** writers → **FAIL-CLOSED** (GO: batch executor / execução manual / fail-settlement → fail-closed;
request-only exigiria checagem de recovery obligation e não mapeia a um único "request"). Readers → reconhecidos
por **Forma B** (já presente no preHandler). `seller_available` = legado no WORKER (idle, sem producer), **fora**
do escopo HTTP — não tocado.

## Patch (rota a rota)

- **POST /payouts/batches** → **403 `PAYOUT_HTTP_EXECUTION_DISABLED`** (sem `createPayoutBatch`).
- **POST /orders/:id/execute-manual** → **403** (sem `executePayoutManual`).
- **POST /orders/:id/fail** → **403** (sem `markAsFailed`).
- **GET readers** → inalterados (Forma B no preHandler; `payoutService.list*`/`get*` = leitura).
- **Guard 0113:** `payout` **REMOVIDO do BASELINE → SAFE_SUBJECT_READERS** (Forma B reconhece o reader). **BASELINE
  agora vazio → baseline = 0.**
- **Guard NOVO** `audit-payout-authority-binding.mjs` (no regression-guards): FALHA se payout voltar a executar
  (`createPayoutBatch`/`executePayoutManual`/`markAsFailed`/`bankTransactionService`/`bank_*` write), deixar de ser
  fail-closed, usar `availableBalanceCents`/`seller_available` como autorização, usar autoridade client-declared,
  ou regredir o baseline (payout/bank-http devem seguir reconhecidos, não no BASELINE/apagados).
- **Guard bank-http** ajustado: o check "baseline não zerado enquanto payout resta" foi generalizado — payout deve
  seguir RECONHECIDO (BASELINE enquanto resíduo OU SAFE_SUBJECT_READERS quando fechado por frente própria), nunca apagado.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera) | **14/14** — T1/T2/T3 writers → 403 · T4 spoof (body.actor/actorId/actionContext/tenant_id) 403 e zero efeito · T5/T6/T7 bank_ledger/bank_transactions/bank_splits intocados · T8 actor_wallet_payout_requests não vira pago/executado · T9 fail-closed não cria approval_request · T10 baseline 0113=0 · T11 bank-http ainda reconhecido · T12 zero can_execute_* · S1/S2 estrutural+guard |
| negative proof (payout) | morde payout exec + seller_available; restauração byte-idêntica |
| negative proof (0113) | recognized **6**, baseline **0**, bank-http+payout reconhecidos, Forma B/E |
| negative proof (bank-http) | continua mordendo (Bank exec + availableBalanceCents) |
| 0113 guard | `flagged=0 baseline=0 new=0 safe_subject_recognized=6` |
| payout guard | GATE OK (no chain) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum em payout) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

Não move dinheiro. `bank_ledger`/`bank_transactions`/`bank_splits` intocados · bank-http continua safe (não
regrediu) · `seller_available` não autoriza (e worker legado não tocado) · `actor_wallet payout` não executa ·
recovery obligation não ignorada (fail-closed = sem execução, recovery moot) · `availableBalanceCents` não usado ·
dispute/reversal contido · cartão não implementado · `can_execute_*` não criado · tenant/body/query não viraram
autoridade · `actorId` cliente não virou subject. **baseline 0113 = 0 só porque payout REALMENTE saiu** (writers
fail-closed + reader com Forma B verificada em runtime; não é allowlist trick). Sem worker/endpoint executor; sem migration.

## Ressalvas

- **`seller_available` worker** (`workers/payout-worker.ts`) = legado **idle** (sem producer); é WORKER, não
  superfície HTTP — fora do escopo desta frente. Tombstone do worker = frente própria futura.
- **Core EXECUTION segue HOLD/DECISION_REQUIRED** — payout HTTP é fail-closed; a execução real (request→approval→
  execution com revalidação de saldo + bloqueio por recovery + locks + idempotência) é **F-PAYOUT-EXECUTION-SEAL**.
- Baseline herdado (tsc 25 / arch 4 warning_new) pré-existente, não introduzido.

## Estado

F-ACTOR-WALLET-PAYOUT-WIRING: **IMPLEMENTED / HOLD PARA RESEAL**. **🎯 DECISION-0113 baseline = 0** — os 2
resíduos financeiros (bank-http request-only, payout fail-closed) fechados; arco authority-binding ENCERRADO.
Core EXECUTION segue HOLD. Próximas (DECISION-0128 §16): F-PAYOUT-EXECUTION-SEAL · F-DISPUTE-REVERSAL-REOPEN ·
F-CARD-AUTHORIZATION-CORE — todas dependem do Core executor (futuro).
