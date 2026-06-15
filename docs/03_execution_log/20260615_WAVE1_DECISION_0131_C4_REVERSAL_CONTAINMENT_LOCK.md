# 2026-06-15 — ONDA DECISION-0131 · C4 (REVERSAL CONTAINMENT / SYSTEM-AUTHORSHIP REGRESSION LOCK)

Pós-PASS Yala do B3f (commit `b92302a1`). C4 = **guard-lock read-only** sobre o motor de reversal. **ZERO runtime
change** — só guard + neg-proof + wiring + cartório. Parent `b92302a1` · branch `rescue-structural` · dev **385/385**
(sem migration). Sequência: READ-FIRST C4 (READ-FIRST COMPLETE; sem money vivo divergente) → este guard-lock.

## Estado travado (READ-FIRST C4, já entregue)

- Motor de reversal money = **system-authored** (`buildSystemAuthorship`); HTTP humano de dispute/reversal =
  **CONTIDO_FAIL_CLOSED** (403); bridge `bank-integration.reverseTransaction` (fallback "1º actor") alcançável só por
  `rides.service.cancelRide` (**DEAD/0 callers**); post-D-money/recovery block presente;
  `bank-transaction.reverseTransaction` = **TOMBSTONE** (deprecated/throw).
- Gap: a contenção estava protegida **só por e2e** (fora do `validate:regression-guards`) → podia regredir em silêncio.

## Patch (só guard, ZERO runtime)

- **`scripts/audit-reversal-containment.mjs`** (novo, no `validate:regression-guards`). 7 invariantes:
  - **INV1** — `reconciliation-dispute.routes.ts`: 4 rotas mutáveis `403` fail-closed (`DISPUTE_REVERSAL_HTTP_DISABLED`/
    `DISPUTE_MUTATION_HTTP_DISABLED`, `.status(403)`×≥4) e SEM chamar motor de mutation/reversal.
  - **INV2** — `GET /disputes/:id/events` read-only (só `listDisputeAuditEvents`; sem INSERT/UPDATE/DELETE/transfer).
  - **INV3** — `reversal.service.ts`: todo `authorship:` dos transfers é `buildSystemAuthorship` (≥2; morde se virar
    actor/user/actionContext/client-declared).
  - **INV4** — nenhum `*.routes.ts` (fora de `src/scripts`) chama `requestReversal`/`requestAndExecuteReversalSync`/
    `executeReversal`/`executeDisputeFinancialReversal`/`reverseTransaction` direto.
  - **INV5** — `bank-transaction.reverseTransaction` continua tombstone (throw `REVERSE_TRANSACTION_DEPRECATED`; sem
    executar motor/transfer). _(O check ignora a string da mensagem de erro, que cita o nome `reverseTransaction()`.)_
  - **INV6** — baseline dos arquivos de runtime que referenciam `reverseTransaction(`/`cancelRide(`; arquivo novo →
    morde (novo caller potencial do bridge frouxo/dead). Baseline: `bank-transaction.service.ts` (tombstone) +
    `bank-integration.service.ts` (bridge) + `rides/rides.service.ts` (único caller, DEAD).
  - **INV7** — post-D-money/recovery block: `checkPostDmoneyBlock` (≥3 sites: def + request + execute/sync) +
    `released_to_actor_wallet` + `refunded_via_recovery` + `REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW`.
- **`scripts/negative-proof-reversal-containment.ps1`** (novo): 6 mordidas.
- **`package.json`:** guard encadeado ao fim de `validate:regression-guards`.
- **NÃO tocado:** nenhum `.ts` de runtime · reversal.service · reconciliation-dispute routes/service · rides ·
  bank-integration · Bank/Core · recovery · payment_intents · ledger/splits.

## Provas

- **Guard** `audit-reversal-containment.mjs`: GATE OK (dispute 403×4; system-authored ×2; tombstone; post-D-money 4 sites;
  bridge baseline reverseTransaction=3 files, cancelRide=1 file).
- **Negative-proof** `negative-proof-reversal-containment.ps1`: **6 mordidas** byte-idêntico — (1) reabrir rota 403
  (INV1) · (2) authorship não-system (INV3) · (3) rota HTTP chama motor (INV4) · (4) tombstone reativado (INV5) ·
  (5) caller novo do bridge dead `cancelRide` em arquivo de runtime (INV6) · (6) remover post-D-money block (INV7).
- **Sem e2e novo:** frente é guard estrutural + neg-proof; nenhum runtime tocado. e2e de contenção pré-existentes
  (dispute-reversal-http-containment, dispute-mutation-http-containment, dispute-reversal-authority-model,
  refund-post-dmoney-guard) permanecem; o guard agora trava as mesmas invariantes no chain.

| Prova | Resultado |
| --- | --- |
| audit-reversal-containment guard | GATE OK (7 invariantes) |
| negative-proof | 6 mordidas; byte-idêntico |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (+1 guard) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (INALTERADO — zero `.ts` tocado) |

## DT

- **DT-RIDES-CANCEL-REVERSAL-DEAD-BRIDGE** (OPEN): `rides.service.cancelRide` (0 callers) + bridge
  `bank-integration.reverseTransaction` com fallback "1º actor"; DEAD/contido por inalcançabilidade; NÃO amputar nesta
  frente; reativação de rides/bank exige READ-FIRST financeiro próprio.

## NÃO TOCADOS

Runtime (`.ts`) · reversal.service · reconciliation-dispute (routes/service) · rides · bank-integration · Bank/Core ·
recovery · payment_intents · bank_ledger/bank_transactions/bank_splits · migration/seed. Motor NÃO reativado; dead code
NÃO amputado. dev 385/385.

## Estado

C4 **IMPLEMENTED / HOLD PARA RESEAL**. A contenção do motor de reversal (403 HTTP humano · money system-authored ·
tombstone · post-D-money block · baseline do bridge dead) ficou **TRAVADA** por guard estrutural no chain (zero runtime),
com neg-proof de 6 mordidas e DT do bridge morto. **Fecha SÓ como:** C4 — REVERSAL CONTAINMENT / SYSTEM-AUTHORSHIP
REGRESSION LOCK (NÃO o motor inteiro / bridge / fallback / operador×reversal / recovery / Bank/Core). dev 385;
baseline 0113=0.
