# 2026-06-14 — F-FINANCIAL-WORKERS-STRUCTURAL-DORMANCY-SEAL (MODO: EXECUTOR / macrofrente única)

Torna **estrutural** (não acidental) a dormência dos 3 workers financeiros que moviam dinheiro e estavam
**armados incondicionalmente no BOOT**. Parent `28e69c40` · branch `rescue-structural` · dev 384 (sem migration).
**NÃO implementa payout, NÃO executa dinheiro, NÃO cria Core executor.** Só impede start por padrão.

## READ-FIRST

O entrypoint de produção é **`backend/BOOT.ts`** (raiz; `src/server.ts:1` declara "Entrypoint de produção:
BOOT.ts"; `"dev":"tsx watch BOOT.ts"`). Ele iniciava **incondicionalmente** (só `try/catch` de import, **sem env
flag**): `startPayoutWorker()` (l.272), `startReversalWorker()` (l.281), `startBankSettlementWorker()` (l.290).
- `payout-worker.ts` = executor real: `payout_requests` requested → `seller_available→seller_payout` via
  `bankTransactionService.transfer`, **sem gate de aprovação do Core**.
- `reversal-worker.ts` = reversals pending → transfer; `bank-settlement-worker.ts` = `seller_payout→bank_settlement`.
- Dormência HOJE era **só por inanição**: `createPayoutRequest`/`createBankSettlement` (producers) têm **zero
  callers de produção** (só e2e); contas `seller_available`/`seller_payout` não existem no dev. → dormência
  **acidental**, não estrutural. Risco: 1 INSERT na fila dispararia movimento em ≤10s fora do Core.
**Escopo:** apenas os **3 workers nomeados** (payout/reversal/bank-settlement). Os demais workers do BOOT
(settlement/treasury/governance/ledger-snapshot/etc.) são infra viva ou fluxos próprios — **fora do escopo, não tocados**.

## Patch

- **`src/workers/financial-worker-gate.ts` (NOVO):** `isFinancialWorkerEnabled(flag)` = `process.env[flag] === 'true'`
  **estrito / DEFAULT-OFF / fail-closed**. Variável ausente/''/'TRUE'/'1'/'yes' → **OFF**. **Sem auto-enable por
  NODE_ENV**, sem fail-open. Espelha o firewall financeiro DECISION-0110 (NÃO o `isFeatureEnabled`, que é default-ON).
- **`BOOT.ts`:** cada um dos 3 `start*Worker()` envolto em `if (isFinancialWorkerEnabled('ENABLE_{PAYOUT,REVERSAL,
  BANK_SETTLEMENT}_WORKER')) { ... } else { log DESLIGADO }`. Default-off; log seguro (não devLog).
- **Demais workers do BOOT intocados.** Nenhuma lógica de Bank/payout/reversal alterada; nenhum producer criado.

## Guard + provas

- **Guard NOVO** `scripts/audit-financial-workers-dormancy.mjs` no `validate:regression-guards`: FALHA se
  BOOT chamar qualquer dos 3 `start*Worker()` **sem** o gate `isFinancialWorkerEnabled('ENABLE_*')` imediatamente
  antes; se o helper deixar de ser default-off estrito (`=== 'true'`); se houver auto-enable por NODE_ENV ou
  fail-open (`!== 'false'`/`?? true`/`|| true`); ou se um producer (`createPayoutRequest`/`createBankSettlement`)
  aparecer em `*.routes.ts` (HTTP).
- **Negative proof** `scripts/negative-proof-financial-workers-dormancy.ps1`: reintroduz (a) start incondicional
  no BOOT, (b) gate fail-open, (c) auto-enable NODE_ENV → guard FALHA nos 3 → restauração **byte-idêntica** (SHA256).
- **E2E (unit, sem DB)** `validate-pipeline-e2e-financial-workers-dormancy.ts`: **11/11** — T1-T7 matriz default-off
  estrita (ausente/''/'false'/'TRUE'/'1'/'yes' → false; só 'true' → true); T8 guard verde; T9 payout HTTP fail-closed;
  T10 bank-http request-only; T11 baseline 0113 = 0.

| Prova | Resultado |
| --- | --- |
| e2e (unit, sem DB) | **11/11** |
| negative proof | morde start incondicional + fail-open + NODE_ENV auto-enable; restauração byte-idêntica |
| financial-workers-dormancy guard | GATE OK (no chain) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| 0113 / payout / bank-http guards | inalterados (baseline=0; fail-closed; request-only) |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum em BOOT/worker-gate) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

Não move dinheiro · não iniciou worker · `bank_ledger`/`bank_transactions`/`bank_splits` intocados · payout HTTP
continua fail-closed · bank-http continua request-only · Core EXECUTION continua HOLD · `seller_available` não
autoriza · `availableBalanceCents` não autoriza · **nenhum producer novo** · sem migration · sem reabrir
dispute/reversal · sem card authorization · sem alterar lógica de Bank.

## Ressalvas

- Os **workers ainda existem** (apenas default-off) — a execução real futura ainda exige **F-PAYOUT-EXECUTION-SEAL**.
- **`seller_available`** ainda precisa tombstone/decisão futura (não resolvido aqui).
- **reversal/bank-settlement** precisam frente própria se forem reabertos (gate criado, mas wiring/execução = futuro).
- Escopo deliberadamente restrito aos 3 workers nomeados; demais workers do BOOT (infra viva) não foram gateados.
- Baseline herdado (tsc 25 / arch 4 warning_new) pré-existente, não introduzido.

## Estado

F-FINANCIAL-WORKERS-STRUCTURAL-DORMANCY-SEAL: **IMPLEMENTED / HOLD PARA RESEAL**. Dormência dos 3 workers
financeiros agora **estrutural** (default-off, env-gated, guarded). Core EXECUTION segue **HOLD**.
F-PAYOUT-EXECUTION-SEAL segue pendente (DECISION-0128 §16). DECISION-0113 baseline = 0 (inalterado).
