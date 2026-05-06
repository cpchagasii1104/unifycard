# Cursor — 5 passos: estado real do sistema (para orquestrador)

**MODO:** EXECUTOR  
**Data:** 2025-03-15  
**Objetivo:** Provar estado real da Financial Chaos Suite e dependências para destravar correções e Observability Layer.

---

## PASSO 1 — Estrutura real da suite

**Comando executado:** listagem recursiva de `backend/tests/financial-chaos` (Glob + grep para contagem de testes).

### Arquivos

```
backend/tests/financial-chaos/
├── README.md
├── helpers.ts
├── idempotency.spec.ts      (testes 1–5)
├── race-conditions.spec.ts  (testes 6–9)
├── ledger-integrity.spec.ts (testes 10–13)
├── reconciliation.spec.ts   (testes 14–17)
└── security.spec.ts         (testes 18–20)
```

### Contagem de testes

| Bloco              | Arquivo               | Testes | Números |
|--------------------|------------------------|--------|---------|
| BLOCO 1 — Idempotência | idempotency.spec.ts     | 5  | 1–5  |
| BLOCO 2 — Race conditions | race-conditions.spec.ts | 4  | 6–9  |
| BLOCO 3 — Ledger integrity | ledger-integrity.spec.ts | 4 | 10–13 |
| BLOCO 4 — Reconciliação | reconciliation.spec.ts   | 4  | 14–17 |
| BLOCO 5 — Segurança | security.spec.ts         | 3  | 18–20 |
| **Total**          |                        | **20** |       |

**Confirmado:** 20 testes em 5 blocos, conforme bootstrap.

---

## PASSO 2 — Script de execução

**Fonte:** `backend/package.json`

```json
"test:financial-chaos": "node --experimental-vm-modules node_modules/jest/bin/jest.js tests/financial-chaos"
```

Como rodar: no diretório `backend`, executar `pnpm run test:financial-chaos`.

---

## PASSO 3 — Estado das migrations

**Comando:** listagem de `backend/migrations`.

### Genesis (0001–0005) — intacto

- `0001_extensions.sql`
- `0002_identity.sql`
- `0003_bank_core.sql`
- `0004_marketplace.sql`
- `0005_events.sql`

### Forward-only (0006+)

Presentes entre outras: `0006_forward_only_lock.sql`, `0007_system_functions.sql`, … até `0026_reconciliation_discrepancies.sql`.  
Genesis não foi alterado; correções apenas via migrations posteriores.

---

## PASSO 4 — Resultado da Chaos Suite

**Comando:** `pnpm run test:financial-chaos` (em `backend`).

### Resumo

- **Test Suites:** 5 failed, 5 total  
- **Tests:** 20 failed, 20 total  
- **Tempo:** ~20 s  

### Causa raiz única

Todos os 20 testes falham no **setup** (`createChaosTestContext` → `BankAccountService.ensurePlatformAccounts` → `BankAccountRepository.getAccountByOwnerAndType`):

```
error: coluna "account_id" não existe
```

A query em `BankAccountRepository` usa:

```sql
SELECT account_id, tenant_id, owner_id, owner_type, account_type, currency,
       cached_balance, metadata, createdAt, updatedAt
FROM bank_accounts
WHERE ...
```

No banco atual a tabela `bank_accounts` **não tem coluna `account_id`** (provavelmente a PK é `id`). Ou seja: **código (repositório) desalinhado ao schema real**.

### Onde corrigir

- **Arquivo:** `backend/src/modules/bank/bank-account.repository.ts` (query em `getAccountByOwnerAndType`, por volta da linha 111).
- **Schema real (Genesis 0003_bank_core.sql):** `bank_accounts` tem PK `id` (não `account_id`), e colunas: `id`, `tenant_id`, `actor_id`, `owner_type`, `owner_id`, `account_type`, `credit_status`, `last_activity_at`, `inactive_since`, `expires_at`, `created_at`. Não existem no banco: `account_id`, `cached_balance`, `metadata`, `currency`, `createdAt`, `updatedAt`.
- **Ação:** Alinhar o repositório ao schema real: no SELECT usar `id` (e mapear para accountId no tipo), e apenas colunas que existem; ou adicionar uma migration forward-only (ex.: 0027) que inclua colunas/aliases necessários sem alterar 0001–0005.

### Blocos afetados

- Idempotência (1–5): falha no beforeAll/setup  
- Race conditions (6–9): idem  
- Ledger integrity (10–13): idem  
- Reconciliação (14–17): idem  
- Segurança (18–20): idem  

Nenhum teste chegou a rodar lógica de negócio; todas as falhas são no contexto de criação de contas/tenant.

---

## PASSO 5 — Estrutura do UnifyBank (core)

**Comandos:** listagem de `backend/src/core` e `backend/src/core/unifybank`.

### `backend/src/core` (amostra relevante)

Contém, entre outros: `unifybank/`, `economy/`, `events/`, `db/`, `observability/`, etc.

### `backend/src/core/unifybank/` (conteúdo atual)

| Arquivo | Tipo |
|---------|------|
| `unifybank.module.ts` | Módulo |
| `bank-p2p-transfer.service.ts` | Serviço |
| `bank-p2p-transfer.routes.ts` | Rotas |
| `transparency.service.ts` | Serviço |
| `transparency.routes.ts` | Rotas |
| `transparency-admin.routes.ts` | Rotas |
| `donation.service.ts` | Serviço |
| `donation.routes.ts` | Rotas |
| `regional-fund-governance.service.ts` | Serviço |
| `regional-fund-governance.routes.ts` | Rotas |
| `regional-fund-governance-rate-limit.service.ts` | Serviço |
| `test-currency.service.ts` | Serviço |
| `test-currency.routes.ts` | Rotas |
| `bank-balance-consolidation.routes.ts` | Rotas |

**Não existem em `unifybank/`:**  
`coverage.service.ts`, `ledger.service.ts`, `settlement.service.ts`.  

A lógica de ledger/settlement/coverage está em **`backend/src/modules/bank/`** (bank-transaction.service, bank-ledger, payment-execution, etc.). A **Financial Observability Layer** pode ser implementada no core (ex.: `core/observability/` ou novo módulo) consumindo esses módulos, ou junto ao UnifyBank após definir o contrato em `docs/01_normative/CORE_OBSERVABILITY_CONTRACT.md`.

---

## Próximos passos recomendados (para orquestrador)

1. **Corrigir alinhamento schema/código**  
   Verificar em `0003_bank_core.sql` (ou migration que define `bank_accounts`) o nome real da PK e colunas; ajustar `bank-account.repository.ts` para usar esses nomes (ex.: `id` em vez de `account_id` no SELECT).

2. **Rodar de novo**  
   `pnpm run test:financial-chaos` após o fix; registrar resultado em `docs/03_execution_log/`.

3. **Desenhar Financial Observability Layer**  
   Com a suite passando: logs estruturados, métricas e alertas conforme bootstrap (financial_event, transaction_id, reference_type, etc.; métricas como ledger_balance_drift, duplicate_reference_attempt; alertas como ledger_drift_detected, duplicate_reference_blocked).

4. **CI**  
   Adicionar `pnpm run test:financial-chaos` ao pipeline e documentar em `docs/03_execution_log/`.

---

**Arquivo gerado:** `docs/03_execution_log/CURSOR_5_PASSOS_ESTADO_REAL_SISTEMA.md`  
**Fim do relatório.**
