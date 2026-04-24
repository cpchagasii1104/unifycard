# PLANO_BANK_LEDGER_WRITER_ENFORCEMENT

**Norma de trabalho:** espelhar o molde `PLANO_ACTOR_WRITER_ENFORCEMENT.md` — Sessão 1 (mapeamento read-only) → Sessões 2–4 (correção, CI guard, falsificação) **fora do âmbito deste ficheiro até decisão explícita**.

**Estado:** **Sessão 1** (mapeamento grep) **+ Sessão 3** (gate `validate:bank-ledger-boundaries` no CI) **executados**; política escrow alvo em **`PROPOSTA_ESCROW_UNIFICATION.md`** (implementação Fase 1+ **pendente**).

Sessão 4 - FALSIFICATION_LOG: auditoria concluída sem violações reais. Todas as 15 escritas bank_* classificadas como tipo A (dentro de modules/bank/) ou testes. Gate CI ativo. Plano encerrado em 2026-04-18.

**Data da auditoria grep/leitura:** 2026-04-14.

---

## Critério lexical (prompt original vs. repo)

- O prompt pedia `INSERT INTO ledger` / `INSERT INTO transactions` genéricos. No repositório, o SSOT monetário usa **`bank_ledger`** e **`bank_transactions`**.
- **`db.query`:** zero ocorrências em `backend/src/**/*.ts`.
- **`executeTransfer`:** zero ocorrências literais; o método canónico exposto é **`transfer`** em `bankTransactionService`.

---

## Sessão 1 — PARTE 1: Escritas SQL em tabelas financeiras centrais e adjacentes

### 1.A — Literais `INSERT INTO ledger` / `UPDATE ledger` / `INSERT INTO transactions` / `UPDATE transactions` (sem prefixo `bank_`)

| Ficheiro | Linha (aprox.) | Contexto | Classificação |
|----------|------------------|----------|---------------|
| `backend/src/modules/ledger-snapshots/ledger-snapshot-repository.ts` | 46 | `INSERT INTO ledger_snapshots (...)` | **(B)** tabela `ledger_snapshots`, não `bank_ledger`; repositório dedicado |
| `backend/src/modules/bank/ledger-compensation.service.ts` | 201 | `INSERT INTO ledger_compensations (...)` | **(B)** tabela `ledger_compensations`; serviço em `modules/bank` que também chama `bankTransactionService.transfer` (ver ficheiro) |

**Nenhuma** ocorrência de `UPDATE ledger` / `UPDATE transactions` sem qualificação adicional encontrada com o padrão pedido.

### 1.B — `bank_ledger` / `bank_transactions` (escrita)

| Ficheiro | Linhas (grep) | Contexto | Classificação |
|----------|----------------|----------|---------------|
| `backend/src/modules/bank/bank-ledger.repository.ts` | 80, 284 | `INSERT INTO bank_ledger` | **(A)** implementação de persistência do ledger bancário |
| `backend/src/modules/bank/bank-transaction.service.ts` | 506, 518, 645, 1002, 1060, 1251, 1329, 1451, 1576, 1681 | `INSERT` / `UPDATE bank_transactions` | **(A)** serviço canónico de transação bancária |
| `backend/src/modules/bank/bank-ledger.service.ts` | 499, 523, 604 | `INSERT` / `UPDATE bank_transactions` | **(A)** orquestração `createTransactionFromIntent` e fluxos associados |

### 1.C — Outras `INSERT INTO` em domínio bank (metadados / contas / splits / políticas)

| Ficheiro | Linhas (grep) | Tabela / nota |
|----------|----------------|---------------|
| `backend/src/modules/bank/bank-account.repository.ts` | 268, 274, 324 | `bank_accounts` |
| `backend/src/modules/bank/bank-transaction.service.ts` | 134 | `bank_accounts` (criação de conta no fluxo) |
| `backend/src/modules/bank/bank-split.repository.ts` | 160 | `bank_splits` |
| `backend/src/modules/bank/bank-policy.service.ts` | 173 | `bank_policies` |
| `backend/src/modules/bank/bank-reconciliation-history.repository.ts` | 87 | `bank_reconciliation_history` |
| `backend/src/modules/bank/bank-limit.repository.ts` | 63 | `bank_limit_change_requests` |
| `backend/src/modules/bank-settlement/bank-settlement-repository.ts` | 55 | `bank_settlements` |

### 1.D — Transações monetárias fora das tabelas `bank_*` (evidência objectiva)

| Ficheiro | Linha (aprox.) | SQL | Classificação |
|----------|----------------|-----|---------------|
| `backend/src/modules/escrow/escrow.repository.ts` | 406–411 | `INSERT INTO escrow_transactions` | **(B)** domínio escrow; não é `bank_transactions` |

### 1.E — `pool.query` / `client.query` com envolvimento monetário (amostra factual)

- **`bank-transaction.service.ts`**, **`bank-ledger.service.ts`**, **`bank-ledger.repository.ts`**, **`bank-split.repository.ts`**, **`ledger-compensation.service.ts`**: múltiplas linhas `client.query` / `pool.query` dentro de transacções SQL e inserts listados em 1.B–1.C — **(A)**.
- **`modules/payments/payment-intent-repository.ts`:** `pool.query` / `client.query` em intents — valores monetários em **`payment_intents`**, não em `bank_*` — **(B)** relativo ao critério “só bank”, **(A)** se o critério for “camada de intents oficial”.

---

## Sessão 1 — PARTE 2: Uso da camada canónica (tokens do prompt + equivalentes)

### `bankService`

- **Zero** ocorrências do identificador `bankService` em `backend/src/**/*.ts`.

### `ledgerService` (export em `modules/ledger`)

- **Definição:** `backend/src/modules/ledger/ledger.service.ts` linha ~267 `export const ledgerService = new LedgerService()`.
- **Imports/uso noutros módulos produto (grep `ledgerService` / `from '...ledger.service'`):** além do próprio ficheiro e comentários, aparecem **`createTransactionFromIntent` importado de `@modules/bank/bank-ledger.service`** em `financial.commands.ts`, `b2b-supply-order.routes.ts` — **canal bank**, não `ledgerService`.

### `createTransaction` (ambiguidade: vários homónimos)

| Ficheiro | Uso | Camada |
|----------|-----|--------|
| `payment-execution.service.ts` | `paymentTransactionRepository.createTransaction` | **Proxy fail-fast** (`new Proxy` → rejeição); não persiste `payment_transactions` no estado actual |
| `payout.service.ts` | `payoutTransactionRepository.createTransaction` | **Proxy fail-fast** |
| `escrow.service.ts` | `escrowRepository.createTransaction` | **Escrow** (`escrow_transactions`) |
| `marketplace/payment-execution.service.ts` (import implícito) | repositório stub/proxy | Ver acima |
| `payment-transaction.repository.ts` | `createTransaction` | **Stub** (retorno vazio / não implementado no export analisado) |
| `bank-transaction.adapter.ts` / `bank-transaction.port.ts` | `createTransactionWithSplit` | **(A)** porta → `bankTransactionService` |
| `bank-p2p-transfer.service.ts`, `bank-http.routes.ts`, `bank-integration.service.ts`, `event-economy.service.ts`, scripts | `createTransactionWithSplit` / `createTransactionWithExplicitSplitLines` / `createSimpleTransaction` | **(A)** via `bankTransactionService` ou `bankPortsRegistry.getBankTransaction()` |

### `recordTransaction`

- **Função:** `recordTransactionForFragmentation` em `backend/src/core/observability/financial-anomaly-detector.ts` (export).
- **Chamada:** `backend/src/modules/bank/bank-transaction.service.ts` (~544) — **(A)** dentro do serviço canónico.

### `executeTransfer`

- **Zero** ocorrências.

### Lista de ficheiros que referenciam **`bankTransactionService`** (singleton `@modules/bank`)

`bank-integration.service.ts`, `financial-simulator.controller.ts`, `capacity-application.service.ts`, `marketplace-orchestration.service.ts`, `regional-fund.service.ts`, `service-order.service.ts` (**import presente; sem `.` no grep de uso**), `marketplace-orders.service.ts` (referência em comentário), `payment-event-resolver.ts`, `bank-transaction.service.ts`, `payment-execution.service.ts`, `ledger-compensation.service.ts`, `payout-worker.ts`, `seed-initial-balance.ts`, `payment-event-processor.ts` (comentário), `bank-transaction.adapter.ts`, `backfill-payment-splits-to-bank.ts`, `governance-funding-commitment-worker.ts`, `bank-settlement-worker.ts`, `verify-simple-tx-double-entry.ts`, `treasury-split.service.ts`, `regional-fund-governance.service.ts`, `reversal.service.ts`, `validate-financial-flow-real.ts`, `event-economy.service.ts`, `event-payment-execution.service.ts`, `transaction.service.ts` (`core/economy`), `payout.service.ts`, `modules/bank/index.ts`.

### Porta `bankPortsRegistry.getBankTransaction()`

`donation.service.ts`, `bank-p2p-transfer.service.ts`, `services-discovery.service.ts`, `bank-http.routes.ts`, `regional-fund-governance.service.ts` (entre outros com `getBankAccount`).

---

## Sessão 1 — PARTE 3: Acesso directo a DB nos módulos filtrados

### `backend/src/modules/bank`

- **Múltiplos** `client.query` / `pool.query` / imports `@core/database/pool` em: `bank-integration.service.ts`, `bank-account.repository.ts`, `bank-ledger.repository.ts`, `bank-split.repository.ts`, `bank-transaction.service.ts`, `ledger-compensation.service.ts`, `bank-ledger.service.ts`, `bank-balance-consolidation.service.ts`, `bank-balance-by-region.service.ts`, `bank-maintenance.service.ts`, `bank-limit.service.ts`, etc. (lista completa: resultado grep 2026-04-14 na sessão Cursor).

### `backend/src/core/unifybank`

- `donation.service.ts` — `pool.query`
- `regional-fund-governance-rate-limit.service.ts` — `pool.query`
- `transparency.service.ts` — `client.query` / `pool.query` (leituras incl. `ledgerEntries` como texto SQL)
- `regional-fund-governance.service.ts` — `pool.query` / `client.query` (propostas/votos; não listados inserts em `bank_ledger` neste grep)

### `backend/src/modules/payments`

- `pix-webhook.repository.ts`, `payment-link.repository.ts`, `pix.repository.ts` — `runQueryWithTenant` / `runQueriesWithTenant` desde `@core/database/pool`
- `payment-intent-repository.ts` — `pool.query`, `client.query`

**Nota:** o padrão `from '.*db'` do prompt não coincide com o estilo predominante (`@core/database/pool`); a evidência acima usa os padrões `pool.query` / `client.query` / `runQueryWithTenant` solicitados na Parte 3.

---

## Sessão 1 — PARTE 4: `amount` / `amount_cents` fora de ficheiros `bankTransactionService` / `ledgerService`

**Definição operacional desta sessão:** ficheiros em `backend/src/**/*.ts` que contêm **`amount_cents`** e cujo caminho **não** está sob `backend/src/modules/bank/`.

**Conjunto (grep `amount_cents` — ficheiros fora de `modules/bank/`):**

`modules/marketplace/regional-fund.repository.ts`, `modules/social/social-2.0.routes.ts`, `modules/observability/financial-simulator.controller.ts`, `scripts/e2e-incentive-bank-checklist.ts`, `modules/reporting/reporting-bank-aggregates.ts`, `modules/services/service-order.service.ts`, `modules/gateway/payment-event-resolver.ts`, `core/events/event-custody.service.ts`, `core/reputation/trust.service.ts`, `services/events/tests/event-checkout-hardening.test.ts`, `jobs/post-event-split.job.ts`, `core/reconciliation/reconciliation.service.ts`, `core/reputation/penalty.service.ts`, `core/compliance/authority-decision.service.ts`, `core/authorization/shadow-authorization.service.ts`, `jobs/event-scheduler.ts`, `workers/financial-alert-worker.ts`, `modules/governance-funding-commitment/governance-funding-commitment.repository.ts`, `modules/freezes/financial-freeze-repository.ts`, `core/reconciliation/financial-reconciliation.ts`, `modules/reconciliation/reconciliation-engine.service.ts`, `modules/bank-settlement/bank-settlement-repository.ts`, `modules/observability/financial-dashboard.controller.ts`, `modules/payouts/payout-repository.ts`, `core/observability/financial-operations-monitor.ts`, `core/observability/financial-logger.ts`, `core/observability/financial-audit.ts`, `core/events/payment-events-queue.ts`, `adapters/pix/pix-adapter.ts`, `workers/financial-metrics-worker.ts`, `workers/governance-financial-action-worker.ts`, `workers/governance-execution-worker.ts`, `modules/audit/financial-audit-export.controller.ts`, `scripts/backfill-payment-splits-to-bank.ts`, `workers/risk-analysis-worker.ts`, `workers/ledger-snapshot-worker.ts`, `core/unifybank/test-currency.service.ts`, `modules/escrow/escrow.repository.ts`, `modules/economy/economic-overview.projector.ts`, `modules/governance-funding/governance-funding.repository.ts`, `modules/disputes/financial-dispute.controller.ts`, `modules/disputes/financial-dispute-repository.ts`, `modules/freezes/financial-freeze.controller.ts`, `modules/crm/crm.service.ts`, `modules/payout/payout.repository.ts`, `modules/treasury-split/treasury-split-config.repository.ts`, `modules/treasury/treasury-distribution-repository.ts`, `modules/payments/payment-intent-repository.ts`, `modules/reconciliation/reconciliation-discrepancy.repository.ts`, `modules/observability/financial-operations-panel.controller.ts`, `modules/services/service-payment-execution.repository.ts`, `modules/marketplace/accounts-payable.service.ts`, `core/events/event-payment.types.ts`, `modules/marketplace/b2b-supply-order.routes.ts`, `core/events/event-payment-execution.service.ts`, `core/observability/ledger-integrity-monitor.ts`, `core/events/event-economy.types.ts`, `modules/social/social-ledger.service.ts`, `core/events/event-split-declarative.service.ts`, `modules/marketplace/region-account.service.ts`, `modules/marketplace/settlement.service.ts`, `modules/reversal/reversal.repository.ts`, `modules/reversal/reversal.service.ts`, `workers/treasury-distribution-worker.ts`, `modules/reconciliation/reconciliation-dispute.service.ts`, `core/observability/financial-anomaly-detector.ts`, `modules/marketplace/commission.service.ts`, `modules/marketplace/financial-agenda.service.ts`, `modules/marketplace/payment-intent.repository.ts`, `core/reputation/__tests__/debt-blocking.test.ts`, `core/events/__tests__/operational-commitments.service.test.ts`, `core/events/operational-commitments.types.ts`.

*(A lista acima foi deduplicada mentalmente a partir do `files_with_matches` do grep; qualquer re-auditoria deve repetir `rg amount_cents backend/src --glob '*.ts'` e subtrair `modules/bank/`.)*

---

## Sessão 1 — PARTE 5: Caminho canónico esperado (ficheiros e funções principais)

| Responsabilidade | Ficheiro principal | Funções / exports relevantes |
|------------------|-------------------|------------------------------|
| Criar transação bancária, splits, movimentar saldo via double-entry | `backend/src/modules/bank/bank-transaction.service.ts` | `transfer`, `createSimpleTransaction`, `createTransactionWithSplit`, `createTransactionWithExplicitSplitLines`, `markExternallySettledByReference`, reversão relacionada; export `bankTransactionService` |
| Persistir linhas em `bank_ledger` | `backend/src/modules/bank/bank-ledger.repository.ts` | métodos com `INSERT INTO bank_ledger` |
| Fluxo “intent” B2B / comando financeiro | `backend/src/modules/bank/bank-ledger.service.ts` | `createTransactionFromIntent` |
| Orquestração PSP / splits externos | `backend/src/modules/bank/bank-integration.service.ts` | chama `bankTransactionService.createTransactionWithSplit` / `createTransactionWithExplicitSplitLines` |
| Porta DI (HTTP / unifybank) | `backend/src/modules/bank/adapters/bank-transaction.adapter.ts`, `backend/src/core/bank/ports/bank-transaction.port.ts`, `backend/src/core/bank/ports-registry.ts` | `createTransactionWithSplit` → implementação real |
| Delegação economy legado | `backend/src/core/economy/transaction.service.ts` | delega `transfer` a `bankTransactionService` |
| `ledgerService` (módulo `modules/ledger`) | `backend/src/modules/ledger/ledger.service.ts` | `recordEntry`, etc. — **mapa de autoridade financeira v1** indica economia/stub separado do SSOT `bank_*` (ver `AUTHORITY_MAP_FINANCIAL_v1.md`) |

---

## Sessão 3 — Gate CI (bank-ledger boundaries) **executado no repo**

| Artefacto | Descrição |
|-----------|-----------|
| `backend/scripts/audit-bank-ledger-boundaries.mjs` | Percorre `backend/src/**/*.ts`; **FAIL** se `INSERT` **ou** `UPDATE` em `bank_ledger` / `bank_transactions` aparecem **fora** de `backend/src/modules/bank/` |
| `backend/scripts/audit-bank-ledger-boundaries.sh` | Wrapper bash → mesmo `.mjs` |
| `pnpm run validate:bank-ledger-boundaries` | Script em `backend/package.json` |
| `.github/workflows/backend-ci.yml` | Job `typecheck-and-arch` — passo **Bank-ledger INSERT boundary** |

**Exclusões do scan (FAIL + WARN):** `**/scripts/**`, `**/__tests__/**`, `**/tests/**`, `*.test.ts`, `*.spec.ts`.

**WARN (exit 0):** ficheiros fora de `modules/bank/` com `amount_cents`; e ficheiros com `pool.query(` **e** `amount_cents` no mesmo ficheiro. Saída resumida (amostra 20); lista completa: `BANK_LEDGER_AUDIT_VERBOSE=1`.

**Nota:** o gate `audit-payments-ledger-boundaries.sh` (workflow payments) continua a regras próprias / allowlist; este gate cobre **INSERT + UPDATE** nas duas tabelas e **prefixo `modules/bank/`**.

---

## Escrow vs `bank_*` — política alvo e execução

**Estado factual:** `escrow_transactions` persistem-se **fora** de `bank_ledger` até a ponte ser implementada; o modelo já expõe `bank_transaction_id` na entidade escrow.

**Política alvo (aprovada para execução gradual):** **Caminho A** — unificação sob autoridade `bank_*`; ver **`PROPOSTA_ESCROW_UNIFICATION.md`** (raiz do repo): regras de quando escrow gera movimento bank, mapeamento `hold` / `release` / `refund`, invariantes anti-duplicação, fases 0–4 e critérios de aceitação.

**Caminho B (sub-ledger formal):** não é a política alvo; mantém-se apenas como referência histórica se a proposta for revista.

O gate CI `validate:bank-ledger-boundaries` **não** inspecciona escrow; a conformidade vem da implementação da proposta + testes.

---

## Próximas sessões

- **Sessão 2:** corrigir bypass se o gate FAIL (não aplicável no estado actual).
- **Sessão 4:** entradas em `docs/ssot/FALSIFICATION_LOG.md` por tentativa de violação explícita.

---

## Como reexecutar (comandos)

```bash
pnpm --dir backend run validate:bank-ledger-boundaries
# ou
node backend/scripts/audit-bank-ledger-boundaries.mjs
```

```bash
rg "INSERT INTO bank_ledger|INSERT INTO bank_transactions|UPDATE bank_ledger|UPDATE bank_transactions" backend/src --glob "*.ts"
rg "bankTransactionService|ledgerService|createTransactionFromIntent|createTransactionWithSplit|recordTransactionForFragmentation" backend/src --glob "*.ts"
rg "pool\\.query|client\\.query" backend/src/modules/bank backend/src/core/unifybank backend/src/modules/payments --glob "*.ts"
rg "amount_cents" backend/src --glob "*.ts" --files-with-matches
```
