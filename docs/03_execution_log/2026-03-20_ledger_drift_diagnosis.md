# Diagnóstico LEDGER_DRIFT_DETECTED (sem reset de banco)

**Modo:** EXECUTOR  
**Escopo:** Somente leitura (SELECT) e leitura de código. Sem DELETE, sem migrations, sem alteração de domínio.

## Onde o erro é lançado

- **`checkLedgerIntegrity`** em `backend/src/core/observability/ledger-integrity-monitor.ts`: compara soma global de `amount_cents` com `direction = 'debit'` vs `direction = 'credit'` em `bank_ledger`; se `debit !== credit`, lança `Error('LEDGER_DRIFT_DETECTED')`.
- **`getFinancialHealth`** chama `checkLedgerIntegrity` antes de métricas → `/internal/financial/health` retorna 500 quando há drift.
- **`reconciliation-worker`** e **`financial-operations-monitor`** apenas logam o mesmo tipo de divergência (não alteram dados).

## Regra violada

**Partidas dobradas globais no ledger:** a soma de todos os débitos deve ser **igual** à soma de todos os créditos na tabela `bank_ledger`. Não é verificação de `bank_splits` vs `bank_transactions` nesse ponto (é invariante só do ledger).

## Estado medido no banco (execução local)

| Métrica | Valor |
|--------|--------|
| `total_debit` | 1_080_000 centavos |
| `total_credit` | 101_080_000 centavos |
| `drift_cents` (debit − credit) | **−100_000_000** |

## Registros inconsistentes

Duas transações em `bank_transactions` têm **apenas linha(s) de crédito** em `bank_ledger` e **nenhuma linha de débito** (por `transaction_id`):

| `bank_transactions.id` | `bank_ledger` (linhas) | Débito | Crédito | `reference_type` |
|-------------------------|-------------------------|--------|---------|------------------|
| `0c0a5769-96c3-4a3e-8281-862c974fad5b` | 1 linha `0404acd1-6fca-42ec-92d2-a63922f4f926` | 0 | 50_000_000 | `e2e_system_liquidity_mint` |
| `3ca70ec8-ffcb-4cdc-903d-6005dde109c8` | 1 linha `7fc2bc6d-9a13-4f59-81d4-bb501d4f53e0` | 0 | 50_000_000 | `e2e_system_liquidity_mint` |

Campos comuns às duas transações:

- `tenant_id`: `fbe13b78-4516-493d-905a-363796aea1d1`
- `actor_id`: `c067b8b8-22c7-4471-b4be-86a0e36ffae7`
- `account_id` / crédito em ledger: `61e895b3-a3a0-4b5c-b807-bea7ab576205`
- `amount_cents`: 50_000_000
- `purpose`: `execution`
- `justification`: texto E2E de mint de coverage
- `bank_splits`: **0 linhas** (não é a causa do drift global; o problema é falta do débito espelho no ledger)

## Classificação

- **BUG DE DADO** (mais provável): entradas de ledger incompletas para o fluxo de mint E2E — crédito postado sem contrapartida em débito (ex.: conta de sistema / passivo de emissão).
- A função de verificação **`checkLedgerIntegrity` está coerente** com a regra de partidas dobradas; não é “falso positivo” da invariante.
- **Causa provável:** rota/script que grava `reference_type = e2e_system_liquidity_mint` persistiu só um lado do par débito/crédito em `bank_ledger`.

## Artefato de apoio

Script de diagnóstico (somente SELECT): `docs/_scratch/investigate_ledger_drift.ts`
