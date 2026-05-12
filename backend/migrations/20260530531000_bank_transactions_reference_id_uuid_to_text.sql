-- ============================================================
-- C19 FIX: bank_transactions.reference_id UUID → TEXT
-- §Nomenclatura: reference_id como identificador composto/heterogeneo
-- ============================================================
--
-- CONTEXTO:
--   Schema vivo de bank_transactions.reference_id era UUID (0003_bank_core.sql:54).
--   18 tabelas com coluna reference_id no banco: 7 UUID, 10 TEXT (drift cross-table).
--   Tipo TS (bank-transaction.types.ts:78) ja era `string`.
--   Schema Zod (transaction.schemas.ts:13) ja era `z.string().min(1)`.
--
--   Callers passam strings nao-UUID por design:
--     - governance-funding: `governance_funding:${proposalId}`
--     - treasury-split: `${settlementId}_regional_fund`
--     - payout: `${paymentIntentId}:${split.id}`
--     - accounts-payable: `manual-${Date.now()}`
--
--   Sistema funciona hoje (4 registros sao UUIDs puros) mas qualquer execucao
--   real de governance-funding/treasury-split/payout crasha com:
--     `invalid input syntax for type uuid`
--
-- TABELA AFETADA:
--   - bank_transactions (coluna reference_id)
--
-- DEPENDENCIAS AUDITADAS:
--   - Sem CHECK constraint em reference_id
--   - UNIQUE composto `uq_bank_transactions_reference` (tenant_id, reference_type, reference_id)
--     sobrevive ALTER TYPE (Postgres rebuild automatico)
--   - Triggers BEFORE INSERT (trg_check_atl, trg_validate_purpose) nao tocam reference_id
--   - 20 FKs apontam para bank_transactions.id, nenhuma para reference_id
--
-- DADOS EXISTENTES:
--   - 4 registros, todos UUIDs validos
--   - Continuam validos como TEXT (cast trivial UUID→TEXT preserva representacao)
--
-- IDEMPOTENCIA:
--   - Verifica se reference_id ja e text antes de alterar
--
-- DECISION: DECISION-0029 (Opcao A - schema fix UUID→TEXT)
-- ============================================================

BEGIN;

DO $$
DECLARE
  current_type TEXT;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'bank_transactions'
    AND column_name = 'reference_id';

  IF current_type IS NULL THEN
    RAISE EXCEPTION 'C19 FIX: coluna bank_transactions.reference_id nao existe';
  END IF;

  IF current_type = 'text' THEN
    RAISE NOTICE 'C19 FIX: reference_id ja e text. Nenhuma acao necessaria.';
    RETURN;
  END IF;

  IF current_type = 'uuid' THEN
    ALTER TABLE bank_transactions
      ALTER COLUMN reference_id TYPE TEXT USING reference_id::text;
    RAISE NOTICE 'C19 FIX: bank_transactions.reference_id alterada de uuid para text.';
  ELSE
    RAISE EXCEPTION 'C19 FIX: tipo inesperado para reference_id: %', current_type;
  END IF;
END $$;

COMMENT ON COLUMN bank_transactions.reference_id IS
  'Referencia externa heterogenea (UUID, composto, ou semantico). UNIQUE(tenant_id, reference_type, reference_id) garante idempotencia. C19 (DECISION-0029): TEXT alinha com 10 outras tabelas adjacentes (financial_*, payment_intents, treasury_distributions, etc).';

COMMIT;
