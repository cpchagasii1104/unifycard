# 2026-06-16 — F-NOMENCLATURE-SERVICE-PAYMENT-AMOUNT-CENTS

Correção cirúrgica de **nomenclatura financeira canônica**: a coluna monetária genérica `amount` (BIGINT)
de `service_payment_requests` e `service_payment_executions` passa a `amount_cents` (BIGINT), cumprindo
`07_NOMENCLATURA_CANONICA` §valores monetários (dinheiro = inteiro em centavos, sufixo OBRIGATÓRIO `_cents`,
tipo `BIGINT`, NUNCA NUMERIC/float). **Executa norma existente — não cria DECISION nova.**

## Por que agora

Sistema local/virgem, sem usuários/transações/produtos/dados reais. Janela correta para corrigir
nomenclatura estrutural financeira **antes de existir dado real** (rename puro, sem backfill).

## Anchor / Pré-flight

HEAD inicial `6b8f7cf2` · branch `rescue-structural` · dev **391/391 → 392/392**. `backend/tmpschema.ts`
(untracked, 0 refs) descartado como artefato local. Pré-flight limpo (sem sujeira material, pending=[]).

## Prova de banco vivo ANTES

- schema_migrations = 391; pending = []. Tabelas existem.
- `service_payment_requests.amount` = BIGINT · `service_payment_executions.amount` = BIGINT · sem `amount_cents`.
- **row_count = 0** em ambas → rename seguro, sem dados a preservar/backfill.

## Migration

`migrations/20260616220000_rename_service_payment_amount_to_amount_cents.sql` — forward-only, idempotente
(`RENAME COLUMN` só se `amount` existe e `amount_cents` não). Preserva BIGINT, preserva dados, sem coluna
paralela, sem NUMERIC/float, sem recriar tabela. A CHECK inline `CHECK (amount > 0)` de executions é
re-apontada AUTOMATICAMENTE pelo PG no rename → `CHECK (amount_cents > 0)` (verificado: constraint
`service_payment_executions_amount_check` = `CHECK ((amount_cents > 0))`). `service_payment_requests` não tinha
CHECK de positividade — **NÃO adicionamos** (seria mudança de invariante, fora do escopo de nomenclatura).

## Prova de banco DEPOIS

schema_migrations = **392** (+1 exato) · pending = [] · ambas tabelas: **só `amount_cents` BIGINT**, row_count=0 ·
executions CHECK = `(amount_cents > 0)` · `bank_ledger`/`bank_transactions`/`bank_splits` **intocados** (existem, 0 linhas).

## Código ajustado (escopo service_payment_*)

- **Repositories** (aliases de fachada removidos → coluna real):
  - `service-payment-request.repository.ts`: 5× `amount AS "amountCents"` → `amount_cents AS "amountCents"`; INSERT col `amount` → `amount_cents`.
  - `service-payment-execution.repository.ts`: 3× `amount AS "amountCents"` → `amount_cents AS "amountCents"`; INSERT col `amount` → `amount_cents`.
- **Callers (leitura da coluna renomeada):**
  - `service-order.service.ts`: SELECT `amount::text` → `amount_cents::text` + tipo local (campo não-usado downstream).
  - `pending-responsibilities.routes.ts`: `pr.amount,` → `pr.amount_cents AS "amountCents",` (alinha à coluna real + ao Row type já declarado `amountCents`; corrige de quebra um undefined latente).
  - `impact-overview.routes.ts`: `SUM(amount)` → `SUM(amount_cents)` (alias de saída `total` inalterado).
  - `backfill-payment-splits-to-bank.ts`: SELECT `amount::text` de service_payment_executions → `amount_cents::text` + tipo + uso (`execution.amount` → `execution.amount_cents`). `payment_splits.amount` (outra tabela) **não tocado**.
- **E2E/fixtures (coluna em INSERT INTO service_payment_requests):** 7 scripts (`actor-wallet-statement`, `camada1-dmoney`, `pe5-resolver`, `policy-engine-service-execution`, `refund-split-aware`, `refund-post-dmoney-guard`, `spr-read-authority`): `status, amount, currency` → `status, amount_cents, currency`. Variáveis JS `amount` (valor) preservadas — só o identificador SQL mudou.

Contrato externo `amountCents` **preservado** em todos os DTOs/Row types (alias na borda do mapper). Nenhum `amount` monetário reintroduzido.

## Guard + Negative-proof

- Novo `scripts/audit-service-payment-amount-cents.mjs` em `validate:regression-guards`. Morde: bare `amount <tipo>` (re)definida nas tabelas-alvo (migration nova ≠ históricos allowlistados); `amount AS "amountCents"` nos repos; INSERT com coluna bare `amount`; CHECK bare `amount > 0`; `amount_cents NUMERIC/float`. Aceita amount_cents BIGINT / `> 0` / `AS "amountCents"`. Os 2 CREATE históricos + o rename são allowlistados (origem legítima do `amount` pré-rename).
- **Negative-proof (mordeu e restaurou byte-idêntico):** (A) reintroduzido `amount AS "amountCents"` no repo de execution → GATE FAIL (exit 1) → restaurado → GATE OK. (B) migration temp com `amount BIGINT` na tabela-alvo → GATE FAIL (exit 1) → removida → GATE OK.

## E2E

- `run-spr-read-authority-ephemeral.ps1` → **9/9 verdes** (DB efêmera, FULL migrations incl. rename; SELECT amount_cents; bank/ledger/split intocados).
- `run-spr-create-authority-ephemeral.ps1` → **10/10 verdes** (T1 exercita INSERT da cobrança via repository → 201 com amount_cents; T10 bank/ledger/split intocados).
- `camada1-dmoney` / `policy-engine-service-execution`: sem harness efêmero standalone (rodam em fluxos maiores); SQL atualizado para `amount_cents`; caminho de INSERT/SELECT provado pelos 2 e2e de autoridade + tsc.

## Gates

- `validate:actor-writer-boundaries` → GATE OK.
- `validate:bank-ledger-boundaries` → GATE OK.
- `validate:regression-guards` → GATE OK (cadeia inteira + `service-payment-amount-cents`).
- `validate-architectural-patterns.mjs --strict` → **critical_new=0** (warning_new=4 pré-existente inventory-legacy).
- `tsc --noEmit` → 43 (baseline strict pré-existente; **0 erros nos arquivos da frente**).

## Escopo negativo (verificado)

NÃO tocado: payout · split · recovery · `bank_ledger`/`bank_transactions`/`bank_splits` · `payment_intents` ·
fluxo de liquidação · semântica de saldo · permission grants · operador de agenda · frontend · `payment_splits.amount`
(outra tabela). Nenhuma lógica financeira alterada — apenas o **nome físico** da coluna. Dados não movidos (row_count=0).

## Estado

**IMPLEMENTED / HOLD YALA.** Fecha SÓ como **F-NOMENCLATURE-SERVICE-PAYMENT-AMOUNT-CENTS**. dev 392.
`DT-SERVICE-PAYMENT-AMOUNT-CENTS-NOMENCLATURE` → IMPLEMENTED_AS_NOMENCLATURE_BASELINE / HOLD YALA. **Aguarda reseal Yala.**
