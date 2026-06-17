-- ============================================================
-- F-NOMENCLATURE-SERVICE-MONEY-07-CLOSURE
-- Alinha nomenclatura/tipos de DINHEIRO·CURRENCY·STATUS do domínio de serviços ao
-- 07_NOMENCLATURA_CANONICA, SEM mudar regra de negócio, SEM mover dinheiro.
--
-- Norma aplicada:
--   §4.7  "Valores Monetários": dinheiro = inteiro em centavos, sufixo `_cents`, tipo BIGINT
--         (NÃO INTEGER, NUNCA NUMERIC/float).
--   §4.10 "Moeda (Currency)": ISO 4217, 3 letras, VARCHAR(3)/CHAR(3); `FIC` NÃO é moeda canônica
--         (ausente de todo docs/01_normative). Service payment MVP = BRL.
--   §3.4  "Ambiguidade Semântica": `status` genérico isolado é proibido em DB/contrato; usar nome
--         de domínio (`payment_request_status`), à imagem de `payment_intents.payment_status`.
--
-- Janela: sistema local/virgem (row_count=0 em service_payment_requests, service_payment_executions,
-- services — verificado antes). Forward-only, idempotente. NÃO cria coluna paralela, NÃO recria
-- tabela, NÃO usa NUMERIC/float, NÃO altera amount_cents (já BIGINT), NÃO toca bank_*/payment_intents.
-- Preserva PK/FKs/índices/RLS/UNIQUE (RENAME/ALTER TYPE não os derruba).
--
-- ESCOPO NEGATIVO: bank_ledger / bank_transactions / bank_splits / payout / split / recovery /
-- payment_intents / D-money / release / liquidação / saldo / grants / agenda / services.status
-- (lifecycle do serviço, fora do escopo de dinheiro) — INTOCADOS.
-- ============================================================

BEGIN;

-- ── 1) service_payment_requests.status -> payment_request_status (07 §3.4) ──────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_requests' AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_requests' AND column_name = 'payment_request_status'
  ) THEN
    ALTER TABLE service_payment_requests RENAME COLUMN status TO payment_request_status;
  END IF;
END $$;

-- 1b) constraint de status segue o nome do domínio (CHECK re-aponta sozinho na coluna renomeada).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_payment_requests_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_payment_requests_payment_request_status'
  ) THEN
    ALTER TABLE service_payment_requests
      RENAME CONSTRAINT chk_service_payment_requests_status
      TO chk_service_payment_requests_payment_request_status;
  END IF;
END $$;

-- ── 2) service_payment_requests.currency: VARCHAR(10) DEFAULT 'FIC' -> VARCHAR(3) DEFAULT 'BRL' (07 §4.10) ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_requests' AND column_name = 'currency'
      AND (data_type <> 'character varying' OR character_maximum_length <> 3)
  ) THEN
    ALTER TABLE service_payment_requests
      ALTER COLUMN currency TYPE VARCHAR(3) USING currency::varchar(3);
  END IF;
END $$;

ALTER TABLE service_payment_requests ALTER COLUMN currency SET DEFAULT 'BRL';

-- 2b) CHECK currency = 'BRL' (service payment MVP; relaxável em frente multi-moeda futura).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_payment_requests_currency_brl'
  ) THEN
    ALTER TABLE service_payment_requests
      ADD CONSTRAINT chk_service_payment_requests_currency_brl CHECK (currency = 'BRL');
  END IF;
END $$;

-- ── 3) service_payment_executions.currency: TEXT -> VARCHAR(3) (07 §4.10) ───────────────────
--    Execução já é BRL-fail-closed em runtime (service-payment-execution.service.ts) — CHECK seguro.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_payment_executions' AND column_name = 'currency'
      AND (data_type <> 'character varying' OR character_maximum_length <> 3)
  ) THEN
    ALTER TABLE service_payment_executions
      ALTER COLUMN currency TYPE VARCHAR(3) USING currency::varchar(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_payment_executions_currency_brl'
  ) THEN
    ALTER TABLE service_payment_executions
      ADD CONSTRAINT chk_service_payment_executions_currency_brl CHECK (currency = 'BRL');
  END IF;
END $$;

-- ── 4) services.price_cents: INTEGER -> BIGINT (07 §4.7 — dinheiro é BIGINT, não INTEGER) ────
--    Preserva nome price_cents, dados, e a CHECK services_price_positive (sobrevive ao ALTER TYPE).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'price_cents' AND data_type = 'integer'
  ) THEN
    ALTER TABLE services ALTER COLUMN price_cents TYPE BIGINT USING price_cents::bigint;
  END IF;
END $$;

COMMIT;
