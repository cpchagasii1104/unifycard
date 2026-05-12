-- ============================================================
-- C40 FIX: system_coverage.*_cents NUMERIC → BIGINT
-- §Nomenclatura: *_cents = BIGINT (capacidade monetária em centavos)
-- ============================================================
--
-- CONTEXTO:
--   system_coverage é uma VIEW (não TABLE).
--   COALESCE(SUM(...), 0) sem cast explícito faz Postgres armazenar
--   o resultado como NUMERIC (internal type widening do COALESCE).
--   Colunas *_cents devem ser BIGINT por convenção §SSOT financeiro.
--
--   Callers:
--     - e2e-incentive-bank-checklist.ts: SELECT ::text (leitura)
--     - check_coverage_before_credit trigger: INTO v_capacity BIGINT
--       (cast implícito NUMERIC→BIGINT — funcionava, agora explícito)
--
--   Zero callers escrevem na view (é read-only por definição).
--
-- FIX:
--   CREATE OR REPLACE VIEW com ::bigint após COALESCE.
--   Preserva toda a lógica de negócio (filtro liquidity_issuance,
--   separação system vs non-system).
--
-- IDEMPOTÊNCIA:
--   - Verifica se view existe
--   - Verifica se colunas já são bigint (skip se já correto)
--   - CREATE OR REPLACE é idempotente por natureza
--
-- DEPENDÊNCIAS AUDITADAS:
--   - Trigger check_coverage_before_credit: lê via SELECT INTO BIGINT — OK
--   - bank-ledger.repository.ts: não lê system_coverage diretamente
--   - e2e-incentive-bank-checklist.ts: SELECT ::text — OK
--   - coverage_audit_log.execution_capacity_cents: BIGINT NOT NULL — alinhado
--   - coverage_audit_log.total_credits_cents: BIGINT NOT NULL — alinhado
--
-- DECISION: DECISION-0030 (VIEW type fix NUMERIC→BIGINT)
-- ============================================================

BEGIN;

DO $$
DECLARE
  view_exists BOOLEAN;
  col_type_capacity TEXT;
  col_type_credits TEXT;
BEGIN
  -- Guard: view deve existir
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'system_coverage'
  ) INTO view_exists;

  IF NOT view_exists THEN
    RAISE EXCEPTION 'C40 FIX: VIEW system_coverage não existe';
  END IF;

  -- Guard: colunas devem existir
  SELECT data_type INTO col_type_capacity
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'system_coverage'
    AND column_name = 'execution_capacity_cents';

  IF col_type_capacity IS NULL THEN
    RAISE EXCEPTION 'C40 FIX: coluna execution_capacity_cents não existe em system_coverage';
  END IF;

  SELECT data_type INTO col_type_credits
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'system_coverage'
    AND column_name = 'total_credits_cents';

  IF col_type_credits IS NULL THEN
    RAISE EXCEPTION 'C40 FIX: coluna total_credits_cents não existe em system_coverage';
  END IF;

  -- Idempotência: pular se já bigint
  IF col_type_capacity = 'bigint' AND col_type_credits = 'bigint' THEN
    RAISE NOTICE 'C40 FIX: colunas já são bigint. Nenhuma ação necessária.';
    RETURN;
  END IF;

  RAISE NOTICE 'C40 FIX: execution_capacity_cents=%, total_credits_cents=% — aplicando fix BIGINT.',
    col_type_capacity, col_type_credits;
END $$;

-- DROP + CREATE: necessário porque PostgreSQL não permite mudar tipo de coluna
-- via CREATE OR REPLACE VIEW (restrição do planner). Zero dependências confirmadas.
DROP VIEW IF EXISTS system_coverage;
CREATE VIEW system_coverage AS
SELECT
  t.id AS tenant_id,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id
      AND ba.owner_type = 'system'
      AND ba.owner_id NOT LIKE 'system:liquidity_issuance:%'
  ), 0)::bigint AS execution_capacity_cents,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type != 'system'
  ), 0)::bigint AS total_credits_cents
FROM tenants t;

COMMENT ON VIEW system_coverage IS
  'Cobertura econômica por tenant. execution_capacity_cents: saldo líquido de contas system (exceto liquidity_issuance). total_credits_cents: saldo líquido de contas não-system. C40 (DECISION-0030): BIGINT explícito via ::bigint cast — alinhado com coverage_audit_log e §nomenclatura *_cents.';

COMMIT;
