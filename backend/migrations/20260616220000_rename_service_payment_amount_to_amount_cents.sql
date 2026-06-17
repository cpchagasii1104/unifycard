-- ============================================================
-- F-NOMENCLATURE-SERVICE-PAYMENT-AMOUNT-CENTS
-- Corrige nomenclatura financeira canônica (07_NOMENCLATURA_CANONICA §"valores monetários":
-- dinheiro = inteiro em centavos, sufixo OBRIGATÓRIO `_cents`, tipo BIGINT, NUNCA NUMERIC/float).
-- ============================================================
-- Renomeia a coluna monetária genérica `amount` (BIGINT) para `amount_cents` (BIGINT) em:
--   1. service_payment_requests
--   2. service_payment_executions
--
-- Janela: sistema local/virgem, sem dados reais (row_count=0 nas duas tabelas, verificado antes).
-- RENAME puro — preserva tipo BIGINT, preserva dados (mesmo com 0 linhas), NÃO cria coluna paralela,
-- NÃO recria tabela, NÃO usa NUMERIC/decimal/float.
--
-- A CHECK inline `CHECK (amount > 0)` de service_payment_executions é re-apontada AUTOMATICAMENTE
-- pelo PostgreSQL no RENAME COLUMN — passa a ler `amount_cents > 0` sem recriação manual.
-- service_payment_requests NÃO tinha CHECK de positividade — NÃO adicionamos um novo (seria mudança
-- de semântica/invariante, fora do escopo de nomenclatura).
--
-- ESCOPO NEGATIVO: NÃO toca bank_ledger / bank_transactions / bank_splits / payout / split / recovery /
-- payment_intents / fluxo de liquidação / semântica de saldo. Apenas o NOME físico da coluna.
--
-- Reversibilidade: ALTA (RENAME inverso). Blast: BAIXO (2 colunas, 0 linhas).
-- Forward-only, idempotente (só renomeia se `amount` existe e `amount_cents` ainda não).
-- ============================================================

BEGIN;

-- 1) service_payment_requests.amount -> amount_cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_requests' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_requests' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE service_payment_requests RENAME COLUMN amount TO amount_cents;
  END IF;
END $$;

-- 2) service_payment_executions.amount -> amount_cents
--    (a CHECK (amount > 0) inline acompanha o rename → vira amount_cents > 0)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_executions' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_executions' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE service_payment_executions RENAME COLUMN amount TO amount_cents;
  END IF;
END $$;

COMMIT;
